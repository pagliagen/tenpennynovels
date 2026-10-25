# 20 — Backend (`services/`)

Regole normative per i 3 service. Architettura completa: `docs/tecnica/backend/`.

| Service | Porta | Ruolo | PM2 | Doc |
|---|---|---|---|---|
| api-gateway | 8000 | reverse proxy, rate limit, CORS, proxy WebSocket, CDN | cluster ×2 | `docs/tecnica/backend/api-gateway.md` |
| unified-backend | 3001 | logica di business (`core/` + 17 `features/` + `modules/game|admin`), Socket.IO, CRON | fork ×1 | `docs/tecnica/backend/unified-backend.md` |
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

**Timeout** (`services/api-gateway/src/config.ts`, `config.proxy`): 30s per i proxy REST (`defaultTimeout`), 120s per `/documents` (ricerca semantica lenta, `documentsTimeout`), 60s per WebSocket (`socketTimeout`). Erano 10s e facevano fallire richieste legittime (2026-03-03).

**Rate limit**: doppio limite per `/documents` — 30 req/min non autenticati, 120 req/min autenticati (chiave = token, non IP, così i tab non si rubano quota). Disattivati in sviluppo. Bypass per le build Next.js via header secret.

**Proxy**: inoltrare `Cookie` e `Authorization` in ingresso e `set-cookie` in uscita, altrimenti l'auth si rompe.

**SSE**: per la ricerca semantica va rimosso `accept-encoding`, la compressione rompe lo stream.

**CORS**: attivo solo in sviluppo con whitelist; in produzione lo gestisce Nginx. Header necessari: `X-Session-Id`, `X-Tenpenny-Documents-Build`.

---

## unified-backend (3001)

**Struttura**: `core/` (dominio condiviso: `core/auth`, `character`, `chat`, `location`, `features`, `extensions`, `ai`), `features/` (17 feature, ciascuna con `manifest.ts` e `api.ts` pubblico: forum, tickets, documenti, economia, bot, editorial…) e `modules/game` + `modules/admin`. `app.ts` monta `/auth`, `/game`, `/admin`; le feature si montano da `bootstrapFeatures()` secondo il manifest. Le vecchie «6 moduli» (`modules/auth|documents|forum|tickets`) non esistono più; il codice è la fonte di verità, `docs/tecnica/backend/unified-backend.md` ne riporta la mappa.

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

**Chat OFF-GAME: i draft possono usarle, senza vincoli di stato.** Servono proprio a chiedere informazioni (regolamento, creazione del personaggio) e `StatusRestrictions` non blocca nessun `offgame-chat:*`. Non aggiungere controlli su `playerStatus` in `OffGameChatController`. **Incidente 2026-10-17** — un controllo "DRAFT solo con APPROVATI" (`DRAFT_CHAT_RESTRICTION`, 2026-03-14) in `createChat` e `sendMessage`: in `sendMessage` il filtro girava su `chat.participants`, che include il mittente, quindi un draft non poteva **mai** inviare, nemmeno verso approvati (403 con messaggio che prometteva il contrario). Rimossi entrambi. Difese restanti contro l'abuso: `banChecks.chat()`, mute, `leave`, rate limit di rotta. Il commento di `requireCharacterAuth` ("deve essere APPROVED") era falso: non filtra per stato.

**Permessi derivati dallo stato, non denormalizzati.** `game:character:wizard` viene calcolato in `getCharacterGamePermissions()` da `playerStatus === 'draft'`. Non fidarsi dell'array `characterPermissions` come sorgente: l'hook `pre('save')` di `Character.ts` lo popola solo su `isModified('playerStatus')`, quindi ogni `updateOne`/`findByIdAndUpdate`, fix manuale sul DB o `Object.assign` che rimpiazza l'array in blocco (`CharacterApprovalController`, `allowedFields`) lasciava un draft senza il permesso e col wizard irraggiungibile (incidenti 2026-08-14 e 2026-08-19). Un `-game:character:wizard` esplicito continua a vincere.

Il cookie `character_context` è **deprecato**: usare `X-Session-Id`. Flusso completo: `docs/tecnica/backend/authentication.md`.

**WebSocket**: Socket.IO con adapter Redis (scaling orizzontale). All'handshake verifica JWT dai cookie + `sessionId` dalla query, poi join della room `character:<id>`. Broadcast per room.

**Redis pub/sub** per la comunicazione cross-service (es. `embeddings:document:new` verso embeddings-worker).

**Tipi di documento e lettura riservata.** Sorgente unica: `features/documenti/constants/documentTypes.ts`. `manuale-master` è a lettura riservata (permesso `game:documents:master-manual:read`, ruolo master), gli altri due sono pubblici. Regola: ogni percorso di lettura pubblica parte da `PUBLIC_DOCUMENT_TYPES` e passa da `utils/documentAccess.ts` — **default-deny**, mai una lista di esclusioni. I canali da coprire sono cinque, non uno: dettaglio, `routes/list`, `routes/list-hierarchical`, `/search`, `/semantic-search`, più i preferiti. Fuori dai canali pubblici: escluso da `SitemapService`, non indicizzato (il `post('save')` di `Document.ts` pubblica un evento *deleted* quando un documento pubblico diventa riservato, altrimenti i chunk già in Qdrant/ES restano cercabili da chiunque) e non revalidato.

Il permesso vive sul **personaggio**, quindi richiede `X-Session-Id`: le route pubbliche montano `authenticateCharacter(false)`. Su `apps/documents` questo implica che le pagine riservate siano **client-only** — vedi `10-frontend.md`.

**Revalidation ISR di `apps/documents`**: `Document.ts` (post-save hook) chiama fire-and-forget `POST /api/revalidate` su `apps/documents` (`DocumentsRevalidator.ts`, secret condiviso `DOCUMENTS_REVALIDATE_SECRET`) per rigenerare subito la pagina statica. Le pagine dettaglio di `regolamento`/`ambientazione` sono ISR con `revalidate: 3600`: senza questo trigger, un salvataggio da gestionale non si vede sul sito pubblico per fino a un'ora (fix 2026-08-18).

**Slug, titolo e rinomina.** Lo slug non si deriva mai dal titolo lato backend: lo decide il client (creazione e modifica in management). `PATCH /admin/documents/:id` con `slug` valida formato (`utils/slugValidation.ts`, stesso pattern di `apps/documents/.../api/revalidate.ts`, che altrimenti scarta il path in silenzio) e unicità (400 `INVALID_SLUG`, 409 `DUPLICATE_SLUG`). Il `path` dipende solo da `subtype.slug + doc.slug`, quindi il cambio di slug non ha cascata sui figli. **L'autosave (`PATCH /:id/autosave`) bypassa hook, re-embed e revalidation ISR**: il titolo autosalvato è già su DB quando arriva "Salva", perciò `isModified('title')` è falso e non ci si può affidare ai flag di modifica. Il post-save di `Document.ts` rigenera quindi a ogni save sia il documento (e il path precedente) sia la **pagina del padre**, che elenca titolo e link dei figli (altrimenti la rinomina compare lì dopo fino a 1h). Il vecchio URL dopo un cambio di slug dà 404 (nessun redirect) e resta in sitemap fino alle 03:00.

**Gerarchia documenti (`parentId`).** Si cambia genitore solo con `PATCH /admin/documents/:id/move` (`DocumentMoveService`): valida cicli, stesso tipo e **stesso sottotipo** (il `path` dipende dal sottotipo: un figlio in un sottotipo diverso starebbe nel sidebar sotto uno e avrebbe l'URL dell'altro) e profondità ≤ `MAX_DOCUMENT_DEPTH` (5, il `maxDepth` di `HierarchyService`: oltre, i figli spariscono dalla pagina pubblica senza errore). Scrive con `bulkWrite`, quindi **niente hook**: la revalidation ISR di vecchio padre, nuovo padre e documento spostato è esplicita nel service, perché il dettaglio del padre elenca i figli. `PATCH /:id` con `parentId` passa dalle stesse regole. Il frontend replica il check (`apps/management/src/lib/documentTree.ts`) solo per non proporre drop rifiutati: l'autorità è il backend. Il backend non ha un test runner: `npx tsx --test src/features/documenti/utils/__tests__/documentMove.test.ts`.

**Editoriale (`features/editorial`) e AI via gateway.** La revisione di canone (`GET /admin/editorial/canon-check`, voce «Editoriale» nel gestionale) è deterministica, in sola lettura e **sempre attiva, anche in produzione**: nessun flag. Le funzioni che usano **un modello** (manifest `editorialAi`: oggi senza route, arriveranno con bozze di descrizioni e dicerie) sono attive solo se `ENABLE_IA_EDITORIAL` vale `'true'` (valore esatto, default `false`) **e** il gateway AI risponde: la variabile dice «l'AI è abilitata», il gateway dice «c'è davvero». Si può quindi tenere `true` anche in produzione: con il gateway spento l'AI semplicemente non c'è. È un flag `source: 'env'` con `requiresAiService: 'editorial'` (`core/features/types.ts`); `isEnvFlagActive` (`core/features/envFlag.ts`) **non interroga il gateway se la variabile è spenta**. Il client è `core/ai/AiGatewayClient.ts` (`aiGateway`, da `AI_GATEWAY_URL` / `AI_GATEWAY_SECRET`): `isAvailable(servizio)` fa una sonda a `GET /health` **pigra** (mai da un timer: il tunnel ngrok ha una quota di richieste), cache 60 s se ok / 10 s se ko, una sola in volo, **risposta validata** (200 con JSON `services`: la 404 HTML di ngrok a tunnel spento non conta); `generate()` dà errori in italiano senza dettagli tecnici. Spenta: le route AI rispondono 404 (`requireFeature`), `GET /admin/system/feature-flags` dà `editorialAiEnabled: false` e il gestionale nasconde i pulsanti AI (`featureFlagsStore`, che rilegge ogni 120 s a scheda visibile). **Non aggiungere un secondo canale** per far sapere alla UI cosa è acceso. **Regola: un flag solo per ciò che usa un modello**; le regole deterministiche non ne hanno. **Suggerimenti AI per le location** (`POST /admin/editorial/ai/locations/:id/suggest-description|suggest-tags`, permesso `locations.update`, dietro `requireFeature('editorialAi')`): **non scrivono mai**, restituiscono una bozza che il gestionale mette nel form con «Usa» e che una persona salva. Il modello propone, il codice verifica (`features/editorial/utils/validators.ts`): lunghezza, anni diversi dal canone, anacronismi, parole straniere, nomi propri non presenti nelle fonti, **fatti persi** dalla descrizione attuale (un 12B sostituisce i fatti con atmosfera generica: «progettata da Brunel» spariva), testo di gioco. I controlli informano, non bloccano. Limiti noti, non rilevabili con regole: parole inesistenti («giardo») e scambi di tipo di luogo (una stazione chiamata «cattedrale»): per questo le bozze sono **punto di partenza da rileggere**, mai da pubblicare così. **Chat dei bot (`features/botChat`).** Il gioco spinge ogni messaggio pubblico di una location con un bot al servizio AI esterno (`BotChatForwarder`, via gateway) con la storia e `reply: {baseUrl, token}`; il servizio risponde su `/bot-api` con un token firmato per evento (UN bot, UNA location, 15 min, ambiente del backend). Parte solo con la config completa (`ENABLE_BOT_CHAT`, `BOT_SERVICE_SECRET` ≥ 32, `BOT_REPLY_BASE_URL`, gateway). `/internal/bot-chat` non esiste più. Dettagli e rationale in `30-ai-services.md`. Il forwarder parte da `server.ts` **dopo** `redis.connect()` (i manifest si leggono prima: `onBoot` sarebbe troppo presto).

**Il tab «Bot» (`features/botAdmin`, `ENABLE_BOT_CHARACTERS`; ogni bot ha un ambiente, vedi `30-ai-services.md`) usa `aiGateway.call(servizio, azione, corpo)`** (generico: `generate` è `call('…','generate')` con errori propri; 400/409/429 dei servizi passano con messaggio e `code`). `unified-backend` ha ora `zod` fra le dipendenze (prima non c'era, nonostante la regola in `40-workflow.md`): usarlo per i dati in ingresso delle nuove feature. Dettagli in `30-ai-services.md`.

**Descrizione SEO (`POST /admin/editorial/ai/documents/:id/generate-seo`) è l'unica funzione AI che SALVA.** Per questo ha regole più strette dei suggerimenti: input solo **titolo + testo del documento** (la descrizione attuale non entra: in produzione i 14 documenti pubblici l'hanno **vuota**, quindi «espandere» non avrebbe materiale), accetta una bozza solo se **tutti** i controlli passano (120-160 caratteri, anni solo se nel documento, nomi propri solo se nel documento, niente parole straniere né frasi fatte), riprova fino a 3 volte e altrimenti **non scrive nulla** (422 `SEO_CHECKS_FAILED`). Nessun `stripGameMeta`: una meta description descrive la pagina com'è, anche se parla del gioco (la «Presentazione» sarebbe sparita). Scrive con `findOneAndUpdate` (niente `save()`: `description` non cambia il contenuto, niente re-embed) e rigenera la pagina ISR. La modifica a mano è `PATCH /admin/documents/:id/seo-description`: `description` **non** è fra i campi di `PATCH /:id`. `GET /admin/documents/seo` elenca tutti i pubblici. Misurato con gemma4:12b: 2,8-4,7 s per chiamata, 8/9 documenti al primo tentativo. **Il proxy `/admin` dell'api-gateway taglia a 30 s** (un flusso SSE con battito ogni 5 s lo supera: verificato a 59 s con la generazione dei bot, vedi `30-ai-services.md`; `compression()` in `app.ts` richiede `res.flush()` dopo ogni scrittura) (`config.proxy.defaultTimeout`): un'operazione AI più lenta (modello su CPU nel server dedicato, avvio a freddo) fallirebbe in produzione anche se il backend la completa; in quel caso serve SSE o un job asincrono, non un timeout più alto.
`stripGameMeta` sta in `documenti` (`documenti/api`) ed è usato sia dal bot sia dall'editoriale. **Nei prompt verso il gateway solo contenuti già pubblici** (ambientazione, descrizioni di location, tag): mai chat, descrizioni private o dati dei personaggi (i prompt transitano da ngrok). La lettura dei documenti passa da `documenti/api` (`readDocumentsForReview`). Il checker di confini legge un solo `dependsOn` per directory (l'ultimo): i due manifest di `editorial` vanno tenuti allineati. Per provare l'admin panel in locale serve un personaggio admin **approved** (il seed lo crea in bozza).

**CRON**: generazione sitemap (giornaliera 03:00, `node-cron`, **nessun run all'avvio** del processo — non fidarsi di versioni precedenti di questa rule). Rigenerata anche ad ogni deploy dalla pipeline, vedi `40-workflow.md`. Cleanup presenze: ogni 5 min, dietro feature flag.

**Debito tecnico**: `ChatController.ts` è ~2900 righe e accorpa invio messaggi, editing, allegati, notifiche, broadcast e pub/sub. Modificarlo con cautela e testare a fondo: alto accoppiamento. Da splittare.

---

## embeddings-worker (5001)

**Coda embedding**: **BullMQ** (non Bull v3, migrato in #31 - la vecchia nota su "Bull v3 non supporta processor tipizzati" era superata), concorrenza 5, 3 tentativi, backoff esponenziale da 2s (`config.queue`). I job falliti finiscono in una **Dead Letter Queue** con flag `retryable` (errori di validazione/modello = permanenti, rete/timeout = ritentabili).

**Un documento alla volta**: gli eventi Redis `embeddings:document:*` includono `Date.now()` nel `jobId` (`start()` in `embedding-worker.ts`), quindi due save ravvicinati sullo stesso documento (autosave!) finiscono in due job BullMQ distinti, potenzialmente eseguiti in concorrenza sui 5 worker slot. `handleDocumentEvent()` acquisisce un lock Redis per `documentId` prima di processare (rilasciato in `finally`): senza, due job concorrenti sullo stesso documento possono creare righe duplicate in `documentchunks` (`updateOne(...,{upsert:true})` su una chiave senza indice unico non è atomico sotto concorrenza) o farsi cancellare a vicenda i chunk appena scritti via `pruneStaleChunks()`.

**Incidente 2026-09-09** — l'indice (TOC) di `apps/documents` mostrava H2 duplicati o, in alcuni casi, l'indice non compariva. Causa reale (diversa da quella temuta): non era la race di cui sopra, ma `DocumentController.sendDetailResponse()` che mappava 1:1 ogni riga di `documentchunks` su una sezione dell'indice, senza tenere conto che `ChunkParser.splitOversizedChunk()` (introdotto in 809b9381, 2026-08-15) spezza un H2/H3 troppo lungo in più righe con lo stesso slug (`splitIndex` crescente) - un'intestazione lunga appariva quindi ripetuta una volta per pezzo. Fix: `DocumentController.mergeSplitChunks()` ricompone i pezzi in una sola sezione per slug prima di rispondere. La race sull'upsert concorrente è comunque reale (mai riprodotta con dati concreti, ma il gap architetturale c'è) ed è stata chiusa nello stesso commit col lock Redis per documento.

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

**RAG "Bibliotecario"** — feature di produzione:
`POST /ask` (generazione su contesto già recuperato), `POST /ask/enrich` (arricchimento progressivo da fonti successive, max 3 step).
Il retrieval lo fa unified-backend via `/search`, non `/ask`.
`/extract-keywords` e `/extract-insight` sono stati **rimossi il 2026-08-16**: nessun chiamante vivo nel repo (dead code post-refactor).
**Accensione.** Il Bibliotecario è dietro il flag runtime `keeper_qa_enabled` (manifest `features/bibliotecario`, default `false`): un worker sano e `ollama: true` in `/health` **non** significano che sia attivo. Il flag sta nella collection **`system_configurations`** (il modello fissa `collection:`; `systemconfigurations`, il nome che Mongoose deriverebbe, è un'altra collection e una scrittura lì viene ignorata senza errori). `ConfigurationService` mette il valore in Redis (`system_config:<key>`, TTL 1h) e una scrittura diretta su Mongo non lo invalida: farlo con `PATCH /admin/system/configurations/:configKey` o con `DEL` della chiave. Verifica end-to-end: `GET /documents/ai-status` → `aiAvailable: true`, poi una domanda su `/documents/semantic-search`.

**Modello e budget in produzione (VPS CPU-only, 11 GB, niente swap).** `OLLAMA_MODEL=qwen3.5:4b`, `QA_MAX_CONTEXT_CHARS=2500`, `QA_MAX_CHUNK_CHARS=800`. Il collo di bottiglia è il prefill (~30 tok/s): con il budget di default (6000/1500) il 4b impiegava 72-76s per risposta e il 3b 47-59s, oltre il timeout di 60s di `KeeperClient.ask`. Il 9b non ci sta (6.6 GB, niente swap: rischio OOM su Mongo/ES). Anche il 4b: il runner `llama-server` è arrivato a **7 GB residenti in 6 ore** (modello da 3.3 GB, 733 MB disponibili sul server) con `keep_alive: -1`; ora `OLLAMA_KEEP_ALIVE` vale 15m di default, così la memoria rientra a riposo (costo: ~10s di caricamento alla prima domanda dopo una pausa). Il Bibliotecario è opzionale e non deve mai mettere a rischio Mongo/ES: se la memoria torna a scendere, riavviare Ollama (`systemctl restart ollama`). `searchStream.ts` non passa `maxTokens` (vale `QA_MAX_ANSWER_TOKENS`): l'800 di prima sovrascriveva il tetto e a ~8 tok/s poteva sforare i 60s. **La lunghezza della risposta si chiede nel prompt, non si impone tagliando l'output**: `RAGPipeline` dichiara un budget di parole pari a metà di `QA_MAX_ANSWER_TOKENS` (250 → 70 parole, ~1.7 token/parola) e il modello si ferma da solo (misurato 49-105 token, `done=stop`). Mai troncare a valle: una risposta tagliata a metà frase è peggio di una corta; `truncated` nel log `RAG answer generated` segnala che il prompt non sta più contenendo la lunghezza. `MAX_ENRICHMENT_STEPS = 0` in `searchStream.ts`: ogni `/ask/enrich` sforava i 30s e il giocatore vedeva "sto leggendo" per 90s senza risultato; da riportare a 3 su hardware più veloce. Benchmark riusabile: confronto dei modelli sugli stessi prompt di `RAGPipeline` prima di cambiarli, e poi **sul server**, non in locale (un Mac con GPU è 5-10× più veloce).

**Quando parte il Bibliotecario (`features/bibliotecario/utils/answerRouting.ts`, `decideRoute`).** Non decide il punteggio RRF di `/search`: è basato sul rank, quindi il primo risultato vale ~95-100% anche per "chi ha vinto i Mondiali 2006?" (la vecchia `MIN_AI_SCORE = 35` non scartava mai nulla). Si usa il **coseno grezzo di Qdrant**, che il worker espone come `vectorScore` (insieme a `keywordHit`), più la somiglianza domanda↔intestazione. Tre esiti: **direct** (una sezione si intitola come la domanda → nessuna AI, il link è già in cima), **synthesis** (fino a 3 chunk di documenti diversi all'AI), **not_covered** (miglior coseno < `NOT_COVERED_BELOW` = 0.27 → `ai_answer` statico "Non ho trovato nulla di pertinente in <Sezione>.", nessuna chiamata al modello). Con **una sola fonte** serve `SINGLE_SOURCE_MIN_COSINE` = 0.4, altrimenti è `not_covered`: il 2026-10-16 la quest in ambientazione (coseno 0.298, un solo chunk debole) ha prodotto luoghi inesistenti nei documenti (Lambeth, Stepney, "foreste vicine a Londra"), perché un 4b riempie i vuoti. Le soglie sono misurate su MiniLM (non coperte 0.16-0.26, borderline coperte 0.30, trasversali 0.37-0.62) con margine stretto e **dipendono dal modello di embedding**: ogni decisione è loggata (`[Bibliotecario] route`) per ritararle. Per le domande il controller recupera i match vettoriali da 0.1 (il client manda `minSimilarity=0.3`, che nascondeva la fascia decisiva) e poi filtra la lista mostrata come prima. Le domande restano **sempre in SSE**, anche a zero risultati: il client di `useSSESearch` non sa leggere una risposta JSON. Test: `npx tsx --test src/features/bibliotecario/utils/__tests__/answerRouting.test.ts`.

**Incidente 2026-10-16** — "attiva il Bibliotecario" dato per fatto perché `/health` del worker era verde, ma il flag era `false`: l'utente vedeva solo i link. Poi la prima scrittura del flag era finita nella collection sbagliata (sopra) e la cache Redis serviva ancora `false`. Fix: scrittura su `system_configurations` + `DEL` della chiave.

`/health` resta gated **solo** sul subprocess Python: un Ollama down non deve marcare unhealthy il service, perché `/search` continua a funzionare. Lo stato Ollama è nel campo separato `ollama`, che unified-backend legge con cache 60s.

**Dockerfile**: è `FROM python:3.12-slim`, non Node — esiste per il subprocess Python. In produzione il processo Node gira via PM2 sull'host. Non applicargli il pattern multi-stage Node.
