# TenpennyNovels — Istruzioni per Claude

## ⚠️ Preferenza utente critica

**Risposte SEMPRE critiche e non accondiscendenti.** Non dire "va bene" se ci sono margini di miglioramento: identificare problemi reali, limiti, e proporre fix concreti.

---

## Cos'è il progetto

Monorepo TypeScript/Node.js per un gioco di ruolo vittoriano multiplayer con AI locale.

```
apps/          4 frontend Next.js: landing(4000) game(4001) documents(4002) management(4003)
services/      3 backend: api-gateway(8000) unified-backend(3001) embeddings-worker(5001)
local-ai/      2 AI: botai(8080) character-gen(8130)
```

**Stack**: Next.js 16 Pages Router · React 18 · Express 5 (v4 in embeddings-worker/local-ai) · MongoDB/Mongoose · Redis · Socket.IO · Bull · Ollama · Qdrant · PM2 · Docker

**Node**: `.nvmrc` è source of truth (`v24.18.0`). **Nessun npm workspace**: ogni app/service ha il proprio `node_modules`, si installa con `cd <dir> && npm install`.

---

## Le 7 regole non negoziabili

Violarle causa bug in produzione. Dettagli e incidenti reali in [00-critical.md](.claude/rules/00-critical.md).

| # | Regola |
|---|--------|
| 1 | **MongoDB**: sempre `_id`, mai `id`, in ogni response |
| 2 | **Logging**: logger strutturato, mai `console.*` in codice applicativo |
| 3 | **API response**: formato standard `successResponse`/`errorResponse`/`listResponse` |
| 4 | **WebSocket frontend**: solo via `WebSocketContext`, mai `socket.on()` nei componenti |
| 5 | **Optimistic updates**: niente `invalidateQueries` in `onSuccess`/`onSettled` (race → flicker) |
| 6 | **Node version**: `nvm use` da `.nvmrc`, mai assumere la versione |
| 7 | **Build tools**: in `dependencies` se usati durante il deploy |

---

## Due livelli di documentazione

**`.claude/rules/` — normativo, precaricato a ogni sessione.** Cosa fare e cosa non fare, più gli incidenti reali. 5 file, deliberatamente snelli: ogni riga costa contesto.

| File | Contenuto |
|---|---|
| [00-critical.md](.claude/rules/00-critical.md) | Le 7 regole in dettaglio + incidenti reali — **leggi sempre** |
| [10-frontend.md](.claude/rules/10-frontend.md) | Regole per le 4 app, ESLint reale, checklist nuova pagina management |
| [20-backend.md](.claude/rules/20-backend.md) | Regole per i 3 service, auth a due livelli, Qdrant, ordine proxy |
| [30-ai-services.md](.claude/rules/30-ai-services.md) | botai e character-gen, agent dual-role, p-queue, callback |
| [40-workflow.md](.claude/rules/40-workflow.md) | TypeScript, npm senza workspace, git, CI/CD, Docker, deploy |

**`docs/` — descrittivo, da leggere SOLO all'occorrenza.** Architetture, cataloghi, API. Non caricarlo preventivamente: aprilo quando serve il dettaglio su un'area specifica.

| Doc | Quando aprirlo |
|---|---|
| [docs/INDEX.md](docs/INDEX.md) | punto di ingresso a tutta la documentazione |
| `docs/tecnica/frontend/game-app.md` | 12 tipi di messaggio, 9 store Zustand, virtual scrolling |
| `docs/tecnica/frontend/websocket-patterns.md` | API del `WebSocketContext`, errori tipici |
| `docs/tecnica/backend/websocket-events.md` | catalogo completo eventi Socket.IO |
| `docs/tecnica/backend/error-codes.md` | registry dei codici errore (~59 voci) |
| `docs/tecnica/backend/api-endpoints.md` | 90+ endpoint REST |
| `docs/tecnica/backend/authentication.md` | flusso JWT + sessione personaggio |
| `docs/tecnica/infrastructure/` | mongodb-schemas, docker-compose, env vars, redis, qdrant |
| [.claude/context/database-schema.md](.claude/context/database-schema.md) | dove trovare la verità sui modelli |

Se rules e `docs/` divergono, **il codice decide**. Correggi quello che è sbagliato nello stesso commit.

---

## Porte e infrastruttura

| Frontend | | Backend | | AI | | Data | |
|---|---|---|---|---|---|---|---|
| landing | 4000 | api-gateway | 8000 | botai | 8080 | MongoDB | 27017 |
| game | 4001 | unified-backend | 3001 | character-gen | 8130 | Redis | 6379 |
| documents | 4002 | embeddings-worker | 5001 | | | Qdrant | 6333 |
| management | 4003 | | | | | | |

**Produzione**: `tenpennynovels.com` (landing) · `game.` · `documenti.` · `gestione.` · `api.` · `ws.`

---

## Come lavorare

1. Leggi `00-critical.md` + il file rules dell'area interessata (non tutti)
2. Verifica i pattern **contro il codice reale** prima di proporre modifiche — le rules possono essere in drift
3. Per un bug: controlla se è un pattern ricorrente già documentato negli "Incidenti reali"
4. Se scopri un anti-pattern nuovo o una rule sbagliata, **aggiorna la rule** nello stesso commit

### Manutenzione delle rules

Queste rules sono precaricate a ogni sessione: ogni riga costa contesto. Regole di scrittura:

- ✅ Solo ciò che è **specifico di questo progetto** e non derivabile dal codice
- ✅ Incidenti reali: data, sintomo, root cause, fix — in forma compatta
- ✅ Puntatori a file (`path/file.ts`), non copie del loro contenuto
- ❌ Niente conoscenza generale (come si usa git, npm, Zod, Docker)
- ❌ Niente blocchi di codice lunghi che reimplementano file esistenti: si de-sincronizzano
