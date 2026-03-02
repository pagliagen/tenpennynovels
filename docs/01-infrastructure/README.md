# Infrastructure

**Navigation**: [Home](../INDEX.md) > Infrastructure

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-01

Overview dell'infrastruttura TenpennyNovels: Docker, database, caching, vector search, event systems.

---

## Overview

L'infrastruttura di TenpennyNovels è completamente dockerizzata per consistenza tra development e production. Utilizza 7 servizi containerizzati orchestrati via Docker Compose.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Apps                         │
│  Landing:4000  Game:4001  Docs:4003  Mgmt:4004          │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/WebSocket
         ┌───────────▼───────────┐
         │   API Gateway :8000   │ ← Single Entry Point
         │  (Proxy + WebSocket)  │
         └───────────┬───────────┘
                     │
         ┌───────────▼────────────┐
         │ Unified Backend :3001  │ ← Main Application
         │   (5 modules)          │
         └───┬────────────────┬───┘
             │                │
    ┌────────▼─────┐   ┌─────▼──────┐   ┌───────────────┐
    │ MongoDB:27017│   │ Redis:6379 │   │ Qdrant:6333   │
    │ (Persistence)│   │ (Pub/Sub)  │   │ (Vector DB)   │
    └──────────────┘   └────────────┘   └───────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
    ┌───────▼────────┐              ┌──────────▼──────────┐
    │ Embeddings     │              │ Embeddings Worker   │
    │ Service :5001  │              │ (Bull Queue)        │
    │ (Flask ML)     │              │                     │
    └────────────────┘              └─────────────────────┘
```

---

## Services

### 1. MongoDB (Port 27017)

**Purpose**: Persistent data storage for all application data.

**Technology**: MongoDB 7.0

**Key Features**:
- 44+ schemas (User, Character, Location, Document, Corporation, etc.)
- Indexes for performance optimization
- Replica set ready (production)
- Automatic backups (production)

**Volumes**:
- `mongodb_data:/data/db` - Database files
- `mongodb_config:/data/configdb` - Configuration

**Health Check**: `mongosh ping`

**Details**: [MongoDB Schemas](./mongodb-schemas.md)

---

### 2. Redis (Port 6379)

**Purpose**: Caching, session storage, pub/sub messaging, WebSocket adapter.

**Technology**: Redis 7.2 Alpine

**Key Features**:
- Session storage (auth tokens, character context)
- Event pub/sub channels (CHARACTER_EVENTS, LOCATION_EVENTS, etc.)
- WebSocket adapter per multi-instance Socket.IO
- Bull queue jobs storage
- Cache layer (1h TTL for embeddings)

**Persistence**: AOF (Append-Only File) enabled

**Volumes**:
- `redis_data:/data` - Persistent storage

**Health Check**: `redis-cli ping`

**Details**: [Redis Pub/Sub](./redis-pubsub.md)

---

### 3. Qdrant (Port 6333)

**Purpose**: Vector database for semantic search.

**Technology**: Qdrant 1.17.0

**Key Features**:
- Approximate Nearest Neighbor (ANN) search <100ms
- Collections: `documents`, `document_chunks`
- 384-dimensional vectors (paraphrase-multilingual-MiniLM-L12-v2)
- Point payloads with metadata filtering

**Volumes**:
- `qdrant_storage:/qdrant/storage` - Vector data

**Health Check**: `/healthz`

**Details**: [Qdrant Vector DB](./qdrant-vector-db.md)

---

### 4. Embeddings Service (Port 5001)

**Purpose**: ML service for generating text embeddings.

**Technology**: Flask (Python 3.11), Sentence Transformers

**Key Features**:
- Model: paraphrase-multilingual-MiniLM-L12-v2
- 384-dimensional vectors
- Endpoints: `/embed`, `/embed/batch`, `/health`
- ~100ms per embedding, ~50ms cached
- Multilingual support (IT, EN, +50 languages)

**Resource Usage**: ~500MB RAM (model loaded)

**Health Check**: `curl /health`

**Details**: [Embeddings Architecture](../04-ai-ml/embeddings-architecture.md)

---

### 5. Embeddings Worker

**Purpose**: Async processing of embedding generation jobs.

**Technology**: Node.js, Bull Queue, Qdrant client

**Key Features**:
- Event-driven via Redis pub/sub
- Concurrency: 5 jobs parallel
- Retry strategy: 3 attempts, exponential backoff
- Dual storage: MongoDB + Qdrant
- Redis cache (1h TTL)

**Events Subscribed**:
- `EMBEDDING_DOCUMENT_CREATED`
- `EMBEDDING_DOCUMENT_UPDATED`
- `EMBEDDING_LOCATION_ACTION_CREATED`

**Details**: [Embeddings Architecture](../04-ai-ml/embeddings-architecture.md)

---

### 6. Unified Backend (Port 3001)

**Purpose**: Main application backend with modular architecture.

**Technology**: Node.js 22, Express 5.2.1, TypeScript 5.9.3, Mongoose 9.2.1

**Modules**:
- **auth** - Authentication, users, JWT management
- **game** - Characters, locations, gameplay, housing, corporations
- **admin** - Management panel APIs
- **forum** - Forum system (archived)
- **documents** - Content management, semantic search

**Key Features**:
- Socket.IO WebSocket server
- Event publishing to Redis
- MongoDB connection pooling
- Middleware stack (auth, validation, logging)

**Health Check**: `GET /health`

**Details**: [Unified Backend Architecture](../02-backend/unified-backend-architecture.md)

---

### 7. API Gateway (Port 8000)

**Purpose**: Single entry point for all client requests.

**Technology**: Node.js 22, Express 5.2.1, http-proxy-middleware v3

**Key Features**:
- Proxy routing to unified-backend
- CORS configuration (4 frontend origins)
- Rate limiting (tiered: auth vs unauth)
- WebSocket upgrade handling
- Request logging (Morgan)

**Routes**:
- `/auth/*` → unified-backend:3001/auth
- `/game/*` → unified-backend:3001/game
- `/admin/*` → unified-backend:3001/admin
- `/documents/*` → unified-backend:3001/documents
- `/socket.io/**` → unified-backend:3001 (WebSocket)

**Health Check**: `GET /health`

**Details**: [API Gateway](../02-backend/api-gateway.md)

---

## Network

**Name**: `tenpennynovels-network`

**Type**: Bridge

**Services Discovery**: All services communicate via service name (e.g., `mongodb:27017`, `redis:6379`)

---

## Volumes

Persistent volumes per data preservation:

| Volume | Service | Purpose |
|--------|---------|---------|
| `mongodb_data` | MongoDB | Database files |
| `mongodb_config` | MongoDB | Configuration |
| `redis_data` | Redis | AOF persistence |
| `qdrant_storage` | Qdrant | Vector database |

**Backup Strategy**: [Backup & Restore](../06-operations/backup-restore.md)

---

## Environment Variables

Tutte le environment variables sono documentate in dettaglio:

**Reference**: [Environment Variables](./environment-variables.md)

**Key Variables**:
- `MONGODB_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection URL
- `QDRANT_URL` - Qdrant API URL
- `EMBEDDINGS_SERVICE_URL` - Embeddings service endpoint
- `JWT_SECRET` - JWT signing secret
- `NODE_ENV` - Environment (development/production)

---

## Development vs Production

### Development

- Hot-reload enabled (volume mounts src:ro)
- Debug logging
- CORS permissive (localhost:4000-4005)
- No SSL/TLS
- Single-instance services

### Production

- Build-optimized images
- Production logging
- CORS restricted (specific domains)
- SSL/TLS enabled
- Replica sets (MongoDB)
- Redis Sentinel (high availability)
- Load balancing (API Gateway)

**Production Deployment**: [Deployment Guide](../06-operations/deployment-guide.md)

---

## Common Commands

```bash
# Start all services
npm run docker:all:start

# Start infrastructure only (MongoDB, Redis, Qdrant, embeddings)
npm run docker:infra:start

# Check service health
npm run docker:check

# View logs (all services)
npm run docker:logs

# View logs (specific service)
docker logs tenpennynovels-mongodb
docker logs tenpennynovels-unified-backend

# Stop all services
npm run docker:all:stop

# Restart service (after code change)
docker restart tenpennynovels-unified-backend

# Rebuild service (after Dockerfile change)
docker compose stop unified-backend
docker compose build unified-backend
docker compose up -d unified-backend

# Clean volumes (WARNING: deletes data)
docker compose down -v
```

---

## Files in This Section

- [README.md](./README.md) - This file
- [Docker Compose](./docker-compose.md) - Service orchestration details
- [MongoDB Schemas](./mongodb-schemas.md) - Database schema reference
- [Redis Pub/Sub](./redis-pubsub.md) - Event channels
- [Qdrant Vector DB](./qdrant-vector-db.md) - Vector search setup
- [Environment Variables](./environment-variables.md) - Complete env reference

---

## Related Documentation

- [Getting Started](../00-getting-started/README.md) - Setup guide
- [Unified Backend](../02-backend/unified-backend-architecture.md) - Backend modules
- [API Gateway](../02-backend/api-gateway.md) - Proxy configuration
- [Embeddings Architecture](../04-ai-ml/embeddings-architecture.md) - ML pipeline
- [Docker Troubleshooting](../06-operations/docker-troubleshooting.md) - Common issues
