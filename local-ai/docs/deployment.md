# Deployment

## Architettura di deployment

```
┌──────────────────────────────┐
│  VPS (OVH)                   │
│  unified-backend             │
│    → AI_GATEWAY_URL=ngrok    │
│    → AI_GATEWAY_CLIENT_ID    │
│    → AI_GATEWAY_API_KEY      │
│    → AI_GATEWAY_HMAC_SECRET  │
└────────────┬─────────────────┘
             │ HTTPS (ngrok tunnel)
             ▼
┌──────────────────────────────┐
│  Macchina locale             │
│  ngrok (:9000 → URL pubblica)│
│    → local-ai gateway        │
│    → botai, ollama, ecc     │
└──────────────────────────────┘
```

local-ai gira sulla macchina locale. Il VPS lo raggiunge tramite un tunnel ngrok persistente. Il gateway autentica ogni richiesta con API key e, opzionalmente, HMAC.

## Prerequisiti per il deployment

- Docker e Docker Compose sulla macchina locale
- Account ngrok (piano gratuito funziona, piano a pagamento consigliato per URL persistente)
- Almeno 8GB di RAM e 10GB di spazio disco
- La macchina deve restare accesa e connessa a internet

## Setup passo-passo

### 1. Configurare local-ai

```bash
cd local-ai
cp .env.example .env
cp clients.json.example clients.json
```

Editare `clients.json` con chiavi reali:

```bash
openssl rand -hex 32   # → apiKey per tpn-prod
openssl rand -hex 32   # → hmacSecret per tpn-prod
openssl rand -hex 32   # → apiKey per tpn-dev
```

### 2. Avviare lo stack

```bash
docker compose up -d
docker compose exec ollama ollama pull mistral:7b-instruct
```

Verificare:

```bash
curl http://localhost:9000/health
```

### 3. Configurare ngrok

Editare `ngrok.yml` con il proprio `authtoken`:

```yaml
version: "3"
agent:
  authtoken: <il-tuo-authtoken>
tunnels:
  ai-gateway:
    addr: 9000
    proto: http
```

Per un URL persistente (piano a pagamento ngrok), aggiungere `domain`:

```yaml
tunnels:
  ai-gateway:
    addr: 9000
    proto: http
    domain: your-subdomain.ngrok-free.dev
```

Avviare il tunnel:

```bash
make ngrok
# oppure
ngrok start --config ngrok.yml ai-gateway
```

Annotare l'URL pubblico (es. `https://xxx.ngrok-free.dev`).

### 4. Configurare unified-backend (VPS)

Nel file `.env` del VPS, aggiungere:

```bash
AI_GATEWAY_URL=https://xxx.ngrok-free.dev
AI_GATEWAY_CLIENT_ID=tpn-prod
AI_GATEWAY_API_KEY=<stessa-apiKey-di-tpn-prod-nel-local-ai>
AI_GATEWAY_HMAC_SECRET=<stesso-hmacSecret-di-tpn-prod-nel-local-ai>
AI_GATEWAY_WEBHOOK_SECRET=<segreto-per-callback-da-local-ai>
```

Le chiavi **devono corrispondere** a quelle nel `clients.json` di local-ai.

Riavviare unified-backend:

```bash
pm2 restart unified-backend
```

### 5. Verificare l'integrazione

Dal VPS:

```bash
curl https://xxx.ngrok-free.dev/health
```

Deve rispondere con `"status": "healthy"`.

## Mantenere il servizio attivo

### Avvio automatico al boot

Creare un servizio systemd o usare un process manager. Esempio con un semplice script:

```bash
#!/bin/bash
cd /path/to/tenpennynovels/local-ai
docker compose up -d
sleep 10
ngrok start --config ngrok.yml ai-gateway &
```

### Monitoraggio

- `docker compose ps` — stato dei container
- `docker compose logs -f gateway` — log del gateway
- `curl http://localhost:9000/health` — health check locale

### Aggiornamenti

```bash
cd local-ai

# Pull nuove immagini base
docker compose pull

# Ricostruire i servizi (multi-stage build, il context e la root di local-ai/)
docker compose build

# Riavviare
docker compose up -d

# Pull di nuovi modelli (se necessario)
docker compose exec ollama ollama pull mistral:7b-instruct
```

La build Docker usa multi-stage: lo stage `builder` compila TypeScript con tutte le dipendenze, lo stage finale contiene solo il codice compilato e le dipendenze di produzione. Vedi [setup.md](setup.md#struttura-del-dockerfile) per i dettagli sulla struttura dei Dockerfile.

## Aggiungere un nuovo client

Per consentire a un altro servizio/utente di usare local-ai:

1. Generare una nuova API key: `openssl rand -hex 32`
2. Aggiungere il client all'array in `clients.json`:

```json
{
  "id": "altro-servizio",
  "name": "Altro Servizio",
  "apiKey": "<nuova-chiave>",
  "permissions": ["botai"],
  "rateLimit": { "maxPerMinute": 10 }
}
```

3. Riavviare il gateway: `docker compose restart gateway`
   (il file e montato come volume, non serve rebuild)
4. Comunicare al nuovo client: URL ngrok, API key, client ID

Non serve modificare codice. Solo configurazione.

## Limiti e considerazioni

### Performance

- Ollama usa la CPU se non c'e una GPU compatibile. I tempi di risposta variano da 1 a 15 secondi a seconda dell'hardware
- Il modello `mistral:7b-instruct` richiede ~4GB di RAM durante l'inferenza
- Per hardware piu potente, considerare modelli piu grandi (`mistral:latest`, `llama3:8b`)

### Disponibilita

- Se la macchina locale si spegne o perde connessione, il servizio e irraggiungibile
- unified-backend gestisce questa eventualita con graceful degradation: nessuna risposta bot, Q&A restituisce solo risultati di ricerca
- Non e un single point of failure per il gioco: il gioco funziona comunque, solo senza risposte AI

### Sicurezza ngrok

- Il piano gratuito di ngrok cambia URL a ogni riavvio. Usare un piano a pagamento per URL persistente
- ngrok ispeziona il traffico per impostazione predefinita. Per dati sensibili, considerare alternative (es. Cloudflare Tunnel)
- Le richieste sono protette da API key + HMAC, quindi anche se l'URL ngrok viene scoperto, senza le chiavi non si puo fare nulla

### Backup

I dati dei bot (definizioni, memorie, relazioni) sono nel volume Docker `mongo_data`. Per backup:

```bash
docker compose exec mongodb mongodump --db local-ai --out /dump
docker cp <container-id>:/dump ./backup-$(date +%Y%m%d)
```
