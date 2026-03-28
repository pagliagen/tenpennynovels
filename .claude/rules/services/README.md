---
type: guide
category: backend
last_updated: 2026-03-27
---

# Backend Services Architecture

TenpennyNovels backend consists of 3 Node.js microservices, each with distinct responsibilities. All services share common patterns (Winston logger, TypeScript, MongoDB, Redis) but have different deployment strategies and communication patterns.

## Service Inventory

### 1. api-gateway (Port 8000)
**Role:** External entry point, reverse proxy, rate limiting, CORS, WebSocket proxy

**Tech Stack:**
- Express 5.1 (HTTP proxy)
- http-proxy-middleware (reverse proxy)
- Socket.IO proxy (WebSocket upgrade handling)
- express-rate-limit (per-route limits)
- Morgan + Winston logging

**Deployment:**
- PM2 cluster mode (2 instances)
- CDN static file serving (`/cdn`)
- Production: CORS disabled (Nginx handles it)

**When to use:** ALL external API traffic flows through api-gateway. Direct backend access is blocked by Docker network isolation.

### 2. unified-backend (Port 3001)
**Role:** Main business logic, 6 domain modules, WebSocket handlers, CRON jobs

**Tech Stack:**
- Express 5.1 (REST API)
- Socket.IO server (WebSocket with Redis adapter)
- Mongoose (MongoDB ODM)
- Redis (sessions, pub/sub, cache)
- Bull (background jobs - NOT for embeddings)

**Modules:**
1. `auth` - User authentication, JWT, email verification
2. `game` - Locations, characters, chat, inventory, actions
3. `admin` - User/character/location management
4. `documents` - Content management, semantic search
5. `forum` - Forum posts, threads
6. `tickets` - Support ticket system

**Deployment:**
- PM2 fork mode (1 instance)
- CRON: sitemap generation (daily), presence cleanup (5min)
- Binds to 0.0.0.0 (Docker internal networking)

**When to use:** ALL business logic lives here. API Gateway proxies requests to unified-backend.

### 3. embeddings-worker (Port 5001)
**Role:** Async embedding generation, Qdrant vector storage, semantic search processing

**Tech Stack:**
- Express (HTTP endpoint for sync calls)
- Bull queue (async Redis-based job processing)
- Python subprocess (sentence-transformers model)
- Qdrant (vector database)
- ElasticSearch (full-text search)

**Deployment:**
- PM2 fork mode (1 instance)
- Python service: paraphrase-multilingual-MiniLM-L12-v2 (384D vectors)
- Redis pub/sub for async events

**When to use:** Document/chat/forum content needs semantic embeddings. Unified-backend publishes events, embeddings-worker processes them.

## Port Mappings

| Service | Internal Port | External Access | PM2 Instances |
|---------|---------------|-----------------|---------------|
| api-gateway | 8000 | Nginx → 8000 | 2 (cluster) |
| unified-backend | 3001 | Gateway only | 1 (fork) |
| embeddings-worker | 5001 | Backend only | 1 (fork) |

**CRITICAL:** External clients NEVER access unified-backend or embeddings-worker directly. All traffic flows through api-gateway.

## Inter-Service Communication

### API Gateway → Unified Backend
```typescript
// HTTP proxy pattern (all routes)
app.use('/auth', createProxyMiddleware({ target: 'http://localhost:3001/auth' }));
app.use('/game', createProxyMiddleware({ target: 'http://localhost:3001/game' }));
// ... (documents, admin, forum, webhooks)

// WebSocket proxy (Socket.IO upgrade)
app.use(createProxyMiddleware({
  target: 'http://localhost:3001',
  ws: true, // Enable WebSocket upgrade
  pathFilter: '/socket.io/**'
}));
```

### Unified Backend → Embeddings Worker

**Async pattern (Redis pub/sub):**
```typescript
// unified-backend publishes event
await redis.publish('embeddings:document:new', JSON.stringify({
  documentId: '...',
  title: '...',
  content: '...'
}));

// embeddings-worker subscribes and processes via Bull queue
subscriber.subscribe('embeddings:document:new', (message) => {
  embeddingsQueue.add('document-embedding', JSON.parse(message));
});
```

**Sync pattern (HTTP call):**
```typescript
// unified-backend calls embeddings-worker HTTP endpoint
const response = await fetch('http://localhost:5001/embed', {
  method: 'POST',
  body: JSON.stringify({ text: '...' })
});
```

## File Structure

```
services/
├── api-gateway/
│   ├── src/
│   │   ├── app.ts           # Express app, proxy config, rate limits
│   │   ├── config.ts        # Environment config
│   │   └── utils/
│   │       └── logger.ts    # Winston logger
│   ├── bootstrap.js         # dotenv loader (CRITICAL for PM2)
│   └── package.json
│
├── unified-backend/
│   ├── src/
│   │   ├── server.ts        # Entry point, WebSocket setup
│   │   ├── app.ts           # Express app, middleware chain
│   │   ├── modules/         # Domain modules (auth, game, admin, etc.)
│   │   ├── shared/          # Cross-module utilities
│   │   │   ├── utils/
│   │   │   │   ├── logger.ts      # Winston logger
│   │   │   │   ├── apiResponse.ts # Standard API response format
│   │   │   │   └── validation.ts  # Mongoose error translation
│   │   │   └── middleware/
│   │   │       └── errorHandler.ts # Centralized error handler
│   │   ├── database/        # Mongoose models, connection
│   │   └── config/          # Runtime config, Redis, permissions
│   └── package.json
│
└── embeddings-worker/
    ├── src/
    │   ├── index.ts         # Entry point, service orchestration
    │   ├── workers/
    │   │   └── embedding-worker.ts # Bull queue processor
    │   ├── services/
    │   │   └── PythonEmbeddingService.ts # Python subprocess manager
    │   └── utils/
    │       └── logger.ts    # Winston logger
    └── package.json
```

## When to Use Which Rule File

**Use `shared-backend.md`** for:
- Winston logger patterns (CRITICAL - NEVER console.log)
- API response format (successResponse, errorResponse, listResponse)
- MongoDB `_id` usage (NEVER `id`)
- Error handling middleware
- Request validation patterns
- Health check endpoints
- Docker multi-stage builds

**Use `api-gateway.md`** for:
- Reverse proxy configuration
- Rate limiting per route
- CORS and security headers
- WebSocket proxy error handling
- Morgan + Winston logging integration

**Use `unified-backend.md`** for:
- Module structure and routing
- WebSocket handlers (Socket.IO + Redis adapter)
- Redis pub/sub patterns
- SessionStore (multi-tab support)
- Middleware chain (auth, character context, admin)
- Soft delete plugin patterns

**Use `embeddings-worker.md`** for:
- Bull queue configuration
- Qdrant integration (UUID point IDs)
- Redis cache patterns
- Dead Letter Queue handling
- Python subprocess management

## Deployment Architecture

```
[Nginx :80]
    ↓
[api-gateway :8000] (PM2 cluster x2)
    ↓
[unified-backend :3001] (PM2 fork x1)
    ├── MongoDB
    ├── Redis
    └── [embeddings-worker :5001] (PM2 fork x1)
            ├── Python (sentence-transformers)
            ├── Qdrant :6333
            └── ElasticSearch :9200
```

**Production PM2 Commands:**
```bash
# Start all services
pm2 startOrRestart ecosystem.config.js --update-env --env production

# Restart single service
pm2 restart tenpennynovels-api-gateway
pm2 restart tenpennynovels-unified-backend
pm2 restart tenpennynovels-embeddings-worker

# View logs
pm2 logs tenpennynovels-api-gateway --lines 100
```

## Critical Cross-Service Patterns

### 1. Winston Logger (CRITICAL)
**NEVER use console.log in ANY service.** Always use Winston logger.

Memory reference: 2026-03-03 - Fixed api-gateway to replace all console.log with logger calls.

```typescript
// ✅ CORRECT
import { logger } from './utils/logger';
logger.info('Server started');
logger.error('Database connection failed', { error });

// ❌ WRONG
console.log('Server started');
console.error('Database connection failed');
```

### 2. MongoDB _id (NOT id)
**ALWAYS use `_id` for MongoDB documents.** Project standard across all schemas.

Memory reference: 2026-02-25 - Fixed LocationService to use `_id` instead of `id`.

```typescript
// ✅ CORRECT
{ _id: location._id.toString(), slug: location.slug }

// ❌ WRONG
{ id: location._id.toString(), slug: location.slug }
```

### 3. WebSocket res.status Check
**Before calling res.status() in WebSocket error handlers, check if method exists.**

Memory reference: 2026-03-03 - Fixed api-gateway WebSocket proxy error handler.

```typescript
// ✅ CORRECT
error: (err, _req, res) => {
  logger.error('Proxy error', { error: err.message });
  if (!res.headersSent && typeof res.status === 'function') {
    res.status(502).json({ error: 'Service unavailable' });
  }
}

// ❌ WRONG (crashes on WebSocket upgrade)
error: (err, _req, res) => {
  res.status(502).json({ error: 'Service unavailable' });
}
```

### 4. Module Aliases (TypeScript)
All services use module aliases for cleaner imports:

```typescript
// Unified-backend aliases (tsconfig.json + module-alias)
import { logger } from '@shared/utils/logger';
import { User } from '@database/models';
import { appConfig } from '@config/runtime';
import { AuthController } from '@modules/auth/controllers';

// DON'T use relative imports for shared code
import { logger } from '../../../shared/utils/logger'; // ❌
```

### 5. Environment Variables
**CRITICAL:** dotenv MUST load BEFORE any imports.

```typescript
// ✅ CORRECT (api-gateway bootstrap.js)
require('dotenv').config();
require('./dist/index.js');

// ✅ CORRECT (embeddings-worker index.ts)
require('dotenv').config();
import { config } from './config';

// ❌ WRONG
import { config } from './config';
require('dotenv').config(); // Too late!
```

## Health Check Endpoints

Each service exposes `/health` for monitoring:

```typescript
// api-gateway: checks backend services
GET /health → { gateway: {...}, services: { auth, game, admin }, summary }

// unified-backend: checks MongoDB + Redis
GET /health → { status, mongodb, redis, uptime }

// embeddings-worker: checks Python + Qdrant + ElasticSearch
GET /health → { status, python, qdrant, elasticsearch, queue }
```

## Cross-References

- **Logging patterns:** See `shared-backend.md` → Winston Logger section
- **API responses:** See `shared-backend.md` → API Response Format section
- **Rate limiting:** See `api-gateway.md` → Rate Limiting section
- **WebSocket setup:** See `unified-backend.md` → WebSocket Handlers section
- **Bull queue:** See `embeddings-worker.md` → Bull Queue Configuration section
- **Error handling:** See `shared-backend.md` → Error Handling Middleware section

## Incidents & Lessons Learned

### Incident: esbuild Missing in botai-backend (2026-03-04)
**Problem:** Production deployment used `npm install --production` which excluded devDependencies, but build.mjs imported esbuild from devDependencies.

**Solution:** Moved esbuild to production dependencies. Build tools used in deployment MUST be in `dependencies`, not `devDependencies`.

**Pattern:** If deployment script runs `npm install --production`, any build tool (esbuild, tsc, webpack) must be in `dependencies`.

### Incident: WebSocket res.status Crash (2026-03-03)
**Problem:** api-gateway WebSocket proxy error handler called `res.status(502)` but after upgrade, `res` is a TCP socket without `.status()` method.

**Solution:** Added `typeof res.status === 'function'` check before calling.

**Pattern:** Always check if response object has HTTP methods before using them in WebSocket error handlers.

---

**Next:** See service-specific rule files for detailed patterns and examples.
