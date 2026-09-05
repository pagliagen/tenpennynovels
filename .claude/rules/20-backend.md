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

**I poteri elevati valgono solo su un personaggio `playerStatus: 'approved'`.** Vale sia per `isGestore` sia per i `gameplayRoles` master/moderatore: un personaggio draft/pending va trattato come un giocatore normale. `StatusRestrictions` in `config/permissions/game.ts` **non** è la sede giusta per farlo rispettare (elenca permessi bloccati uno per uno e non conteneva i `game:admin:*`).

**Ci sono tre percorsi indipendenti che concedono poteri di ruolo, non uno.** Ogni fix va applicato a tutti e tre, o resta un buco:

| Percorso | Dove | Stato |
|---|---|---|
| `hasGamePermission()` / `resolveEffectiveRoles()` | `config/permissions/game.ts` | filtra per stato ✅ |
| `hasAdminPermission()` | `config/permissions/admin.ts` | bypass `isGestore` **non** filtrato per stato ⚠️ |
| `requireGameplayRoles()` / `requireGameplayRole()` | `modules/game/middleware/auth.ts`, `core/auth/middleware/auth.ts` | filtra da 2026-08-22 (`requireApproved`, default `true`) |

Per un check di ruolo preferire **`hasGamePermission()`**: risolve già stato, override e bypass gestore in un punto solo.

**Incidente 2026-08-19** — `/auth/session` restituiva tutti i `game:admin:*` a un PG in bozza con `gameplayRoles: ['master']`. Due bypass distinti nello stesso file, entrambi valutati **prima** dello stato: `if (isGestore) return ...` e i permessi di ruolo mai filtrati per stato. Il primo era già stato corretto in #59, il secondo no.
**Incidente 2026-08-22** — stessa classe, terzo percorso mai toccato dai fix precedenti: `requireGameplayRoles()` non guardava `playerStatus`, e la variante `core` valutava `if (isGestore) next()` prima dello stato. Raggio reale nullo (unici usi: `['player']`), ma il commento di `onGameMessages.ts` dichiarava «BLOCKED for DRAFT characters» ed era **falso** — né middleware né `OnGameMessageController` controllavano nulla. Fix: parametro `requireApproved` con default `true`; `offGameMessages.ts` ammette i draft di proposito e fa opt-out esplicito.

**Permessi derivati dallo stato, non denormalizzati.** `game:character:wizard` viene calcolato in `getCharacterGamePermissions()` da `playerStatus === 'draft'`. Non fidarsi dell'array `characterPermissions` come sorgente: l'hook `pre('save')` di `Character.ts` lo popola solo su `isModified('playerStatus')`, quindi ogni `updateOne`/`findByIdAndUpdate`, fix manuale sul DB o `Object.assign` che rimpiazza l'array in blocco (`CharacterApprovalController`, `allowedFields`) lasciava un draft senza il permesso e col wizard irraggiungibile (incidenti 2026-08-14 e 2026-08-19). Un `-game:character:wizard` esplicito continua a vincere.

Il cookie `character_context` è **deprecato**: usare `X-Session-Id`. Flusso completo: `docs/tecnica/backend/authentication.md`.

**WebSocket**: Socket.IO con adapter Redis (scaling orizzontale). All'handshake verifica JWT dai cookie + `sessionId` dalla query, poi join della room `character:<id>`. Broadcast per room.

**Redis pub/sub** per la comunicazione cross-service (es. `embeddings:document:new` verso embeddings-worker).

**Tipi di documento e lettura riservata.** Sorgente unica: `features/documenti/constants/documentTypes.ts`. `manuale-master` è a lettura riservata (permesso `game:documents:master-manual:read`, ruolo master), gli altri due sono pubblici. Regola: ogni percorso di lettura pubblica parte da `PUBLIC_DOCUMENT_TYPES` e passa da `utils/documentAccess.ts` — **default-deny**, mai una lista di esclusioni. I canali da coprire sono cinque, non uno: dettaglio, `routes/list`, `routes/list-hierarchical`, `/search`, `/semantic-search`, più i preferiti. Fuori dai canali pubblici: escluso da `SitemapService`, non indicizzato (il `post('save')` di `Document.ts` pubblica un evento *deleted* quando un documento pubblico diventa riservato, altrimenti i chunk già in Qdrant/ES restano cercabili da chiunque) e non revalidato.

Il permesso vive sul **personaggio**, quindi richiede `X-Session-Id`: le route pubbliche montano `authenticateCharacter(false)`. Su `apps/documents` questo implica che le pagine riservate siano **client-only** — vedi `10-frontend.md`.

**Revalidation ISR di `apps/documents`**: `Document.ts` (post-save hook) chiama fire-and-forget `POST /api/revalidate` su `apps/documents` (`DocumentsRevalidator.ts`, secret condiviso `DOCUMENTS_REVALIDATE_SECRET`) per rigenerare subito la pagina statica. Le pagine dettaglio di `regolamento`/`ambientazione` sono ISR con `revalidate: 3600`: senza questo trigger, un salvataggio da gestionale non si vede sul sito pubblico per fino a un'ora (fix 2026-08-18).

**CRON**: generazione sitemap (giornaliera 03:00, `node-cron`, **nessun run all'avvio** del processo — non fidarsi di versioni precedenti di questa rule). Rigenerata anche ad ogni deploy dalla pipeline, vedi `40-workflow.md`. Cleanup presenze: ogni 5 min, dietro feature flag.

**Debito tecnico**: `ChatController.ts` è ~2900 righe e accorpa invio messaggi, editing, allegati, notifiche, broadcast e pub/sub. Modificarlo con cautela e testare a fondo: alto accoppiamento. Da splittare.

---

## embeddings-worker (5001)

**Bull queue**: concorrenza 5, 3 tentativi, backoff esponenziale da 5s. I job falliti finiscono in una **Dead Letter Queue** con flag `retryable` (errori di validazione/modello = permanenti, rete/timeout = ritentabili). Bull v3 non supporta processor tipizzati: processor generico + validazione manuale di `job.data`.

**Qdrant — regole che hanno già causato bug**:

1. **Point ID in formato UUID**, non ObjectId MongoDB. Serve la conversione `objectIdToUUID()` (24 hex → 8-4-4-4-12). Qdrant rifiuta l'ObjectId.
2. **L'ObjectId va nel payload**: in lettura usa `result.payload.documentId`, **non** `result.id` (che è l'UUID e non è interrogabile su MongoDB).
3. **Point ID dei chunk documento deterministico**: `stableUUID(documentId:slug:splitIndex)` in `embedding-worker.ts`, non `crypto.randomUUID()`. Con ID casuale ogni retry BullMQ o re-embed produceva un punto orfano mai ripulito.

**Incidenti 2026-02-23** — tre bug nella stessa area: ObjectId rifiutato da Qdrant; ricerca semantica che restituiva l'UUID come `documentId`; filtro per tipo che cercava la chiave `type` mentre il payload ha `documentType`. Verifica sempre che le chiavi del filtro combacino coi campi reali del payload.

**Incidente 2026-08-15** — Qdrant/ElasticSearch a 3818 punti contro 453 chunk reali in MongoDB per `document_chunks`. Causa doppia: `crypto.randomUUID()` come point ID (ogni retry creava un punto nuovo invece di sovrascrivere) + nessun cleanup quando un update rinominava/rimuoveva una sezione H2/H3 (il vecchio slug restava orfano finché non arrivava un delete sull'intero documento). Fix: point ID deterministico (regola 3 sopra) + `pruneStaleChunks()` in `embedding-worker.ts`, che ad ogni evento `document created/updated`, dopo che tutte le sezioni correnti sono salvate con successo, cancella da Mongo+Qdrant+ES i chunk con chiave `(slug, splitIndex)` non più presente. `deleteDocumentEmbeddings()` ora pulisce anche `documentchunks` in MongoDB (prima restavano orfani lì, ripuliti solo su Qdrant/ES).

**Chunking**: split strutturale per heading H2/H3 del Delta TipTap (non a dimensione fissa, nessuna libreria tipo LangChain, nessun overlap tra chunk), poi split per lunghezza solo se una sezione supera `config.embeddings.maxTextChars` (10000, limite hard del subprocess Python — sopra viene rifiutato, non troncato). Vedi `src/utils/ChunkParser.ts`.

**Collection** (384 dimensioni, distanza cosine): `documents`, `document_chunks`, `forum_posts`, `chat_messages`.

**Cache**: hash SHA-256 del testo come chiave (`hashContent`), TTL 1h. Con cache ~50ms, senza ~1.5s. `stableUUID` usa ancora MD5 di proposito: serve un digest da 32 hex per il formato UUID dei point ID Qdrant.

**Python**: subprocess `sentence-transformers` (`paraphrase-multilingual-MiniLM-L12-v2`), ~60s di caricamento modello all'avvio.

**RAG "Bibliotecario"** — migrato qui da `local-ai/services/qa`, è una feature di produzione:
`POST /ask` (generazione su contesto già recuperato), `POST /ask/enrich` (arricchimento progressivo da fonti successive, max 3 step).
Il retrieval lo fa unified-backend via `/search`, non `/ask`.
`/extract-keywords` e `/extract-insight` sono stati **rimossi il 2026-08-16**: nessun chiamante vivo nel repo (dead code post-refactor).
`/health` resta gated **solo** sul subprocess Python: un Ollama down non deve marcare unhealthy il service, perché `/search` continua a funzionare. Lo stato Ollama è nel campo separato `ollama`, che unified-backend legge con cache 60s.

**Dockerfile**: è `FROM python:3.12-slim`, non Node — esiste per il subprocess Python. In produzione il processo Node gira via PM2 sull'host. Non applicargli il pattern multi-stage Node.
