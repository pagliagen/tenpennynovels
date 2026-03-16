# Docker Compose Infrastructure

**Navigation**: [Home](../INDEX.md) > [Infrastructure](./README.md) > Docker Compose

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-08

Complete documentation of TenPennyNovels Docker Compose infrastructure with 7 containerized services.

---

## Overview

TenPennyNovels uses **Docker Compose** to orchestrate all services in a single containerized network. This approach provides:

- **Complete isolation**: Each service in dedicated container
- **Simplified networking**: Communication via Docker hostnames
- **Consistent deployment**: Identical in dev/staging/production
- **Hot-reload in development**: Volume mounts for tsx watch
- **Integrated health checks**: Automatic service state monitoring

---

## Architecture Diagram

```mermaid
flowchart TB
    subgraph Internet["Internet"]
        HTTPS["HTTPS via Nginx"]
    end

    subgraph Network["tenpennynovels-network (Docker Bridge)"]
        subgraph DataLayer["Data Layer"]
            MongoDB["MongoDB (27017)"]
            Redis["Redis (6379)"]
            Qdrant["Qdrant (6333/6334)"]
            Elasticsearch["ElasticSearch (9200)"]
        end

        subgraph EmbeddingsLayer["Embeddings Layer"]
            EW["embeddings-worker (5001)"]
        end

        subgraph AppLayer["Application Layer"]
            UB["Unified Backend (3001)"]
            AG["API Gateway (8000)"]
        end

        MongoDB --> EW
        Redis --> EW
        Qdrant --> EW
        Elasticsearch --> EW
        MongoDB --> UB
        Redis --> UB
        Qdrant --> UB
        EW --> UB
        UB --> AG
        AG --> HTTPS
    end
```

```mermaid
flowchart LR
    subgraph Services["7 Services"]
        M["mongodb"]
        R["redis"]
        EW["embeddings-worker"]
        Q["qdrant"]
        ES["elasticsearch"]
        UB["unified-backend"]
        AG["api-gateway"]
    end
```

---

## Services Overview

### 1. MongoDB (Port 27017)

**Image**: `mongo:7.0`
**Container**: `tenpennynovels-mongodb`
**Purpose**: Primary database for all persistent data

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
**Indexes**: Optimized for frequent queries (slug, characterId, userId)
**Auth**: Always enabled in production (`--auth`)

**Details**: [MongoDB Schemas](./mongodb-schemas.md)

---

### 2. Redis (Port 6379)

**Image**: `redis:7.2-alpine`
**Container**: `tenpennynovels-redis`
**Purpose**: User sessions, WebSocket adapter, event pub/sub, cache

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
  - `embedding:document:created`, `embedding:document:updated`, `embedding:document:deleted`
  - `embedding:location:created`, `embedding:location:updated`, `embedding:location:deleted`
  - `embedding:location_action:created`, `embedding:location_action:updated`, `embedding:location_action:deleted`

**Persistence**: AOF (Append-Only File) enabled

**Details**: [Redis Pub/Sub](./redis-pubsub.md)

---

### 3. Qdrant (Port 6333)

**Image**: `qdrant/qdrant:v1.17.0`
**Container**: `tenpennynovels-qdrant`
**Purpose**: Vector database for semantic search

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
- `document_chunks` - 384D vectors for document semantic search
- `locations` - Location embeddings
- `location_actions` - Location action embeddings

**Performance**: ANN search < 100ms with 1000+ documents

**Details**: [Qdrant Vector DB](./qdrant-vector-db.md)

---

### 4. ElasticSearch (Port 9200)

**Image**: `elasticsearch:8.11.0`
**Container**: `tenpennynovels-elasticsearch`
**Purpose**: Full-text search for hybrid search (keyword + semantic)

**Configuration**:
```yaml
environment:
  - discovery.type=single-node
  - xpack.security.enabled=false
  - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
ports:
  - "9200:9200"
volumes:
  - elasticsearch_data:/usr/share/elasticsearch/data
healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 60s
```

**Indices** (prefix: `tenpennynovels_`):
- `tenpennynovels_document_chunks` - Document chunk full-text index
- `tenpennynovels_locations` - Location full-text index
- `tenpennynovels_location_actions` - Location action full-text index

**Usage**: Keyword search combined with Qdrant semantic search via RRF (Reciprocal Rank Fusion)

**Details**: [Qdrant Vector DB](./qdrant-vector-db.md) (hybrid search section)

---

### 5. Embeddings Worker (Port 5001)

**Build**: `./services/embeddings-worker/Dockerfile`
**Container**: `tenpennynovels-embeddings-worker`
**Purpose**: Unified embedding service (replaces legacy Flask embeddings-service). Combines HTTP server, Python subprocess for sentence-transformers, and Bull queue for async processing.

**Architecture**:
- **HTTP Server** (port 5001): Sync embedding and hybrid search API for unified-backend
- **Python Subprocess**: sentence-transformers (paraphrase-multilingual-MiniLM-L12-v2)
- **Bull Queue**: Async embedding jobs with Dead Letter Queue for failed jobs

**Configuration**:
```yaml
environment:
  NODE_ENV: production
  HTTP_PORT: 5001
  MONGODB_URI: mongodb://admin:password@mongodb:27017/tenpennynovels?authSource=admin
  REDIS_URL: redis://redis:6379
  QDRANT_URL: http://qdrant:6333
  ELASTICSEARCH_URL: http://elasticsearch:9200
  ELASTICSEARCH_INDEX_PREFIX: tenpennynovels
depends_on:
  - mongodb (condition: service_healthy)
  - redis (condition: service_healthy)
  - qdrant (condition: service_started)
  - elasticsearch (condition: service_healthy)
ports:
  - "5001:5001"  # HTTP API for embeddings
```

**Model**: paraphrase-multilingual-MiniLM-L12-v2 (384 dimensions)
**Performance**: ~50ms per embedding (cached), ~1.5s (first load)

**API Endpoints**:
- `POST /embed` - Generate embedding from text
- `POST /search` - Hybrid search (keyword + semantic via RRF)
- `GET /health` - Health check (returns 503 if Python not ready)

**Job Processing**:
- **Queue**: Bull (Redis-backed) - queue name: `embeddings`
- **Concurrency**: 5 parallel jobs
- **Retry**: 3 attempts with exponential backoff
- **Dead Letter Queue**: Failed jobs after max retries
- **Cache**: Redis 1h TTL for embedding results

**Event Subscriptions** (Redis Pub/Sub):
- `embedding:document:created`, `embedding:document:updated`, `embedding:document:deleted`
- `embedding:location:created`, `embedding:location:updated`, `embedding:location:deleted`
- `embedding:location_action:created`, `embedding:location_action:updated`, `embedding:location_action:deleted`

**Details**: [Embeddings Architecture](../04-ai-ml/embeddings-architecture.md)

---

### 6. Unified Backend (Port 3001)

**Build**: `./services/unified-backend/Dockerfile.dev`
**Container**: `tenpennynovels-unified-backend`
**Purpose**: Main backend with all modules

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
  REDIS_HOST: redis
  REDIS_PORT: 6379
  REDIS_URL: redis://redis:6379
  QDRANT_URL: http://qdrant:6333
  EMBEDDINGS_SERVICE_URL: http://embeddings-worker:5001
  JWT_SECRET: <secure-secret>
  JWT_REFRESH_SECRET: <secure-secret>
volumes:
  # Hot-reload setup - solo source code, NON node_modules
  - ./services/unified-backend/src:/app/src:ro
  # node_modules NON montato - container usa proprie dependencies installate
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
mongodb:27017           → tenpennynovels-mongodb
redis:6379              → tenpennynovels-redis
qdrant:6333             → tenpennynovels-qdrant
elasticsearch:9200      → tenpennynovels-elasticsearch
embeddings-worker:5001  → tenpennynovels-embeddings-worker
unified-backend:3001    → tenpennynovels-unified-backend
api-gateway:8000        → tenpennynovels-api-gateway
```

**Host Access** (via port mapping):
```
localhost:27017 → MongoDB
localhost:6379  → Redis
localhost:6333  → Qdrant
localhost:9200  → ElasticSearch
localhost:5001  → Embeddings Worker (HTTP API)
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

  elasticsearch_data:
    driver: local
    name: tenpennynovels-elasticsearch-data

  cdn_storage:
    driver: local
    name: tenpennynovels-cdn-storage
```

**Development Hot-Reload Volumes** (unified-backend):

### Source Code Mounting Strategy

**Solo src/ viene montato**, NON node_modules:

```yaml
volumes:
  - ./services/unified-backend/src:/app/src:ro         # Source code (read-only)
  # node_modules NON montato - container usa proprie dependencies
  - ./services/unified-backend/logs:/app/logs          # Logs (read-write)
```

**Perché NON montare node_modules?**

1. **Workspace Hoisting Incompatibility**:
   - Host usa workspace hoisting (tutte le deps in root `node_modules/`)
   - Container usa installazione standard (deps in `service/node_modules/`)
   - Path resolution diverso causa errori "Cannot find module"

2. **Architetture Different**:
   - Host potrebbe essere macOS (ARM64/x86_64)
   - Container è Linux Debian (x86_64)
   - Binary dependencies incompatibili (es. bcrypt, esbuild)

3. **Versioni Diverse**:
   - Host può avere versioni diverse installate globalmente
   - Container usa versioni pinned da package-lock.json

**Hot-Reload Funziona Comunque**:
- Modifiche a `src/` triggherano reload (tsx watch)
- Container ha proprie dependencies installate al build
- Source code aggiornato in real-time

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

# Embeddings Worker
curl -s http://localhost:5001/health | jq '.'

# ElasticSearch
curl -s http://localhost:9200/_cluster/health | jq '.'

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
- [Redis Pub/Sub](./redis-pubsub.md) - Event channels and Bull queues
- [Qdrant Vector DB](./qdrant-vector-db.md) - Vector search and hybrid search
- [Unified Backend](../02-backend/unified-backend-architecture.md) - Backend modules
- [API Gateway](../02-backend/api-gateway.md) - Proxy configuration
- [Embeddings Architecture](../04-ai-ml/embeddings-architecture.md) - ML pipeline
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
**Volumes**: 6 persistent (mongodb_data, mongodb_config, redis_data, qdrant_storage, elasticsearch_data, cdn_storage)
