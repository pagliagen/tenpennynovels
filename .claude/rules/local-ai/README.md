---
category: AI Services
scope: local-ai monorepo
related:
  - ../docker-deployment.md
  - ../services/shared-backend.md
  - ../02-node-environment.md
  - ./shared-patterns.md
---

# Local AI Services Architecture

## Overview

Monorepo of 2 independent AI microservices built with Express 4 + TypeScript, running in Docker containers. Services communicate via HTTP callbacks and use Ollama (LLM locale) come provider di default, con Inception come alternativa opzionale via `AI_PROVIDER=inception`.

**Nota**: il servizio Q&A ("Bibliotecario", RAG per la ricerca semantica dei documenti) NON vive più qui — è stato spostato in `services/embeddings-worker` (endpoint `/ask`, `/extract-keywords`, `/extract-insight`) perché è una feature di produzione del sito, non più parte della sandbox AI esterna. Vedi [services/embeddings-worker.md](../services/embeddings-worker.md).

## Services

### 1. BotAI Service (Port 8080)

**Purpose**: Character AI interactions with sophisticated 4-step pipeline

**Features**:
- Context analysis with character state
- Response generation with temperature control
- Self-critique and refinement
- Post-analysis with memory storage
- Relationship tracking (trust, familiarity, sentiment)
- Active emotions and mood management

**Endpoints**:
- `POST /interact` - Process character interaction (202 Accepted)
- `GET /health` - Health check

**Processing**: Sequential queue (p-queue concurrency: 1), background processing with callback on completion

### 2. Character Gen Service (Port 8130)

**Purpose**: Character generation with background processing

**Features**:
- Sequential character creation
- Queue status tracking
- Callback-based delivery

**Endpoints**:
- `POST /generate` - Generate character (202 Accepted)
- `GET /health` - Health check
- `GET /queue-status` - Current queue size

## Architecture

### Monorepo Structure

```
local-ai/
├── shared/                    # Shared utilities
│   ├── logger.ts             # Winston logging
│   ├── health.ts             # Health check utilities
│   └── ...
├── services/
│   ├── botai/                # Port 8080
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes.ts
│   │   │   ├── callback/CallbackSender.ts
│   │   │   ├── context/ContextAnalyzer.ts
│   │   │   ├── agents/AgentFactory.ts
│   │   │   ├── refine/ResponseRefiner.ts
│   │   │   └── analysis/PostResponseAnalyzer.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   └── character-gen/        # Port 8130
└── tsconfig.base.json
```

### Docker Network

**Bridge**: `tenpennynovels_default` (connects to main project)

**Gateway**: Port 9000 (API gateway for external access)

**Internal Communication**:
- Services call unified-backend: `http://unified-backend:3001` (porta reale del servizio, NON 4001 che è la game app)
- Main project calls AI services: `http://botai:8080`, etc.

### LLM Selection

**Environment-Based** (`AI_PROVIDER` env var, default `ollama`):
- `AI_PROVIDER=ollama` (default) → OllamaAgent, LLM locale
- `AI_PROVIDER=inception` → InceptionAgent (richiede `INCEPTION_API_KEY`)

**Dual-model (solo botai)**: ruolo creativo (dialoghi, generazione bot) e ruolo analitico (context analysis, JSON strutturato) possono usare modelli Ollama diversi tramite `OLLAMA_MODEL` (creativo) e `OLLAMA_ANALYTICAL_MODEL` (analitico, fallback su `OLLAMA_MODEL`).

**AgentFactory Pattern**: Singleton provides IAgent interface abstraction

**Configuration**:
```typescript
// Automatic selection via AgentFactory
const agent = getCreativeAgent(); // o getAnalyticalAgent()
const response = await agent.generateText(prompt, config);
```

## Core Patterns

All services share common patterns documented in `shared-patterns.md`:

1. **p-queue Sequential Processing** - FIFO queue with concurrency: 1
2. **Express + TypeScript Setup** - Standard server initialization
3. **Winston Logging** - Shared logger configuration
4. **Health Endpoints** - Standardized health checks
5. **Callback Patterns with Retry** - MAX_RETRIES=2, hostname whitelist
6. **Docker Multi-Stage Builds** - Builder + runtime stages
7. **Agent Abstraction** - Ollama/Inception interface
8. **202 Accepted Pattern** - Immediate response, background processing

See [shared-patterns.md](./shared-patterns.md) for complete implementation details.

## Development

### Environment Variables

**BotAI**:
```bash
PORT=8080
UNIFIED_BACKEND_URL=http://unified-backend:3001
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=gemma3:12b            # ruolo creativo
OLLAMA_ANALYTICAL_MODEL=qwen3:8b   # ruolo analitico (opzionale, fallback su OLLAMA_MODEL)
CALLBACK_ALLOWED_HOSTS=unified-backend,localhost
```

**Character Gen**:
```bash
PORT=8130
UNIFIED_BACKEND_URL=http://unified-backend:3001
OLLAMA_ANALYTICAL_MODEL=qwen3:8b
```

### Local Development

```bash
# Build service
cd services/botai
npm install
npx tsc

# Run
npm start

# Or with Docker
docker-compose up botai
```

### Testing

```bash
# Health check
curl http://localhost:8080/health

# Interaction (returns 202 Accepted)
curl -X POST http://localhost:8080/interact \
  -H "Content-Type: application/json" \
  -d '{"characterId":"...", "message":"Hello", "callbackUrl":"..."}'
```

## Deployment

### Docker Compose

Services defined in main project's `docker-compose.yml`:

```yaml
services:
  botai:
    build:
      context: ./local-ai
      dockerfile: services/botai/Dockerfile
    ports:
      - "8080:8080"
    networks:
      - tenpennynovels_default
    environment:
      - OLLAMA_URL=http://ollama:11434
      - OLLAMA_MODEL=gemma3:12b
```

### Build & Deploy

```bash
# Build specific service
docker-compose build botai

# Update running service (stop + up, not restart)
docker-compose stop botai
docker-compose up -d botai

# View logs
docker-compose logs -f botai
```

## Key Implementation Files

**Shared Utilities**:
- `/local-ai/shared/logger.ts` - Winston logging configuration
- `/local-ai/shared/health.ts` - Health check utilities

**BotAI Core**:
- `/local-ai/services/botai/src/routes.ts` - p-queue pattern, endpoints
- `/local-ai/services/botai/src/callback/CallbackSender.ts` - Retry logic
- `/local-ai/services/botai/src/agents/AgentFactory.ts` - LLM selection
- `/local-ai/services/botai/Dockerfile` - Multi-stage build

## Cross-References

- **Docker patterns**: [../docker-deployment.md](../docker-deployment.md)
- **Backend integration**: [../services/shared-backend.md](../services/shared-backend.md)
- **Node environment**: [../02-node-environment.md](../02-node-environment.md)
- **Implementation patterns**: [./shared-patterns.md](./shared-patterns.md)

## When to Use shared-patterns.md

Consult `shared-patterns.md` when:
- Implementing new AI service endpoints
- Adding callback functionality
- Setting up Docker builds
- Configuring logging
- Implementing queue-based processing
- Creating health checks
- Switching between Ollama and Inception
- Understanding the BotAI 4-step pipeline
