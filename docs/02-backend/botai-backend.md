# Local AI Platform

**Navigation**: [Home](../INDEX.md) > [Backend](./README.md) > Local AI Platform

**Status**: ✅ Active | **Last Updated**: 2026-03-08 | **Version**: 2.0

Piattaforma AI locale indipendente per NPC bot, Q&A su documenti, e generazione immagini (futura).

---

## Overview

**Local AI** è una piattaforma standalone (`local-ai/`) che fornisce servizi AI locali tramite Ollama. Non ha accesso al database del gioco, non chiama il game-backend, non importa tipi da unified-backend.

**Principio**: il mondo esterno gli dice cosa fare, lui lo fa.

**Key Features**:
- ✅ **Bot NPC con Ollama**: Risposte generate localmente (zero costi API)
- ✅ **Q&A RAG**: Risposte a domande basate su contesto fornito dal caller
- ✅ **Gateway sicuro**: Dual-port, HMAC, API key, rate limiting, zod validation
- ✅ **Completamente indipendente**: Avviabile standalone con `docker compose up`
- 🔜 **Image Generation**: Stub per item, location, avatar (futura implementazione)

---

## Architecture

### Flusso Unidirezionale

```
unified-backend (VPS)           local-ai (locale via ngrok)
┌──────────────────┐           ┌─────────────────────────────┐
│  Conosce il gioco│           │  Non sa nulla del gioco     │
│  Raccoglie ctx   │──────────►│  Gateway (:9000/:9001)      │
│  Firma HMAC      │  contesto │    ├── BotAI (:8080)        │
│                  │  completo │    ├── Q&A (:8090)           │
│  Callback URL    │◄──────────│    └── Ollama (:11434)      │
│  riceve risposta │  callback │                             │
└──────────────────┘           └─────────────────────────────┘
```

### Differenze dalla v1 (vecchio botai-backend)

| Aspetto | v1 (Archivio) | v2 (Local AI) |
|---------|---------------|---------------|
| LLM | Claude API (a pagamento, rimosso) | Ollama locale (gratuito) |
| Dipendenze | Chiamava game-backend | Zero dipendenze esterne |
| Contesto | Andava a cercare nel DB gioco | Riceve tutto dal caller |
| Sicurezza | Header spoofabile | Dual-port + HMAC + API key |
| Architettura | Monolite | Microservizi con gateway |

---

## Servizi

### Gateway (porta 9000/9001)

Entry point con:
- **Porta 9000** (0.0.0.0): Produzione via ngrok, richiede HMAC
- **Porta 9001** (127.0.0.1): Solo sviluppo locale, no HMAC
- Service registry con auto-routing
- Zod validation su tutti i payload
- Rate limiting differenziato per endpoint

### BotAI (porta 8080)

Genera risposte NPC con Ollama:
- `POST /respond`: Riceve contesto completo, genera risposta
- `POST /bots`: CRUD bot
- `POST /bots/generate`: Genera bot con AI
- MongoDB dedicato per bot, memorie, relazioni

### Q&A (porta 8090)

RAG senza dipendenze da search engine:
- `POST /ask`: Riceve domanda + contesto (chunks), genera risposta
- Il caller si occupa della ricerca semantica

### Stub Image Gen (porte 8100/8110/8120)

Struttura pronta, endpoint che rispondono 501:
- `item-image-gen`: Immagini oggetti
- `location-image-gen`: Immagini location
- `avatar-gen`: Avatar personaggi

---

## API Contracts

### POST /botai/respond

```bash
curl -X POST http://localhost:9001/botai/respond \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "uuid",
    "bot": { "id": "bot-id", "name": "Detective Morrison" },
    "context": {
      "location": { "id": "loc-123", "name": "The Rusty Anchor Pub" },
      "triggeringAction": {
        "characterName": "John Smith",
        "content": "*entra nel pub* Buonasera"
      }
    }
  }'
```

Con callback (async):
- Risposta immediata: `202 Accepted`
- Callback alla URL fornita con risposta completa

Senza callback (sync):
- Risposta diretta con testo generato

### POST /qa/ask

```bash
curl -X POST http://localhost:9001/qa/ask \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Come funzionano le armi da fuoco?",
    "context": [
      { "heading": "Armi", "content": "Le armi richiedono..." }
    ]
  }'
```

---

## Setup

### Avvio Standalone

```bash
cd local-ai
cp .env.example .env
# Editare .env con segreti reali

docker compose up -d
docker compose exec ollama ollama pull mistral:7b-instruct

# Verifica
curl http://localhost:9001/health
```

### Variabili d'ambiente

| Variabile | Descrizione |
|-----------|-------------|
| `OLLAMA_URL` | URL Ollama (`http://ollama:11434`) |
| `OLLAMA_MODEL` | Modello (`mistral:7b-instruct`) |
| `MONGODB_URI` | MongoDB interno local-ai |
| `HMAC_SECRET` | Segreto condiviso per firma HMAC |
| `API_KEY` | API key per autenticazione |
| `GATEWAY_PROD_PORT` | Porta produzione (9000) |
| `GATEWAY_DEV_PORT` | Porta sviluppo (9001) |

### Variabili per unified-backend

| Variabile | Descrizione |
|-----------|-------------|
| `AI_GATEWAY_URL` | URL ngrok del gateway |
| `AI_GATEWAY_HMAC_SECRET` | Segreto condiviso per firma |
| `AI_GATEWAY_API_KEY` | API key |
| `AI_GATEWAY_WEBHOOK_SECRET` | Auth per callback |

---

## Related Documentation

- [Embeddings Architecture](../04-ai-ml/embeddings-architecture.md) - Sistema di ricerca semantica
- [Unified Backend](./unified-backend-architecture.md) - Integrazione con game backend
- Vecchia documentazione: `_archive/botai-backend/`
