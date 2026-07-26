# 00 — Regole critiche e incidenti reali

Questo file è **precaricato a ogni sessione**: contiene solo ciò che non è derivabile dal codice.
Per la documentazione descrittiva (architetture, cataloghi, API) leggi `docs/tecnica/` **on-demand**.

---

## 1. MongoDB: sempre `_id`, mai `id`

Tutti gli schemi usano `_id`. I tipi frontend si aspettano `_id`. Convertire in `id` produce `undefined` a runtime.

```typescript
return { _id: loc._id.toString(), name: loc.name };   // ✅
return { id: loc._id.toString(), name: loc.name };    // ❌
```

**Incidente 2026-02-25** — `LocationService.getAccessibleLocations()` restituiva `id` invece di `_id`, e ometteva `slug` e l'oggetto `settings`. Il frontend crashava con `Cannot read property 'chat' of undefined`. Fix: `_id` + `slug` + `settings` completo + `occupants: []` come fallback.

Verifica: `grep -rn "id:" services/*/src/ --include="*.ts" | grep -v "_id"`

---

## 2. Logging: logger strutturato, mai `console.*`

| Contesto | Logger |
|---|---|
| `services/api-gateway`, `services/unified-backend` | Winston — `@shared/utils/logger` o `./utils/logger` |
| `services/embeddings-worker` | logger custom `src/utils/logger.ts` (**non** Winston, stessi livelli) |
| `local-ai/*` | `local-ai/shared/logger.ts` (wrapper Winston) |
| `apps/game`, `apps/management` | `@/lib/logger` — `debug`/`info` no-op in produzione |
| `apps/landing` | nessun wrapper: `console.*` ammesso (nessuna config ESLint) |
| `apps/documents` | nessun wrapper: `console.warn`/`console.error` ammessi, `console.log` genera warning |

**Eccezioni legittime**: script one-shot (`src/scripts/*`), build tool, e l'implementazione del logger stesso.

**Enforcement ESLint `no-console`** (disomogeneo, verifica prima di assumere):

| App | Regola |
|---|---|
| game | `error` — off solo per `src/lib/logger.ts` |
| management | `error` — off solo per `src/lib/logger.ts` |
| documents | `warn` con `allow: ["warn","error"]` |
| landing | nessuna config ESLint |

**Non** è enforced nei `services/*` e `local-ai/*`: nessuno ha config ESLint. Va verificato in code review.

**Incidente 2026-03-03** — api-gateway mescolava `console.log` e Winston: nessun timestamp, log non filtrabili, niente access log HTTP. Fix: tutto su Winston + Morgan con stream verso il logger.

---

## 3. API response: formato standard

Helper in `services/unified-backend/src/shared/utils/apiResponse.ts`.
Codici errore in `services/unified-backend/src/shared/utils/errorCodes.ts` (registry completo: `docs/tecnica/backend/error-codes.md`).

```typescript
successResponse(data, message?)   // { success: true, data, timestamp }
errorResponse(error, code, ...)   // { success: false, error, code, timestamp }
listResponse(list, pagination)    // { success: true, list, pagination, timestamp }
```

Messaggi di errore utente **in italiano**. Errori tecnici solo nei log, mai nella response.

---

## 4. WebSocket frontend: un solo punto di ricezione

I componenti **non** chiamano mai `socket.on()`. Sottoscrivono via `WebSocketContext`, che restituisce la funzione di cleanup.

```typescript
const { onLocationEvent } = useWebSocket();
useEffect(() => onLocationEvent(handleEvent), [onLocationEvent]);   // ✅
```

Motivo: evita memory leak, listener duplicati e stale closure.
Flusso: `API → logica backend → broadcast WS → WebSocketContext → componenti`.

Il backend filtra già i destinatari: **non ri-controllare i permessi nel frontend**. Se hai ricevuto l'evento, hai il diritto di vederlo.

Catalogo eventi e API del context: `docs/tecnica/frontend/websocket-patterns.md`, `docs/tecnica/backend/websocket-events.md`.
Implementazione: `apps/game/src/contexts/WebSocketContext.tsx`.

---

## 5. Optimistic updates: niente invalidate in `onSuccess`/`onSettled`

Per i toggle, invalidare dopo il successo innesca un refetch che sovrascrive l'update ottimistico → flicker.

```typescript
useMutation({
  mutationFn,
  onMutate: async (v) => {                       // cancel + snapshot + update ottimistico
    await queryClient.cancelQueries({ queryKey });
    const previous = queryClient.getQueryData(queryKey);
    queryClient.setQueryData(queryKey, next);
    return { previous };
  },
  onError: (_e, _v, ctx) => queryClient.setQueryData(queryKey, ctx.previous),   // rollback
  // NIENTE onSuccess/onSettled con invalidateQueries
});
```

**Incidente 2026-03-01** — toggle visibility/draft mostrava lo stato giusto e poi tornava indietro. Sequenza: click → ottimistico `false` → `onSuccess` → `invalidateQueries` → refetch serve la cache vecchia `true` → refetch completa `false`. L'utente vedeva `false → true → false`. Fix: rimosso l'invalidate, ci si fida dell'ottimistico e si fa rollback solo su errore.

---

## 6. Node: `.nvmrc` è source of truth

`v24.18.0`. Usa `nvm use` (legge `.nvmrc`), mai una versione hardcoded. In CI: `node-version-file: '.nvmrc'`. Nei Dockerfile: tag major floating `node:24-alpine`.

Motivo: versioni divergenti tra dev/CI/prod causavano build che passavano in locale e fallivano in produzione.

---

## 7. Build tools in `dependencies` se usati nel deploy

Se il deploy fa `npm install --production` e poi `npm run build`, il build tool deve stare in `dependencies`: `devDependencies` non viene installato.

**Stato attuale**: tutti i service buildano con `tsc`, quindi nessuno è esposto al problema. `esbuild` è presente in `devDependencies` di `api-gateway` ed `embeddings-worker` ma **non usato** negli script di build. Verifica `scripts.build` prima di applicare questa regola.

---

## Checklist pre-commit

- [ ] `_id` e non `id` in tutte le response
- [ ] Logger strutturato, nessun `console.*` (vedi tabella §2 per l'eccezione landing)
- [ ] Response nel formato standard
- [ ] WebSocket solo via `WebSocketContext`
- [ ] Nessun invalidate in `onSuccess` per i toggle
- [ ] `nvm use` eseguito
- [ ] Build tool in `dependencies` se usato nel deploy

---

## Regola di manutenzione di questo file

Aggiungi qui **solo**: regole normative e incidenti reali (data, sintomo, root cause, fix).
Non aggiungere: descrizioni architetturali, cataloghi, esempi di codice lunghi → vanno in `docs/tecnica/`.
Prima di fidarti di una riga, verificala contro il codice: le rules possono essere in drift.
