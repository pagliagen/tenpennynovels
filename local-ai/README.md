# Local AI

Piattaforma AI locale e indipendente per TenPennyNovels. Genera risposte NPC e (in futuro) immagini — tutto con modelli locali, zero costi cloud. Il Q&A ("Bibliotecario") per la ricerca semantica dei documenti NON vive più qui: è in `services/embeddings-worker`, come feature di produzione del sito.

## Principio fondamentale

```
local-ai NON SA NULLA del gioco.
Riceve contesto, lo elabora, restituisce risultati.
Nessuna dipendenza dal database o dal backend del gioco.
```

## Quick Start

```bash
# 1. Configurare
cp .env.example .env
cp clients.json.example clients.json
# Editare clients.json con le proprie API key

# 2. Avviare
docker compose up -d

# 3. Scaricare il modello
docker compose exec ollama ollama pull mistral:7b-instruct

# 4. Verificare
curl http://localhost:9000/health | python3 -m json.tool

# 5. Test UI (opzionale)
docker compose --profile test up -d test-ui
# Aprire http://localhost:3100 nel browser
```

## Servizi

| Servizio | Porta | Stato | Descrizione |
|----------|-------|-------|-------------|
| Gateway | 9000 | Attivo | Entry point, sicurezza, routing |
| BotAI | 8080 | Attivo | NPC bot con memoria e relazioni |
| Item Image Gen | 8100 | Stub | Generazione immagini oggetti |
| Location Image Gen | 8110 | Stub | Generazione immagini location |
| Avatar Gen | 8120 | Stub | Generazione avatar personaggi |
| Test UI | 3100 | Profilo `test` | App React per test interattivi |

## Architettura

```
Browser/Client → Gateway (:9000) → Servizi → Ollama
                    │
                    ├── Auth (API key + HMAC opzionale)
                    ├── Rate limiting per-client
                    ├── Validazione Zod
                    └── Proxy ai servizi
```

Tutte le richieste a `POST /botai/respond` e `POST /botai/bots/generate` sono **asincrone**: il gateway risponde `202 Accepted` immediatamente, e il risultato arriva via callback. Le richieste vengono serializzate in una coda interna (Ollama processa una alla volta).

## Test UI

Servizio separato (React + Express) per testare bot e chat in modo visuale:

```bash
# Avviare
docker compose --profile test up -d test-ui

# Aprire http://localhost:3100
```

Consente di:

- Generare bot con Ollama (descrizione + location)
- Chattare in modo asincrono (risposte via SSE in real-time)
- Caricare bot esistenti e visualizzarne i dettagli

## Documentazione

La documentazione completa e in [`docs/`](docs/):

- [Architettura](docs/architecture.md) — Principi, struttura, scelte tecniche
- [Sicurezza](docs/security.md) — Autenticazione multi-client, HMAC, rate limiting
- [API Reference](docs/api-reference.md) — Endpoint, payload, risposte
- [Setup e Sviluppo](docs/setup.md) — Installazione, configurazione, sviluppo locale
- [Deployment](docs/deployment.md) — Messa in produzione con ngrok

## Stack tecnologico

- **Runtime**: Node.js 22, TypeScript
- **LLM**: Ollama con `mistral:7b-instruct`
- **Database**: MongoDB 7 (dati interni: bot, memorie, relazioni)
- **Gateway**: Express + http-proxy-middleware
- **Validazione**: Zod
- **Coda**: p-queue (concurrency 1 per Ollama)
- **Container**: Docker Compose, multi-stage build
- **Tunnel**: ngrok per esposizione pubblica
