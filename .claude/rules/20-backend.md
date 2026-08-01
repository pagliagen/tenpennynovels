# 20 — Backend (`services/`)

Regole normative per i 3 service. Architettura completa: `docs/tecnica/backend/`.

| Service | Porta | Ruolo | PM2 | Doc |
|---|---|---|---|---|
| api-gateway | 8000 | reverse proxy, rate limit, CORS, proxy WebSocket, CDN | cluster ×2 | `docs/tecnica/backend/api-gateway.md` |
| unified-backend | 3001 | logica di business, 6 moduli, Socket.IO, CRON | fork ×1 | `docs/tecnica/backend/unified-backend.md` |
| embeddings-worker | 5001 | embedding async, Qdrant, RAG "Bibliotecario" | fork ×1 | `docs/tecnica/backend/embeddings-worker.md` |

**Nessun client esterno raggiunge direttamente unified-backend o embeddings-worker**: tutto passa dal gateway.

---

## Regole trasversali

**Logging**: vedi tabella in `00-critical.md` §2. `embeddings-worker` usa un logger custom, non Winston.

**`_id` e formato response**: vedi `00-critical.md` §1 e §3.

**dotenv prima di tutto**: `require('dotenv').config()` deve precedere qualsiasi import, altrimenti la config legge `undefined`.
In PM2 si usa `bootstrap.js` (carica dotenv, poi `dist/index.js`) — non puntare PM2 direttamente a `dist/index.js`.

**Path alias**: `@shared/*`, `@modules/*`, `@database/*`, `@config/*`. In produzione risolti da `module-alias` (`_moduleAliases` in `package.json`). Mai import relativi profondi per codice condiviso.

**Build**: tutti con `tsc`. Il deploy reinstalla le devDependencies prima del build (serve `tsc`) e fa `npm prune --production` dopo.

**Soft delete**: plugin `deletedAt`; le query lo escludono di default, `includeDeleted` per includerlo.

**Error handling**: `errorHandler` centralizzato, montato **ultimo**, preceduto da `notFoundHandler`. Traduce ValidationError/CastError/duplicate key/JWT in messaggi italiani con codice.

**Validazione**: express-validator con middleware che aggrega gli errori per campo.

**Health**: ogni service espone `/health`. Il gateway aggrega quelli dei backend.

---

## api-gateway (8000)

**Ordine di montaggio — critico**: il proxy WebSocket (`/socket.io/**`) va montato **prima** dei proxy HTTP, altrimenti questi intercettano l'upgrade e la connessione fallisce. I rate limiter vanno **prima** dei proxy.

**`res.status` dopo l'upgrade WebSocket**: dopo l'upgrade `res` è un socket TCP e **non ha** `.status()`. Negli error handler:

```typescript
if (!res.headersSent && typeof res.status === 'function') { res.status(502).json(...); }
```

**Incidente 2026-03-03** — l'error handler del proxy Socket.IO chiamava `res.status(502)` e crashava a ogni errore di upgrade. Fix: il controllo sopra.

**Timeout**: 30s per i proxy REST, 60s per `/documents` (ricerca semantica lenta), 120s per WebSocket. Erano 10s e facevano fallire richieste legittime (2026-03-03).

**Rate limit**: doppio limite per `/documents` — 30 req/min non autenticati, 120 req/min autenticati (chiave = token, non IP, così i tab non si rubano quota). Disattivati in sviluppo. Bypass per le build Next.js via header secret.

**Proxy**: inoltrare `Cookie` e `Authorization` in ingresso e `set-cookie` in uscita, altrimenti l'auth si rompe.

**SSE**: per la ricerca semantica va rimosso `accept-encoding`, la compressione rompe lo stream.

**CORS**: attivo solo in sviluppo con whitelist; in produzione lo gestisce Nginx. Header necessari: `X-Session-Id`, `X-Tenpenny-Documents-Build`.

---

## unified-backend (3001)

**6 moduli**: `auth`, `game`, `admin`, `documents`, `forum`, `tickets`.
⚠️ `docs/tecnica/backend/unified-backend.md` marca forum/tickets come "in development": verifica lo stato reale nel codice prima di fidarti (il forum ha avuto sviluppo recente).

**Controller statici**, logica di business nei service. I controller non fanno query dirette.

**Doppio livello di autenticazione**:

1. **Utente** — JWT in cookie HttpOnly `auth_token` (exp 24h, `sameSite: strict`, `secure` in prod)
2. **Personaggio** — `sessionId` opaco (UUID v4) in Redis via `SessionStore`, passato come header `X-Session-Id`

Catena middleware: `authenticateUser()` → `authenticateCharacter()` → `requireGameplayRole([...])` / `requireAdmin([...])`.

**Validazione di ownership obbligatoria**: `session.userId === req.user.userId`, altrimenti 403. Difesa in profondità: il possesso del `sessionId` non basta.

Il cookie `character_context` è **deprecato**: usare `X-Session-Id`. Flusso completo: `docs/tecnica/backend/authentication.md`.

**WebSocket**: Socket.IO con adapter Redis (scaling orizzontale). All'handshake verifica JWT dai cookie + `sessionId` dalla query, poi join della room `character:<id>`. Broadcast per room.

**Redis pub/sub** per la comunicazione cross-service (es. `embeddings:document:new` verso embeddings-worker).

**CRON**: generazione sitemap (giornaliera 03:00, `node-cron`, **nessun run all'avvio** del processo — non fidarsi di versioni precedenti di questa rule). Rigenerata anche ad ogni deploy dalla pipeline, vedi `40-workflow.md`. Cleanup presenze: ogni 5 min, dietro feature flag.

**Debito tecnico**: `ChatController.ts` è ~2900 righe e accorpa invio messaggi, editing, allegati, notifiche, broadcast e pub/sub. Modificarlo con cautela e testare a fondo: alto accoppiamento. Da splittare.

---

## embeddings-worker (5001)

**Bull queue**: concorrenza 5, 3 tentativi, backoff esponenziale da 5s. I job falliti finiscono in una **Dead Letter Queue** con flag `retryable` (errori di validazione/modello = permanenti, rete/timeout = ritentabili). Bull v3 non supporta processor tipizzati: processor generico + validazione manuale di `job.data`.

**Qdrant — due regole che hanno già causato bug**:

1. **Point ID in formato UUID**, non ObjectId MongoDB. Serve la conversione `objectIdToUUID()` (24 hex → 8-4-4-4-12). Qdrant rifiuta l'ObjectId.
2. **L'ObjectId va nel payload**: in lettura usa `result.payload.documentId`, **non** `result.id` (che è l'UUID e non è interrogabile su MongoDB).

**Incidenti 2026-02-23** — tre bug nella stessa area: ObjectId rifiutato da Qdrant; ricerca semantica che restituiva l'UUID come `documentId`; filtro per tipo che cercava la chiave `type` mentre il payload ha `documentType`. Verifica sempre che le chiavi del filtro combacino coi campi reali del payload.

**Collection** (384 dimensioni, distanza cosine): `documents`, `document_chunks`, `forum_posts`, `chat_messages`.

**Cache**: hash MD5 del testo come chiave, TTL 1h. Con cache ~50ms, senza ~1.5s.

**Python**: subprocess `sentence-transformers` (`paraphrase-multilingual-MiniLM-L12-v2`), ~60s di caricamento modello all'avvio.

**RAG "Bibliotecario"** — migrato qui da `local-ai/services/qa`, è una feature di produzione:
`POST /ask` (generazione su contesto già recuperato), `POST /extract-keywords`, `POST /extract-insight`.
Il retrieval lo fa unified-backend via `/search`, non `/ask`.
`/health` resta gated **solo** sul subprocess Python: un Ollama down non deve marcare unhealthy il service, perché `/search` continua a funzionare. Lo stato Ollama è nel campo separato `ollama`, che unified-backend legge con cache 60s.

**Dockerfile**: è `FROM python:3.12-slim`, non Node — esiste per il subprocess Python. In produzione il processo Node gira via PM2 sull'host. Non applicargli il pattern multi-stage Node.
