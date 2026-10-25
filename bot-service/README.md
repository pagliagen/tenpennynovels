# bot-service

Ospita i **servizi AI locali** di Ten Penny Novels, **uno per cartella**, e un piccolo HTTP interno.
Non va in produzione (escluso dal deploy). Su un eventuale server AI dedicato girerà accanto ad `ai-gateway/`.

| Servizio | Cartella | Cosa fa | Come è raggiunto |
|---|---|---|---|
| **`character-bot`** | `src/character-bot/` | il bot personaggio: risponde in chat con un LLM (Ollama, default `gemma4:12b`) | Redis pub/sub + endpoint interni del backend (nessuna rotta HTTP) |
| **`editorial`** | `src/editorial/` | bozze di testo per il gestionale (`POST /v1/editorial/generate`) | `ai-gateway` → HTTP interno |

`src/shared/` ha ciò che i servizi condividono (logger, client Ollama, config del launcher), `src/http/` il server interno.
I servizi **non sanno l'uno dell'altro**.

### Quali servizi sono attivi

`ENABLED_SERVICES=editorial,character-bot` (nel `.env`; **vuoto = nessuno**, di proposito: non accendere per svista un
servizio sul server sbagliato). Il launcher (`src/index.ts`) avvia solo quelli elencati. La configurazione di un servizio
(Redis, Mongo, segreto…) si valida **solo se è abilitato**: un server solo-editoriale non richiede quei segreti.

`GET http://127.0.0.1:8788/health` (solo loopback) restituisce i servizi **abilitati e sani**:
`{"services":["editorial","character-bot"],"down":[]}` (200; 503 se nessuno è sano, con il motivo in `down`).
Sano = `editorial`: Ollama risponde e ha il modello; `character-bot`: Redis, Mongo e Ollama rispondono.
Il gioco decide se l'AI è attiva proprio da questa lista, passando da `ai-gateway`.

### Editorial

`POST /v1/editorial/generate` `{system, user, schema?, maxTokens?}` → `{text | json, ms}`. Il modello lo sceglie il servizio
(`EDITORIAL_MODEL`, altrimenti `OLLAMA_MODEL`), mai la richiesta; `maxTokens` ha un tetto (`EDITORIAL_MAX_TOKENS`); una
generazione alla volta con al più `EDITORIAL_MAX_QUEUE` in attesa (oltre: 429). Non registra prompt né risposte.
Solo contenuti già pubblici devono arrivare qui (vedi `ai-gateway/README.md`).

### Character-bot

```
unified-backend ──publish──▶ Redis `bot:chat:message`
                                  │
                           character-bot
              filtra → debounce → cooldown → coda → Ollama
                                  │
unified-backend ◀── POST /internal/bot-chat/messages (secret) ──┘
```

## Cosa decide di rispondere

Solo messaggi `standard`, `public`, non nascosti, nella `locationId` di un bot.
Sussurri, azioni master e messaggi nascosti non arrivano mai al modello. Nessun bot
risponde a un bot (anche a un altro bot configurato). Una raffica di messaggi produce
**una** risposta (`debounceMs`), con pausa minima `cooldownMs` tra due risposte.

## Setup

1. **Personaggio bot** (una tantum, per ogni bot): un `Character` con
   `userId = SYSTEM_BOT_USER_ID` (default `000000000000000000000001`, creato da
   `UserSeeder`) e `playerStatus: 'approved'`. Il backend rifiuta altri personaggi.
2. **Backend**: imposta `BOT_SERVICE_SECRET` nel `.env` della root (letto da `docker-compose.yml`; in dev senza Docker, in `services/unified-backend/.env`)
   (`openssl rand -hex 32`) e ricostruisci il container (`stop`, `build`, `up -d`). Senza, `/internal/bot-chat` risponde 404.
3. **Servizio**:
   ```bash
   cd bot-service && nvm use && npm install
   cp .env.example .env                          # ENABLED_SERVICES, stesso BOT_SERVICE_SECRET, MONGODB_URI
   cp bots/barnaby-finch.example.json bots/barnaby-finch.json   # characterId, persona, scheda
   cp mapping.example.json mapping.json          # locationId → botId
   ollama pull gemma4:12b
   npm run dev
   ```
4. **Un bot nuovo**: aggiungilo a `BOT_CHARACTERS` in `scripts/seeders/seeders/BotCharacterSeeder.ts`,
   esegui `seed:dev:bots`: stampa il file `bots/<nome>.json` completo (persona e scheda) da salvare.

## Schede e mappatura

- `bots/<nome>.json`: **una scheda per bot** (persona, scheda psicologica, stile). Gli `*.example.json` sono modelli.
- `mapping.json`: `[{ "locationId": "...", "botId": "<characterId>" }]`. Un bot può stare su più location,
  una location ha un solo bot.
- Entrambi sono ignorati da git (contengono id dell'ambiente).

### Creare i bot dal gestionale (strumento da sviluppo)

Con `ENABLED_SERVICES=character-bot`, `ENABLE_BOT_CHARACTERS=true` sul backend locale e il gateway acceso, il tab **Bot** di
«Gestione Personaggi» elenca i bot e li genera: location + descrizione libera → scheda completa (personaggio, persona,
psicologia) da correggere → «Crea bot». Il character-bot espone tre azioni (`POST /v1/character-bot/<azione>`, via gateway):
`list`, `design` (non salva; `src/character-bot/designer.ts`) e `register` (scrive `bots/<slug>.json` + `mapping.json`, mai
sovrascrive, una location = un bot) e poi si ricarica da solo. Parti anche da zero: senza `bots/` né `mapping.json` il servizio
parte lo stesso. Relazioni e atteggiamenti non si generano: si scrivono a mano nel file (sezione sotto).

## Carattere, umore e rapporto

I numeri vivono nel codice e non arrivano mai al modello: un 12B non sa cosa farsene di
«Nevroticismo: 62». `psyche/describe.ts` li traduce in frasi italiane con soglie fisse.

| Livello | Dove | Cambia? |
|---|---|---|
| **Carattere**: Big Five (1-100) + Enneagramma (paura e desiderio) | `psyche` nella scheda | no |
| **Umore di fondo**: PAD (piacere, attivazione, dominanza, -1..1), uno per bot | Mongo `bot_moods` | sì: a ogni messaggio che riceve, e decade verso la base col tempo (più lento se il bot è nevrotico) |
| **Effetto della persona**: offset PAD «quando parlo con X» | scheda (`relationships`, `attitudes`) | no |
| **Rapporto**: fiducia, rispetto, sospetto (0-100), conteggio, data, nome noto, fatti, riassunto, ultimo evento | Mongo `relations` | sì |

L'umore con cui il bot parla = umore di fondo + offset della persona (clampato). Il tono cambia subito
al cambio di interlocutore, ma l'umore di fondo ha memoria.

### Cosa vede del giocatore

Solo la scheda **pubblica**: età apparente (mai quella reale, detta a occhio: «una ventina d'anni»),
genere, descrizione fisica/pubblica, altezza, capelli, occhi, segni visibili. Li dà il backend con
`GET /internal/bot-chat/characters/:id` (stesso secret, whitelist esplicita in
`features/botChat/utils/publicAppearance.ts`; `age`, `birthDate`, campi master non escono mai).
Il bot la scarica una volta all'ora per giocatore. Il **nome** no: finché il giocatore non si
presenta è «Straniero». Se il genere non è noto, il bot evita aggettivi di genere.

### Il meteo

Il bot vede **lo stesso meteo della sidebar del game**: `GET /internal/bot-chat/environment` costruisce il
testo da `getWeather()` (la stessa funzione e la stessa cache di `/game/environment`), in
`features/botChat/utils/botEnvironment.ts`. Le condizioni sono un `Record<WeatherCondition, …>`: se in
gioco ne compare una nuova (es. neve) il backend non compila finché non si dice come il bot la descrive.
Del tempo il bot non vede il numero ma come si sente («fa freddo»). In prompt entra **solo quando serve**
(`environment.ts`): se il giocatore ne parla, o se è all'Ingresso/Uscita e il bot non l'ha già detto nelle
ultime due battute. Se il backend non risponde il bot non lo indovina: ammette di non saperlo.
Le parole di meteo non presenti in prompt, in chat o nella persona restano «inventate» per `quality.ts`.

### Luoghi e ambientazione: il bot non inventa

Quando un giocatore chiede dove trovare qualcosa («dove dormo?», «c'è un parco?»), di un luogo preciso o
di storia e leggende, l'analisi del messaggio (`infoRequest`, stessa chiamata dell'appraisal) lo riconosce
con tag da **elenco chiuso** (`core/location/constants/locationTags.ts` nel backend, modificabili dal
gestionale nella modale della location) e il bot interroga il backend: `POST /internal/bot-chat/knowledge`.

- **Luoghi**: solo location foglia, visibili e **non private** (un luogo privato non esiste per il bot,
  come per un giocatore senza accesso), ordinate per vicinanza a dove lavora il bot: `here` (stesso
  quartiere), `near` (stesso distretto, o uno dei `knows` della scheda), `far` (il resto: sa solo che esiste,
  niente descrizione). Nessun dato su camere, prezzi o orari: non esistono, e il bot non li inventa.
- **Ambientazione**: solo documenti `ambientazione` pubblicati e pubblici (mai regolamento né manuale-master),
  due passaggi al massimo, solo se il coseno grezzo supera `LORE_MIN_COSINE` (0.41). Altrimenti «non so».
  Se il worker non risponde il bot ammette di non ricordare.
- **Soglia misurata** (2026-10-25, 20 domande pertinenti + 20 fuori tema, MiniLM): pertinenti 0,445–0,755,
  fuori tema 0–0,372 più un'eccezione («guerra dei Cent'anni», 0,494, che nessuna soglia < 0,50 elimina e che il
  bot, ricevendo il passaggio, dichiara di non sapere). Fra 0,38 e 0,44 l'esito è identico; 0,41 è a metà del vuoto.
  Da rimisurare se cambiano modello di embedding o documenti.
- **Il testo di gioco non arriva al bot**: l'ambientazione contiene anche frasi per i giocatori («Nel gioco i
  pronomi…», l'intera «Presentazione»). `stripGameMeta` toglie le frasi che nominano gioco, giocatori, scheda,
  regolamento e link di rimando, e scarta il chunk se sono il 25% o più. È euristico: la soluzione pulita è un
  flag per documento («visibile ai PNG»), non ancora fatto.
- Il blocco di prompt vieta altri luoghi: un nome proprio a metà frase che non è in persona, chat, rapporto o
  luoghi mostrati è «inventato» per `quality.ts` e fa rigenerare.
- `knows` nella scheda (opzionale): distretti che il bot conosce bene oltre al proprio.

### Rapporti e atteggiamenti nella scheda

- `relationships`: per `characterId` (parente, creditore, rivale…): `label`, `backstory`, punteggi iniziali,
  `knowsName`, `moodOffset`, `hint`. Il bot lo riconosce subito, senza presentazioni, e non è «prima volta».
- `attitudes`: per categoria, da ciò che vede: `gender`, `ageBand` (`child|young|adult|mature|old`),
  `appearsLike` (parole nella descrizione fisica/pubblica). Spostano i punteggi di partenza e l'umore.
- Non sono salvati su DB: cambiare la scheda cambia subito il comportamento. I punteggi di un rapporto,
  però, una volta creato su `relations` evolvono lì: modificare `trust` nella scheda non lo riscrive.

### Come cambiano

Prima di rispondere, uno step (`psyche/appraise.ts`) classifica **cosa ha appena fatto l'altro** da un
elenco chiuso (insulto, minaccia, gentilezza, mancia, scuse…, ciascuno con intensità 1-3); i numeri sono
in `psyche/events.ts` (tabella), scalati da carattere e rapporto (la fiducia tradita pesa di più, la
gentilezza di un sospettato meno). `psyche/dynamics.ts` limita le variazioni e spinge verso la base.
Così chi viene insultato risponde già arrabbiato e chi si presenta viene chiamato per nome subito.
Dopo la risposta si conta lo scambio e, ogni 3, si aggiorna il riassunto del rapporto (`psyche/memory.ts`).
Se l'analisi fallisce l'umore decade soltanto e la risposta parte lo stesso.

L'umore cambia **il modo** di rispondere (secco, nervoso, caldo; `describeDemeanor`), mai il se: il bot
risponde sempre, senza ritardi. Un nome vale solo se compare davvero nel testo del giocatore.
Il database (`botservice`) è separato da quello del game, sullo stesso server Mongo.

## Provarlo senza il game

`npm run simulate -- <locationId> "*entra* Buonasera, locanda aperta?" John`
pubblica un evento finto; la risposta viene poi postata al backend vero.

## Come genera una risposta (pipeline a step)

Un solo prompt faceva fare al modello quattro cose insieme (capire, scrivere, rispettare il
formato, non ripetersi) e sbagliava dove i vincoli si sommano. Ogni step ha un compito solo
(`src/character-bot/pipeline/`):

1. **Scaletta** (`plan`): JSON con cosa dire o fare, 1-3 punti.
2. **Bozza**: il testo, seguendo la scaletta.
3. **Critico** (`critique` + `rewrite`): **spento di default**, vedi sotto.
4. **Formato** (`format`): riscrittura nel formato giusto (azioni in terza persona tra
   asterischi, parole in prima). È l'ultimo step di generazione, così garantisce la forma finale.
5. **Controllo + revisione**: controlli deterministici (`quality.ts`: frasi ripetute dalle ultime
   battute, stessa apertura, azioni in prima persona, personaggi con titolo mai nominati); se
   falliscono, il formato gira di nuovo con il difetto indicato (max 2 volte).

Il contesto del turno è `TurnContext` (`pipeline/types.ts`): umore effettivo, rapporto, aspetto
e riassunto, già tradotti in frasi, per scaletta e bozza.

Misurato (8 prove su 4 scenari difficili, storia con battute in prima persona):

| Configurazione | pulite | tempo |
|---|---|---|
| prompt singolo | 4/8 | 2,7 s |
| + scaletta | 4/8 | 6,4 s |
| + formato | 7/8 | 9,5 s |
| + revisione | **8/8** | 9,6 s |
| + critico | 6/8 | 18,6 s |

La scaletta da sola non riduce i difetti misurati (serve al contenuto, non alla forma). Il
**critico peggiora**: con qwen3.5:9b segnalava problemi inesistenti in 8/8 casi e la riscrittura
introduceva errori nuovi. Resta nel codice, spento; potrebbe servire con un modello più grande.

## Modello

Default `gemma4:12b` (8 GB). Confronto sulla stessa pipeline, risposte lette a mano:

- `gemma4:12b`: formato corretto, risposte coerenti con la situazione, nessun nome inventato.
- `gemma3:12b`: troppo laconico (22 parole contro le 60 chieste) e lo step di formato mette in
  terza persona anche le battute.
- `qwen3.5:9b` / `9b-q8_0`: in carattere ma confonde i ruoli e inventa personaggi e parole;
  il q8 non è misurabilmente meglio del q4 e pesa 3,4 GB in più.
- `qwen3:14b`: peggio del 9b (azioni sempre in prima persona, risposte povere).
- Non entrano nei 24 GB con lo stack Docker acceso: `gemma4:26b`/`31b` (16-20 GB), `qwen3.5:27b` (17 GB).

I modelli a ragionamento (qwen3.5, gemma4) vengono chiamati con `think: false`; il client riprova
senza il parametro con i modelli che non lo supportano (gemma3). Cambia con `OLLAMA_MODEL`.
Il tempo non è un vincolo (una risposta in 10-30 s va bene), quindi gli step in più sono ammessi
se i dati li giustificano.

## Limiti noti

- Fuori dalle richieste riconosciute da `infoRequest` il bot può ancora inventare dettagli minori: il controllo
  sui nomi propri è euristico (iniziali maiuscole a metà frase), non vede luoghi scritti in minuscolo.
- L'indice di ricerca locale può essere disallineato dal DB (chunk di documenti che non esistono più): il lore
  risulta allora «non coperto». Si riallinea con `npm run seed:dev:reindex-documents` (dalla root; mai rilanciando i seed dei documenti, che li cancellano).
- Dopo molte domande "strane" di fila il 12B tende a ripetere il tono ostile delle sue ultime battute (minacce di cacciare chi chiede di storia).
- Un luogo `private` (Scotland Yard, Bank of England…) il bot non lo conosce: coerente con la mappa dei giocatori, ma poco realistico.
- L'umore reagisce solo a chi ha scritto per ultimo, non agli altri messaggi di una raffica.
- La dedup dei fatti è lessicale: «Cerca lavoro» / «Cerca manodopera» restano due fatti.
- Una categoria per occupazione/classe non c'è: la scheda pubblica non ha un campo affidabile.
- Il 12B a volte ignora l'umore in scene calme (agente: sospetto 72, tono ancora cortese).
- Una location ha un solo bot.
- Il backend limita `content` a 1200 caratteri; la lunghezza vera si governa nel prompt.

## Test

`npm test` (filtri di visibilità, sanitizzazione, debounce/cooldown, controlli di qualità, dinamiche di umore e rapporto,
rapporti autorati e categorie, aspetto, eventi). Non coprono Ollama né il backend.

### Scenari con Ollama vero

`npm run scenario -- scenarios/locanda.json [nomeScenario]` esegue conversazioni scriptate con stato in
memoria (niente Redis, Mongo, backend) e stampa per ogni battuta risposta, umore effettivo, rapporto e
memoria. Le `expect` del copione controllano solo le parti deterministiche (numeri, nome non rivelato).
Per confrontare i modelli: `OLLAMA_MODEL=qwen3.5:9b npm run scenario -- scenarios/locanda.json`.
Copioni in `scenarios/`: sconosciuto giovane, insulto e scuse, sorella e creditore, agente in uniforme, meteo, conoscenza del mondo
(alloggio, parco lontano, nessun luogo, luogo privato, lore coperta e non). Nel copione `tagOptions` è un'istantanea del registro dei tag
(offline non c'è il backend): da rigenerare se i tag cambiano.
