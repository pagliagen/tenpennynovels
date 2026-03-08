# Setup e Sviluppo Locale

## Prerequisiti

- Docker e Docker Compose
- Node.js 22.x (per sviluppo senza Docker)
- ~4GB di spazio disco per il modello Ollama
- ~8GB di RAM disponibile durante l'inferenza

## Primo avvio

### 1. Configurare l'ambiente

```bash
cd local-ai
cp .env.example .env
cp clients.json.example clients.json
```

Editare `clients.json` e sostituire tutte le chiavi `CHANGE_ME`:

```bash
# Genera chiavi sicure
openssl rand -hex 32   # per apiKey del client prod
openssl rand -hex 32   # per hmacSecret del client prod
openssl rand -hex 32   # per apiKey del client dev
```

Struttura di `clients.json`:

```json
[
  {
    "id": "tpn-prod",
    "name": "TenPennyNovels VPS",
    "apiKey": "<chiave-prod>",
    "hmacSecret": "<hmac-prod>",
    "permissions": ["botai", "qa", "item-image-gen", "location-image-gen", "avatar-gen"],
    "rateLimit": { "maxPerMinute": 30 }
  },
  {
    "id": "tpn-dev",
    "name": "Local Development",
    "apiKey": "<chiave-dev>",
    "permissions": ["botai", "qa", "item-image-gen", "location-image-gen", "avatar-gen"],
    "rateLimit": { "maxPerMinute": 120 }
  }
]
```

Il client dev non ha `hmacSecret` — le richieste non richiedono firma HMAC.

Il file `clients.json` e montato nel container gateway come volume Docker (read-only). Modifiche al file richiedono solo un restart del gateway, non un rebuild.

### 2. Avviare lo stack

```bash
docker compose up -d
```

### 3. Scaricare il modello Ollama

```bash
docker compose exec ollama ollama pull mistral:7b-instruct
```

Ci vuole qualche minuto (il modello pesa ~4GB).

### 4. Verificare

```bash
curl http://localhost:9000/health | python3 -m json.tool
```

Devi vedere `"status": "healthy"` con tutti i servizi `up` (o `stub` per le immagini).

### 5. Test rapido

```bash
# Crea un bot manualmente (usando la chiave dev da clients.json)
curl -X POST http://localhost:9000/botai/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <apiKey-del-client-tpn-dev>" \
  -H "X-Client-Id: tpn-dev" \
  -d '{
    "name": "Test Bot",
    "gender": "male",
    "publicDescription": "Un uomo robusto con una cicatrice sulla guancia e un sorriso disarmante.",
    "personality": {
      "traits": ["amichevole", "curioso", "protettivo"],
      "speech_style": "informale, intercala con esclamazioni",
      "background": "Un ex marinaio che ha aperto una locanda sul porto",
      "coreValues": ["lealta", "onesta", "ospitalita"]
    },
    "systemPrompt": "Sei un personaggio di test amichevole. Parli in modo informale e accogli tutti con un sorriso."
  }'

# Genera un bot con Ollama (asincrono, richiede callback)
curl -X POST http://localhost:9000/botai/bots/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <apiKey-del-client-tpn-dev>" \
  -H "X-Client-Id: tpn-dev" \
  -d '{
    "requestId": "gen-test-001",
    "description": "Un oste irlandese, veterano di guerra, con un segreto oscuro",
    "location": {
      "name": "The Rusty Anchor Pub",
      "description": "Un pub fumoso nel quartiere portuale di Londra"
    },
    "locale": "it",
    "callback": {
      "url": "https://example.com/webhook",
      "method": "POST",
      "headers": { "Content-Type": "application/json" }
    }
  }'

```

I campi `gender`, `publicDescription` e `coreValues` sono opzionali ma consigliati: arricchiscono la qualita delle risposte. Il campo `location` nella generate contestualizza il personaggio al luogo in cui opera.

> **Nota**: anche `POST /botai/bots/generate` e asincrono — risponde `202 Accepted` immediatamente. Il bot generato arriva via callback con `type: "bot-generated"`.

### 6. Pagina di test interattiva

Per testare la generazione bot e la chat asincrona in modo visuale, avvia il servizio test-ui:

```bash
docker compose --profile test up -d test-ui
```

Poi apri nel browser:

```
http://localhost:3100
```

La pagina di test (React) consente di:

- Generare un bot con Ollama (descrizione + location) — API key pre-configurata
- Chattare col bot in modo asincrono (risposte via SSE in real-time)
- Caricare bot esistenti tramite ID
- Visualizzare dettagli e personalita del bot attivo

**Come funziona internamente:**

1. Il browser apre una connessione SSE su `GET /api/events` (test-ui Express)
2. Quando invii un messaggio, l'app chiama `POST /botai/respond` (gateway) con callback URL = `http://test-ui:3100/api/callback`
3. BotAI processa la richiesta in background via coda e invia il risultato alla callback
4. Il server test-ui riceve la callback e la pusha via SSE al browser

Il servizio test-ui e completamente isolato dal gateway. Si avvia solo con `--profile test` e si ferma con `docker compose --profile test down`.

Per configurare la API key del test-ui, impostare `TEST_UI_API_KEY` nel `.env`:

```bash
TEST_UI_API_KEY=<apiKey-del-client-tpn-dev>
```

> **Nota**: tutti gli endpoint BotAI sono asincroni — rispondono `202 Accepted` immediatamente. Le richieste vengono messe in coda ed elaborate una alla volta da Ollama.

## Sviluppo senza Docker (servizi in foreground)

Per sviluppare i servizi con hot-reload:

```bash
# 1. Avvia solo l'infrastruttura
docker compose up -d ollama mongodb

# 2. Installa dipendenze
npm install

# 3. Avvia i servizi in dev mode (terminali separati)
cd gateway && npm run dev
cd services/botai && npm run dev
cd services/qa && npm run dev
```

Oppure tutto insieme:

```bash
npm run dev
```

Questo avvia gateway, botai e qa con `concurrently` e hot-reload via `tsx watch`.

## Comandi utili

```bash
# Makefile shortcuts
make start          # docker compose up -d
make stop           # docker compose down
make dev            # avvia solo ollama + mongodb
make logs           # docker compose logs -f
make pull-models    # pull mistral:7b-instruct
make health         # curl /health
make ngrok          # avvia tunnel ngrok
make start-all      # avvia tutto inclusi stub immagini
```

## Struttura dei file di configurazione

| File | Scopo |
|------|-------|
| `.env` | Variabili d'ambiente (non committato) |
| `.env.example` | Template variabili d'ambiente |
| `clients.json` | Registry client con API key e permessi (non committato) |
| `clients.json.example` | Template client registry |
| `.dockerignore` | Esclusioni per il build context Docker |
| `docker-compose.yml` | Stack completo (build context = root) |
| `ngrok.yml` | Configurazione tunnel ngrok |
| `Makefile` | Comandi rapidi |
| `package.json` | Workspace monorepo + script npm |
| `tsconfig.base.json` | Config TypeScript base |

## Aggiungere un nuovo servizio

1. Creare la cartella `services/<nome>/` con la struttura standard (vedi gli stub come riferimento)
2. Creare il `Dockerfile` con multi-stage build (vedi sotto)
3. Aggiungere una riga in `gateway/src/services.ts`
4. Aggiungere eventuali schemi di validazione in `gateway/src/middleware/validate.ts`
5. Aggiungere il servizio in `docker-compose.yml` con `context: .` e `dockerfile: services/<nome>/Dockerfile`
6. Aggiungere il permesso nei client che devono accedervi (`clients.json`)
7. Aggiungere la variabile target in `.env` (es. `NEW_SERVICE_TARGET=http://new-service:PORT`)

### Struttura del Dockerfile

I Dockerfile usano **multi-stage build** per separare compilazione e produzione. Il build context e la root di `local-ai/` (configurato nel `docker-compose.yml`), non la cartella del singolo servizio. Questo consente ai servizi di accedere a `shared/` e `tsconfig.base.json`.

Un symlink `node_modules` viene creato a `/app/` per consentire a TypeScript di risolvere i moduli importati da `shared/`:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app/services/<nome>
COPY services/<nome>/package.json ./
RUN npm install
RUN ln -s /app/services/<nome>/node_modules /app/node_modules
COPY tsconfig.base.json /app/
COPY shared/ /app/shared/
COPY services/<nome>/tsconfig.json ./
COPY services/<nome>/src/ ./src/
RUN npx tsc

FROM node:22-alpine
WORKDIR /app/services/<nome>
COPY services/<nome>/package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/services/<nome>/dist ./dist
EXPOSE <porta>
CMD ["node", "dist/services/<nome>/src/index.js"]
```

## Troubleshooting

### Ollama non risponde

```bash
# Verifica che il container sia running
docker compose ps ollama

# Verifica che il modello sia scaricato
docker compose exec ollama ollama list

# Controlla i log
docker compose logs ollama
```

### "HMAC signature invalid"

- Verifica che `hmacSecret` in `clients.json` corrisponda a `AI_GATEWAY_HMAC_SECRET` nel caller
- Verifica che l'orologio della macchina sia sincronizzato (drift max 5 minuti)

### "Client does not have permission"

- Verifica che il servizio richiesto sia nell'array `permissions` del client in `clients.json`

### Rate limit raggiunto

- Controlla il `maxPerMinute` del client in `clients.json`
- Per lo sviluppo, usa un client con limiti piu alti (es. 120/min)
