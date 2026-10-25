# 30 — bot-service (`bot-service/`)

Servizio **locale e separato** (non va in produzione: escluso dal rsync) che risponde in chat con un LLM (Ollama).
Descrizione, setup e dati misurati: `bot-service/README.md`.

```
Chat.ts ─publish─▶ Redis `bot:chat:message` ─▶ bot-service ─POST─▶ /internal/bot-chat/messages (unified-backend, feature botChat)
```

## Architettura dei servizi AI (server AI dedicato in prospettiva)

L'AI deve poter stare **fuori dal server di gioco** (VPS solo CPU, 11 GB; il runner di Ollama è già arrivato a 7 GB). Due processi locali, destinati a traslocare insieme su un server dedicato:

```
server di gioco ──HTTPS──▶ ai-gateway (:8787) ──loopback──▶ bot-service (:8788) ──▶ Ollama
 (core/ai)  ngrok oggi        auth, limiti, smista             ├ editorial        (HTTP /v1/editorial/*)
                                                               └ character-bot    (Redis, Mongo, backend)
```

- **`ai-gateway/`** (pacchetto indipendente, solo `node:http`): unico ingresso da fuori. Segreto `X-AI-Gateway-Secret` richiesto **anche per `/health` e per i percorsi inesistenti** (401 identico), non è un proxy aperto (solo `POST /v1/<servizio>/<azione>` nel registro `src/registry.ts`), corpo e rate limit, timeout 502/504 senza dettagli. `GET /health` = i servizi **abilitati e sani** di bot-service, 503 se nessuno. Mai prompt né risposte nei log. Dettagli, ngrok e checklist del trasloco: `ai-gateway/README.md`.
- **`bot-service/`**: un servizio per cartella (`src/character-bot/`, `src/editorial/`), `src/shared/` (logger, client Ollama) e `src/http/` (HTTP interno **solo loopback**). **`ENABLED_SERVICES`** decide quali girano (vuoto = nessuno, voluto); la config di un servizio si valida solo se è abilitato. I servizi non si conoscono. `editorial`: il modello lo sceglie il servizio (`EDITORIAL_MODEL`), mai la richiesta; coda a concorrenza 1 con tetto (429), `maxTokens` limitato.
- **Dal gioco**: `ENABLE_IA_EDITORIAL` + `AI_GATEWAY_URL` + `AI_GATEWAY_SECRET` (vedi `20-backend.md`). Con il Mac spento l'AI non c'è e nulla si rompe.
- **Nuovo servizio AI** = cartella in `bot-service/src/`, voce in `FACTORIES` (`src/index.ts`) e `SERVICE_NAMES` (`http/service.ts`), nome nel registro del gateway.
- **Aperto, da decidere prima di spostare il `character-bot` su un altro server**: oggi parla con Redis (pub/sub), Mongo `botservice` e gli endpoint interni del backend; fra due server serve una rete privata o far spingere gli eventi dal backend al gateway. L'`editorial` non ha il problema.

`local-ai/` (botai, character-gen, gateway) **non esiste più**: se ne trovi tracce, sono residui da togliere.
Il Q&A "Bibliotecario" vive in `services/embeddings-worker` (vedi `20-backend.md`).

---

## Regole

**Endpoint interno fail-closed.** Senza `BOT_SERVICE_SECRET` risponde 404; accetta solo personaggi con `userId = SYSTEM_BOT_USER_ID` e `approved` (il secret non permette di scrivere a nome di un giocatore vero). Il gateway non inoltra `/internal`. Il secret sta nel `.env` della **root** (lo legge `docker-compose.yml`), non in `services/unified-backend/.env`: il backend gira in Docker.

**Cosa vede il bot.** Solo messaggi `standard`, `public`, non nascosti. **Non riusare `embedding:chat:created`**: parte anche per le azioni master/moderazione e non porta `visibility`. Il bot non risponde mai a un bot (anche a un altro bot configurato).

**`position` è un tag libero** ("Bancone", "Tavolo 2"): il bot risponde con il tag del giocatore. Non validarlo contro `location.positions` (elenca solo Ingresso/Uscita): le risposte perdevano il tag.

**Il bot non sa il nome di chi non si è presentato.** Nel prompt è «Straniero»; il nome entra solo se l'analisi lo propone **e** compare davvero nel testo del giocatore (`validateIntroducedName`).

**I numeri non arrivano al modello.** Big Five, PAD e punteggi di rapporto vivono nel codice e `psyche/describe.ts` li traduce in frasi. L'AI **classifica** ciò che l'altro ha fatto (eventi da elenco chiuso, `psyche/appraise.ts`); i numeri sono nella tabella di `psyche/events.ts` e il codice li limita (`psyche/dynamics.ts`). Umore e rapporti stanno nel db Mongo `botservice`, separato da quello del game.

**L'appraisal gira PRIMA della risposta, la chiusura dopo.** Umore, rapporto e nome detto si aggiornano prima di generare (chi si presenta è chiamato per nome subito); conteggio e riassunto dopo la pubblicazione. Tutto nello stesso job della coda (concurrency 1). Il vecchio botai analizzava dopo, fuori coda (race), e il bot rispondeva «Straniero» a chi si era appena presentato.

**Aspetto = solo campi pubblici, via backend.** Il bot non legge il db del game: `GET /internal/bot-chat/characters/:id` restituisce solo la whitelist di `features/botChat/utils/publicAppearance.ts` (età **apparente**, mai `age`). Aggiungere un campo alla scheda non lo rende visibile al bot (default-deny). L'età si dice a occhio, mai il numero.

**Il meteo del bot = quello della sidebar.** `GET /internal/bot-chat/environment` deriva da `getWeather()` (stessa sorgente di `/game/environment`); il bot non ha una sua mappa del tempo. Nuova condizione di meteo in gioco ⇒ aggiornare `botEnvironment.ts` (il compilatore lo impone). Il meteo entra nel prompt solo quando serve (`environment.ts`), mai sempre: un 12B lo ripete in ogni battuta.

**Luoghi e lore da fonti, non dal modello.** `POST /internal/bot-chat/knowledge` (luoghi per tag/nome ordinati per vicinanza + passaggi di `ambientazione` pubblicata via `searchPublicLore`, `documenti/api`). Riservatezza = default-deny nel backend: mai location `private` o non `visible`, mai tipi documento diversi da `ambientazione`, mai bozze/non pubblici. I tag sono un registro chiuso (`core/location/constants/locationTags.ts`, usato da modello, gestionale e bot): un tag nuovo si aggiunge lì e nel CSV dei seeder (il test `locationTagsCsv` lo verifica); le location già nel DB si aggiornano con `seed:dev:location-tags` (il seeder normale salta o, con `--force`, cancella tutto). Il blocco di prompt vieta altri luoghi e `quality.ts` segnala i nomi propri non autorizzati. `LORE_MIN_COSINE` = 0.41, misurata su 20+20 domande etichettate (numeri e come rifarla in `utils/lorePassages.ts`): dipende dal modello di embedding e dai documenti, da rimisurare se cambiano. L'ambientazione contiene anche testo per giocatori: `stripGameMeta` lo toglie prima di calcolare la copertura (euristico).

**Rapporti autorati nella scheda.** `relationships` (per `characterId`) e `attitudes` (per categoria) stanno in `bots/<nome>.json`, non su DB: la scheda decide etichetta, nome noto, offset dell'umore. I punteggi, una volta creato il rapporto in `relations`, evolvono lì.

**L'umore cambia il modo, mai il se.** Il bot risponde sempre e senza ritardo; tono, lunghezza e gesti seguono l'umore (`describeDemeanor`). Niente violenza fisica sull'altro (regola 10 del prompt): ciò che subisce un personaggio lo decide il suo giocatore.

**Configurazione**: una scheda per bot in `bots/<nome>.json` + `mapping.json` (location → bot, una location ha un solo bot). Entrambi ignorati da git (contengono id dell'ambiente); gli `*.example.json` sono modelli. Nuovo bot: `BotCharacterSeeder` (`seed:dev:bots`).

**Ollama.** Modelli a ragionamento (qwen3.5, gemma4) con `think: false`; il client riprova senza il parametro con quelli che lo rifiutano (gemma3). Il tempo per risposta non è un vincolo (1-2 minuti vanno bene).

**Test**: `cd bot-service && npm test` e `cd ai-gateway && npm test` (non coprono Ollama né il backend). Con Ollama: `npm run scenario -- scenarios/locanda.json` (copioni con controlli sulle parti deterministiche).

---

## Incidenti reali (2026-10-25)

- **Il mondo che parla di gioco** — nella «Presentazione» e nelle FAQ dell'ambientazione ci sono frasi come «Ten Penny Novels è un gioco di ruolo…»: una domanda sul gioco restituiva proprio quel chunk (coseno 0,40) e il bot rischiava di rompere il personaggio. Soglia e filtro vanno insieme: prima si tolgono le frasi di gioco (`stripGameMeta`), poi si misura. Non basta un regex (la «Presentazione» è catturata dalla densità): serve un flag per documento.
- **Indice locale disallineato** — la ricerca restituiva chunk di documenti non più nel DB (id diversi): il lore del bot risultava sempre «non coperto» e il worker in esecuzione era un'immagine di 7 settimane senza `vectorScore`. Il filtro sui documenti esistenti ha fatto il suo mestiere (nessun testo orfano al bot), ma per vedere il lore serve l'indice allineato. **Non rilanciare i seed**: `seed:dev:documents --force` cancella i documenti scritti dal gestionale (il CSV ha altri id) e nessun seed pubblica cancellazioni. Si usa `npm run seed:dev:reindex-documents` (`-- --dry-run` per vedere orfani e mancanti, `-- --wait` per attendere l'allineamento): toglie dall'indice gli orfani e ripubblica l'aggiornamento di ogni documento pubblico, senza toccare Mongo. Un documento senza contenuto (0 caratteri) non produce chunk e resta «non indicizzato»: è normale.
- **Divieti che autorizzano** — nel `knownText` delle righe di prompt intere stavano anche i divieti («niente neve»), che rendevano lecite proprio le parole vietate. Al controllo sui nomi vanno solo persona, chat, rapporto, luoghi e parole del meteo mostrati.

- **Mancia fantasma** — l'help dell'evento `mancia` diceva «offre un giro»: «Offri un giro a un vecchio amico?» (Jack che *chiede*) veniva letto come mancia e alzava il piacere. Negli help degli eventi dire **chi dà a chi** e cosa NON vale.
- **Meteo inventato** — «mi piace il rumore della pioggia» mentre nessuno ne parlava: `quality.ts` ora segnala il meteo non presente in chat/persona.
- **Violenza sul giocatore** — un bot insultato «afferra per il colletto» il giocatore: regola 10 nel prompt.

## Incidenti reali (2026-10-17)

- **Nome copiato dall'esempio** — l'esempio nel prompt del formato diceva «guarda John»: il bot citava un John mai nominato. Negli esempi dei prompt **niente nomi propri**.
- **Critico LLM peggiorativo** — con un 9B segnalava problemi inesistenti in 8/8 casi e la riscrittura introduceva errori (pulite 6/8 contro 8/8 senza). Resta nel codice, spento di default (`DEFAULT_PIPELINE`).
- **Umore saturo** — la dominanza finiva a 1,0: il bot "tiene la situazione in mano" a ogni scambio. Ora spinta verso la base a ogni scambio (`PULL_TO_BASELINE`) e ancore di grandezza nel prompt di analisi.
- **Prima persona nelle azioni** — il feedback di rigenerazione non la corregge (anche a storia pulita sbaglia 4 volte su 8); la risolve lo step di **riscrittura nel formato**, che è l'ultimo della pipeline.
- **Seeder utenti** — importare una costante da `UserSeeder.ts` ne eseguiva il `main()`, con `--force` cancellava admin e personaggi. Le costanti condivise stanno in `scripts/seeders/utils/`.
