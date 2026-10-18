# bot-service

Servizio **locale e separato** che risponde con un LLM (Ollama, default `gemma4:12b`) ai messaggi
dei giocatori in chat di location configurate. Non è raggiunto da nessun client: si
aggancia al Redis di tenpennynovels e risponde al backend.

```
unified-backend ──publish──▶ Redis `bot:chat:message`
                                  │
                           bot-service (questo)
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
   cp .env.example .env                          # stesso BOT_SERVICE_SECRET, MONGODB_URI
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

## Carattere, umore e rapporto

I numeri vivono nel codice e non arrivano mai al modello: un 12B non sa cosa farsene di
«Nevroticismo: 62». `psyche/describe.ts` li traduce in frasi italiane con soglie fisse.

| Livello | Dove | Cambia? |
|---|---|---|
| **Carattere**: Big Five (1-100) + Enneagramma (paura e desiderio) | `psyche` nella scheda | no |
| **Umore**: PAD (piacere, attivazione, dominanza, -1..1), uno per bot | Mongo `bot_moods` | sì: dopo ogni scambio, e decade verso la base col tempo (più lento se il bot è nevrotico) |
| **Rapporto**: fiducia, rispetto, sospetto (0-100) + conteggio, data, nome noto, fatti, per ogni giocatore | Mongo `relations` | sì |

- **Primo incontro / già visto** è deterministico (conteggio e data). Ciò che solo l'AI sa è **se si è
  presentato** e **cosa ha detto di sé**: finché non lo fa, il bot vede il giocatore come «Straniero»
  anche se il suo nome è in chat.
- Dopo ogni risposta pubblicata, uno step di analisi (`psyche/analyze.ts`) propone le variazioni. L'AI
  propone, il codice limita (`psyche/dynamics.ts`): variazioni massime per scambio, spinta verso la
  base, e un nome vale solo se compare davvero nel testo del giocatore. Se l'analisi fallisce, conteggio
  e data si salvano comunque.
- Il database (`botservice`) è separato da quello del game, sullo stesso server Mongo.



## Provarlo senza il game

`npm run simulate -- <locationId> "*entra* Buonasera, locanda aperta?" John`
pubblica un evento finto; la risposta viene poi postata al backend vero.

## Come genera una risposta (pipeline a step)

Un solo prompt faceva fare al modello quattro cose insieme (capire, scrivere, rispettare il
formato, non ripetersi) e sbagliava dove i vincoli si sommano. Ogni step ha un compito solo
(`src/pipeline/`):

1. **Scaletta** (`plan`): JSON con cosa dire o fare, 1-3 punti.
2. **Bozza**: il testo, seguendo la scaletta.
3. **Critico** (`critique` + `rewrite`): **spento di default**, vedi sotto.
4. **Formato** (`format`): riscrittura nel formato giusto (azioni in terza persona tra
   asterischi, parole in prima). È l'ultimo step di generazione, così garantisce la forma finale.
5. **Controllo + revisione**: controlli deterministici (`quality.ts`: frasi ripetute dalle ultime
   battute, stessa apertura, azioni in prima persona, personaggi con titolo mai nominati); se
   falliscono, il formato gira di nuovo con il difetto indicato (max 2 volte).

Il contesto del turno è `TurnContext` (`pipeline/types.ts`): qui si aggiungono umore e rapporto
col personaggio (primo incontro o già conosciuto), da usare in scaletta e bozza.

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

- Nessun riassunto dei ricordi: il bot vede gli ultimi `historySize` messaggi (Redis,
  `botservice:history:<locationId>`) e, per ogni giocatore, solo i punteggi e al massimo 8 fatti brevi.
  I fatti possono avere duplicati di significato («Cerca lavoro» / «Cerca manodopera»).
- L'umore si aggiorna solo quando il bot risponde, non a ogni messaggio letto.
- Una location ha un solo bot.
- Il backend limita `content` a 1200 caratteri; la lunghezza vera si governa nel prompt.

## Test

`npm test` (filtri di visibilità, sanitizzazione, debounce/cooldown, controlli di qualità, dinamiche di umore e rapporto, nome nascosto). Non coprono
Ollama né il backend: per quelli serve lo stack acceso.
