---
name: generate-bot
description: Generate AI bots for locations. Use when you need to create NPC bots, populate a location with characters, or activate bot system for a location.
user-invocable: true
---

## Overview
Generate AI-powered NPC bots for a specific location. Creates bots via the Local AI gateway's BotAI service (Ollama-powered, zero API costs).

## Usage Pattern
/generate-bot [location_name] [num_bots]

Parameters:
- **location_name**: Exact name of the location (e.g., "Borough Market", "The Blind Beggar")
- **num_bots**: Number of bots to generate (positive integer)

Examples:
- /generate-bot "Borough Market" 3
- /generate-bot "The Blind Beggar" 5

## Architecture

The bot generation now uses the **Local AI platform** (`local-ai/`):

```
unified-backend (or CLI script)
  → AI Gateway (:9001 dev / :9000 prod via ngrok)
    → BotAI service (:8080)
      → Ollama (mistral:7b-instruct)
```

### API Endpoints

- **Gateway Health**: `GET http://localhost:9001/health`
- **Generate Bot**: `POST http://localhost:9001/botai/bots/generate`
- **Create Bot**: `POST http://localhost:9001/botai/bots`
- **List Bots**: `GET http://localhost:9001/botai/bots`

### Authentication

All requests require `X-API-Key` header with the value from `local-ai/.env` → `API_KEY`.

### Generate Bot API

```bash
curl -X POST http://localhost:9001/botai/bots/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "description": "Un barista irlandese, veterano di guerra, con un segreto oscuro",
    "style": "vittoriano",
    "locale": "it"
  }'
```

### Create Bot Manually

```bash
curl -X POST http://localhost:9001/botai/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "name": "Detective Morrison",
    "personality": {
      "traits": ["cinico", "osservatore", "solitario"],
      "speech_style": "frasi brevi, tono asciutto",
      "background": "Ex poliziotto, investigatore privato"
    },
    "systemPrompt": "Sei Detective Morrison, un investigatore privato..."
  }'
```

## Prerequisites

1. **Local AI stack running**: `cd local-ai && docker compose up -d`
2. **Ollama model pulled**: `docker compose exec ollama ollama pull mistral:7b-instruct`
3. **Verify health**: `curl http://localhost:9001/health`

## After Creating Bots

1. Set `bot_enabled: true` on the location in the game database
2. Associate bot character IDs with the location
3. The bot will respond automatically when players interact in the location

## MongoDB

Bot data is stored in the **local-ai MongoDB** (port 27030), NOT the game database:
- Database: `local-ai`
- Collections: `bots`, `memories`, `relationships`

## Environment Variables

Located in `local-ai/.env`:
- `API_KEY`: API key for gateway authentication
- `OLLAMA_MODEL`: LLM model (default: `mistral:7b-instruct`)
- `MONGODB_URI`: Internal MongoDB connection

## Related Files
- Local AI platform: `local-ai/`
- BotAI service: `local-ai/services/botai/`
- Gateway: `local-ai/gateway/`
- Old archived code: `_archive/botai-backend/`
