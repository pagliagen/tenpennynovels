# Docker Compose Infrastructure

**Navigation**: [Home](../INDEX.md) > [Infrastructure](./README.md) > Docker Compose

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-01

Documentazione completa dell'infrastruttura Docker Compose di TenPennyNovels con 7 servizi containerizzati.

---

## Overview

TenPennyNovels utilizza **Docker Compose** per orchestrare tutti i servizi in un'unica rete containerizzata. Questo approccio garantisce:

- **Isolamento completo**: Ogni servizio in container dedicato
- **Networking semplificato**: Comunicazione via hostname Docker
- **Deployment consistente**: Identico in dev/staging/production
- **Hot-reload in development**: Volumi montati per tsx watch
- **Health checks integrati**: Monitoraggio automatico stato servizi

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    tenpennynovels-network                       │
│                     (Docker Bridge Network)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐       │
│  │   MongoDB    │   │    Redis     │   │   Qdrant     │       │
│  │   (27017)    │   │   (6379)     │   │   (6333)     │       │
│  │  Persistence │   │   Cache +    │   │   Vector     │       │
│  │   Database   │   │   PubSub     │   │   Search     │       │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘       │
│         │                  │                   │                │
│  ┌──────┴───────────────────┴───────────────────┴───────┐      │
│  │                                                       │      │
│  │            Embeddings Service (Flask 5001)           │      │
│  │      paraphrase-multilingual-MiniLM-L12-v2           │      │
│  │                                                       │      │
│  └──────┬────────────────────────────────────────────────┘      │
│         │                                                       │
│  ┌──────┴────────────┐   ┌─────────────────────────────┐      │
│  │ Embeddings Worker │   │    Unified Backend (3001)   │      │
│  │  (Bull Queue)     │   │  ┌──────────────────────┐   │      │
│  │                   │   │  │ auth   │ game        │   │      │
│  └───────────────────┘   │  │ admin  │ documents   │   │      │
│                          │  │ forum  │ tickets     │   │      │
│                          │  └──────────────────────┘   │      │
│                          └──────────┬──────────────────┘      │
│                                     │                          │
│                          ┌──────────┴──────────────────┐      │
│                          │   API Gateway (8000)        │      │
│                          │   - Proxy routing           │      │
│                          │   - CORS handling           │      │
│                          │   - Rate limiting           │      │
│                          │   - WebSocket upgrade       │      │
│                          └─────────────────────────────┘      │
│                                     │                          │
└─────────────────────────────────────┼──────────────────────────┘
                                      │
                                 Internet
                             (HTTPS via Nginx)
```

---

## Services Overview

### 1. MongoDB (Port 27017)

**Image**: `mongo:7.0`
**Container**: `tenpennynovels-mongodb`
**Purpose**: Database principale per tutti i dati persistenti

**Configuration**:
```yaml
environment:
  MONGO_INITDB_ROOT_USERNAME: admin
  MONGO_INITDB_ROOT_PASSWORD: <secure-password>
  MONGO_INITDB_DATABASE: tenpennynovels
volumes:
  - mongodb_data:/data/db
  - mongodb_config:/data/configdb
healthcheck:
  test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 40s
```

**Collections**: 44+ schemas (users, characters, locations, documents, messages, etc.)
**Indexes**: Ottimizzati per query frequenti (slug, characterId, userId)
**Auth**: Sempre abilitato in production (`--auth`)

**Details**: [MongoDB Schemas](./mongodb-schemas.md)

---

### 2. Redis (Port 6379)

**Image**: `redis:7.2-alpine`
**Container**: `tenpennynovels-redis`
**Purpose**: Sessioni utenti, WebSocket adapter, event pub/sub, cache

**Configuration**:
```yaml
command: redis-server --appendonly yes
volumes:
  - redis_data:/data
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
```

**Use Cases**:
- **Session Store**: JWT token storage
- **Socket.IO Adapter**: Multi-instance WebSocket sync
- **Bull Queue**: Job queue per embeddings worker
- **Pub/Sub Channels**:
  - `character:updated`
  - `location:action`
  - `document:created`
  - `embedding:requested`

**Persistence**: AOF (Append-Only File) abilitato

**Details**: [Redis Pub/Sub](./redis-pubsub.md)

---

### 3. Qdrant (Port 6333)

**Image**: `qdrant/qdrant:v1.17.0`
**Container**: `tenpennynovels-qdrant`
**Purpose**: Vector database per semantic search

**Configuration**:
```yaml
ports:
  - "6333:6333"  # HTTP API
  - "6334:6334"  # gRPC (optional)
volumes:
  - qdrant_storage:/qdrant/storage
healthcheck:
  test: ["CMD", "sh", "-c", "nc -z localhost 6333 || exit 1"]
```

**Collections**:
- `documents` - 384D vectors per semantic search documenti
- Future: `characters`, `locations`

**Performance**: ANN search < 100ms con 1000+ documenti

**Details**: [Qdrant Vector DB](./qdrant-vector-db.md)

---

### 4. Embeddings Service (Port 5001)

**Build**: `./services/embeddings-service/Dockerfile`
**Container**: `tenpennynovels-embeddings-service`
**Purpose**: Flask service per generazione embeddings

**Configuration**:
```yaml
environment:
  EMBEDDINGS_SERVICE_HOST: 0.0.0.0
  EMBEDDINGS_SERVICE_PORT: 5001
  EMBEDDINGS_MODEL: paraphrase-multilingual-MiniLM-L12-v2
  LOG_LEVEL: INFO
```

**Model**: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
**Dimension**: 384D
**Languages**: Multilingual (EN, IT, FR, DE, ES, etc.)
**Performance**: ~50ms per embedding (cached), ~1.5s (first time)

**API Endpoints**:
- `POST /embed` - Generate embedding da testo
- `GET /health` - Health check

**Details**: [Embeddings Architecture](../04-ai-ml/embeddings-architecture.md)

---

### 5. Embeddings Worker (No exposed port)

**Build**: `./services/embeddings-worker/Dockerfile`
**Container**: `tenpennynovels-embeddings-worker`
**Purpose**: Async worker per processing embeddings via Bull queue

**Configuration**:
```yaml
environment:
  MONGODB_URI: mongodb://admin:password@mongodb:27017/tenpennynovels?authSource=admin
  REDIS_URL: redis://redis:6379
  EMBEDDINGS_SERVICE_URL: http://embeddings-service:5001
  QDRANT_URL: http://qdrant:6333
depends_on:
  - mongodb (condition: service_healthy)
  - redis (condition: service_healthy)
  - embeddings-service (condition: service_healthy)
```

**Job Processing**:
- **Queue**: Bull (Redis-backed)
- **Concurrency**: 5 jobs paralleli
- **Retry**: 3 tentativi con exponential backoff
- **Cache**: Redis 1h per risultati

**Event Subscriptions**:
- `document:created` → genera embedding + store in Qdrant
- `document:updated` → rigenera embedding
- `character:updated` → aggiorna vector (future)

---

### 6. Unified Backend (Port 3001)

**Build**: `./services/unified-backend/Dockerfile.dev`
**Container**: `tenpennynovels-unified-backend`
**Purpose**: Backend principale con tutti i moduli

**Modules**:
```
src/modules/
├── auth/         - Authentication, registration, password reset
├── game/         - Characters, locations, housing, messaging
├── admin/        - Character approval, user management
├── forum/        - Forum posts, threads
├── documents/    - Document management, semantic search
└── tickets/      - Support tickets
```

**Configuration**:
```yaml
environment:
  NODE_ENV: development
  PORT: 3001
  MONGODB_URI: mongodb://admin:password@mongodb:27017/tenpennynovels?authSource=admin
  REDIS_URL: redis://redis:6379
  QDRANT_URL: http://qdrant:6333
  EMBEDDINGS_SERVICE_URL: http://embeddings-service:5001
  JWT_SECRET: <secure-secret>
  JWT_REFRESH_SECRET: <secure-secret>
volumes:
  # Hot-reload setup
  - ./services/unified-backend/src:/app/src:ro
  - ./services/unified-backend/node_modules:/app/node_modules:ro
```

**Tech Stack**:
- **Framework**: Express 5.2.1
- **Database**: Mongoose 9.2.1
- **WebSocket**: Socket.IO 4.8.3
- **Queue**: Bull 4.x
- **Hot-reload**: tsx watch (development)

**API Routes**:
- `/auth/*` - Authentication endpoints
- `/game/*` - Game logic endpoints
- `/admin/*` - Admin panel endpoints
- `/forum/*` - Forum endpoints
- `/game/documents/*` - Document management

**Details**: [Unified Backend Architecture](../02-backend/unified-backend-architecture.md)

---

### 7. API Gateway (Port 8000)

**Build**: `./services/api-gateway/Dockerfile`
**Container**: `tenpennynovels-api-gateway`
**Purpose**: Single entry point, proxy routing, CORS, rate limiting

**Configuration**:
```yaml
environment:
  PORT: 8000
  UNIFIED_BACKEND_URL: http://unified-backend:3001
  GAME_URL: http://localhost:4001
  LANDING_URL: http://localhost:4000
  DOCUMENTS_URL: http://localhost:4003
  MANAGEMENT_URL: http://localhost:4004
  TRUST_PROXY: "true"
depends_on:
  - unified-backend (condition: service_healthy)
```

**Proxy Routes**:
```typescript
/auth/* → http://unified-backend:3001/auth/*
/game/* → http://unified-backend:3001/game/*
/admin/* → http://unified-backend:3001/admin/*
/forum/* → http://unified-backend:3001/forum/*
/documents/* → http://unified-backend:3001/game/documents/*
/socket.io/* → http://unified-backend:3001/socket.io/* (WebSocket)
```

**Features**:
- **CORS**: Whitelist frontend origins
- **Rate Limiting**: 30 req/min (unauth), 120 req/min (auth)
- **WebSocket Upgrade**: Proxy Socket.IO handshake
- **Health Checks**: Aggregati da tutti backend
- **Error Handling**: 502 se backend unavailable

**Details**: [API Gateway](../02-backend/api-gateway.md)

---

## Network Configuration

**Network Name**: `tenpennynovels-network`
**Driver**: Bridge
**Purpose**: Isolamento servizi con DNS automatico

**Internal DNS**:
```
mongodb:27017          → tenpennynovels-mongodb
redis:6379             → tenpennynovels-redis
qdrant:6333            → tenpennynovels-qdrant
embeddings-service:5001 → tenpennynovels-embeddings-service
unified-backend:3001   → tenpennynovels-unified-backend
api-gateway:8000       → tenpennynovels-api-gateway
```

**Host Access** (via port mapping):
```
localhost:27017 → MongoDB
localhost:6379  → Redis
localhost:6333  → Qdrant
localhost:5001  → Embeddings Service
localhost:3001  → Unified Backend
localhost:8000  → API Gateway (PUBLIC ENTRY POINT)
```

---

## Volumes

**Persistent Storage**:

```yaml
volumes:
  mongodb_data:
    driver: local
    name: tenpennynovels-mongodb-data
    # Location: /var/lib/docker/volumes/tenpennynovels-mongodb-data/_data

  mongodb_config:
    driver: local
    name: tenpennynovels-mongodb-config

  redis_data:
    driver: local
    name: tenpennynovels-redis-data

  qdrant_storage:
    driver: local
    name: tenpennynovels-qdrant-storage
```

**Development Hot-Reload Volumes** (unified-backend):
```yaml
volumes:
  - ./services/unified-backend/src:/app/src:ro         # Source code (read-only)
  - ./services/unified-backend/node_modules:/app/node_modules:ro  # Dependencies
  - ./services/unified-backend/logs:/app/logs          # Logs (read-write)
```

**Why `node_modules:ro`?**
- Host node_modules contiene tutte le dependencies (incluse devDependencies)
- Container può usare tsx watch senza rebuilding
- Read-only previene modifiche accidentali da container

---

## Commands Reference

### Start All Services

```bash
# Development (with hot-reload)
docker compose up -d

# Production (no dev dependencies)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View logs (follow)
docker compose logs -f

# View logs for specific service
docker compose logs -f unified-backend
```

---

### Stop Services

```bash
# Stop all services (keep volumes)
docker compose down

# Stop and remove volumes (DESTRUCTIVE!)
docker compose down -v

# Stop specific service
docker compose stop unified-backend
```

---

### Rebuild Services

```bash
# Rebuild all images
docker compose build

# Rebuild specific service
docker compose build unified-backend

# Rebuild without cache (clean build)
docker compose build --no-cache unified-backend

# After rebuild, recreate containers
docker compose up -d --force-recreate unified-backend
```

**IMPORTANT**: Dopo rebuild, usa `docker compose stop service && docker compose up -d` invece di `restart` per garantire nuovo container.

---

### Health Checks

```bash
# Check all services status
docker compose ps

# Check specific service
docker compose ps unified-backend

# Inspect service health
docker inspect tenpennynovels-unified-backend --format='{{.State.Health.Status}}'

# View health check logs
docker inspect tenpennynovels-unified-backend --format='{{range .State.Health.Log}}{{.Output}}{{end}}'
```

---

### Service Management

```bash
# Restart service
docker compose restart unified-backend

# View service logs (last 100 lines)
docker compose logs --tail=100 unified-backend

# Execute command in container
docker compose exec unified-backend sh
docker compose exec mongodb mongosh -u admin -p password --authenticationDatabase admin

# View container resource usage
docker stats tenpennynovels-unified-backend
```

---

## NPM Scripts Integration

**Package.json shortcuts** (da root del progetto):

```json
{
  "scripts": {
    "docker:all:start": "docker compose up -d",
    "docker:all:stop": "docker compose down",
    "docker:all:restart": "docker compose restart",
    "docker:logs": "docker compose logs -f",
    "docker:check": "./scripts/health-check.sh"
  }
}
```

**Usage**:
```bash
npm run docker:all:start   # Start all services
npm run docker:logs        # Follow all logs
npm run docker:check       # Run health checks
npm run docker:all:stop    # Stop all services
```

---

## Health Check Script

**Location**: `./scripts/health-check.sh`

```bash
#!/bin/bash
# Check all services health

echo "🔍 Checking TenPennyNovels services health..."

# API Gateway
curl -s http://localhost:8000/health | jq '.'

# Unified Backend
curl -s http://localhost:3001/health | jq '.'

# Embeddings Service
curl -s http://localhost:5001/health | jq '.'

# Qdrant
curl -s http://localhost:6333/healthz | jq '.'

# MongoDB
docker exec tenpennynovels-mongodb mongosh \
  --username admin --password ${MONGO_ROOT_PASSWORD} \
  --authenticationDatabase admin \
  --eval "db.adminCommand('ping')"

# Redis
docker exec tenpennynovels-redis redis-cli ping

echo "✅ Health check complete"
```

**Run**: `chmod +x scripts/health-check.sh && ./scripts/health-check.sh`

---

## Troubleshooting

### Service Won't Start

**Symptoms**: Container exits immediately after start

**Check**:
```bash
# View logs
docker compose logs unified-backend

# Check exit code
docker compose ps unified-backend

# Inspect container
docker inspect tenpennynovels-unified-backend
```

**Common Causes**:
- Missing environment variables
- Port conflict (already in use)
- Health check dependency failed
- Node modules mismatch (rebuild needed)

**Solution**:
```bash
# Rebuild service
docker compose build --no-cache unified-backend

# Remove old volumes (CAUTION: data loss)
docker compose down -v
docker compose up -d
```

---

### Port Conflict

**Symptoms**: `Error: bind: address already in use`

**Check**:
```bash
# Find process using port
lsof -i :3001
lsof -i :27017

# Kill process
kill -9 <PID>
```

**Alternative**: Cambia porta in `docker-compose.yml`:
```yaml
ports:
  - "3002:3001"  # Map host 3002 to container 3001
```

---

### Volume Permissions

**Symptoms**: `EACCES: permission denied`

**Solution**:
```bash
# Fix ownership (Linux/Mac)
sudo chown -R $(whoami):$(whoami) ./services/unified-backend/logs

# Or run as root in container (not recommended)
docker compose exec -u root unified-backend chown -R node:node /app/logs
```

---

### Hot-Reload Not Working

**Symptoms**: Code changes non riflessi in container

**Check**:
1. Verifica volume mount: `docker inspect tenpennynovels-unified-backend | grep Mounts -A 20`
2. Verifica tsx watch running: `docker compose logs unified-backend | grep tsx`

**Solution**:
```bash
# Recreate container
docker compose up -d --force-recreate unified-backend

# Or restart manually
docker compose restart unified-backend
```

---

## Production Optimizations

### Resource Limits

**Create**: `docker-compose.prod.yml`

```yaml
services:
  unified-backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G

  mongodb:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
```

**Deploy**:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

### Log Rotation

```yaml
services:
  unified-backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

**Totale log per service**: 30MB (10MB x 3 file)

---

### Restart Policies

```yaml
services:
  unified-backend:
    restart: always  # Always restart (production)
    # or
    restart: unless-stopped  # Restart unless manually stopped
```

**Development**: `restart: unless-stopped`
**Production**: `restart: always`

---

## Related Documentation

- [Environment Variables](./environment-variables.md) - Complete env vars reference
- [MongoDB Schemas](./mongodb-schemas.md) - Database models
- [Redis Pub/Sub](./redis-pubsub.md) - Event channels
- [Unified Backend](../02-backend/unified-backend-architecture.md) - Backend modules
- [API Gateway](../02-backend/api-gateway.md) - Proxy configuration
- [Deployment Guide](../06-operations/deployment-guide.md) - Production deployment
- [Docker Troubleshooting](../06-operations/docker-troubleshooting.md) - Common issues

---

## Quick Reference

**Start**: `docker compose up -d`
**Stop**: `docker compose down`
**Logs**: `docker compose logs -f`
**Health**: `./scripts/health-check.sh`
**Rebuild**: `docker compose build --no-cache SERVICE && docker compose stop SERVICE && docker compose up -d`

**Public Entry Point**: `http://localhost:8000` (API Gateway)
**Network**: `tenpennynovels-network` (bridge)
**Volumes**: 4 persistent (mongodb_data, mongodb_config, redis_data, qdrant_storage)
