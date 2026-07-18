---
name: Docker & Deployment
description: Docker patterns, multi-stage builds, and deployment strategies
type: deployment
---

# Docker & Deployment

Pattern Docker, multi-stage builds, e deployment strategies.

---

## Multi-Stage Dockerfile Pattern

### Standard Pattern:

```dockerfile
# ============================================
# Stage 1: Builder
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build
RUN npm run build

# ============================================
# Stage 2: Production
# ============================================
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node healthcheck.js || exit 1

# Start
CMD ["node", "dist/index.js"]
```

### Why Multi-Stage?

| Benefit | Single-Stage | Multi-Stage |
|---------|--------------|-------------|
| Image size | ~800MB (with build tools) | ~200MB (runtime only) |
| Security | Dev dependencies exposed | Only production code |
| Build speed | Slower (no cache separation) | Faster (layer caching) |
| Attack surface | Larger | Minimal |

**Eccezione — `services/embeddings-worker/Dockerfile`**: è `FROM python:3.12-slim`, non Node. Il container esiste per il subprocess Python (sentence-transformers) usato dal worker; il servizio Node dell'embeddings-worker in produzione gira via PM2 sull'host, non in questo container. Non applicare il pattern multi-stage Node a questo Dockerfile.

---

## After Build: stop + up (NOT restart)

**Regola**: Dopo rebuild di un'immagine, usa `stop` + `up -d` (NON `restart`).

### ❌ WRONG:
```bash
docker compose build unified-backend
docker compose restart unified-backend  # ❌ Doesn't pick up new image!
```

### ✅ CORRECT:
```bash
docker compose build unified-backend
docker compose stop unified-backend
docker compose up -d unified-backend  # ✅ Creates new container with new image
```

### Why?

- `restart`: Restarts **existing** container (same image)
- `stop` + `up`: Creates **new** container with **new** image

### Incidente Reale (2026-02-23):

**Bug**: Dopo build di embeddings-worker, modifiche non applicate

**Fix**:
```bash
# WRONG workflow:
docker compose build embeddings-worker
docker compose restart embeddings-worker  # ❌ Old image still running

# CORRECT workflow:
docker compose stop embeddings-worker
docker compose build embeddings-worker
docker compose up -d embeddings-worker  # ✅ New image deployed
```

---

## docker-compose.yml Patterns

### Service Definition:

```yaml
version: '3.8'

services:
  unified-backend:
    build:
      context: .
      dockerfile: services/unified-backend/Dockerfile
    image: tenpennynovels/unified-backend:latest
    container_name: tenpennynovels-unified-backend
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - MONGODB_URI=mongodb://mongodb:27017/tenpennynovels
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env.production
    volumes:
      - ./cdn-storage:/app/cdn-storage
    depends_on:
      mongodb:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - tenpennynovels-network
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Key Patterns:

1. **`restart: unless-stopped`**: Auto-restart except manual stop
2. **`depends_on` with conditions**: Wait for dependencies
3. **`healthcheck`**: Monitor container health
4. **`networks`**: Isolate service communication
5. **`volumes`**: Persist data outside container

---

## Health Checks

### In Dockerfile:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node healthcheck.js || exit 1
```

### healthcheck.js (Node.js):

```javascript
// healthcheck.js (in container root)
const http = require('http');

const options = {
  host: 'localhost',
  port: process.env.PORT || 3001,
  path: '/health',
  timeout: 2000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);  // Healthy
  } else {
    process.exit(1);  // Unhealthy
  }
});

req.on('error', () => {
  process.exit(1);  // Unhealthy
});

req.end();
```

### Backend Health Endpoint:

```typescript
// src/routes/health.ts
import express from 'express';
import mongoose from 'mongoose';
import { redis } from '@shared/utils/redis';

const router = express.Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'up',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: 'disconnected',
    redis: 'disconnected'
  };

  try {
    // Check MongoDB
    if (mongoose.connection.readyState === 1) {
      health.mongodb = 'connected';
    }

    // Check Redis
    const pong = await redis.ping();
    if (pong === 'PONG') {
      health.redis = 'connected';
    }

    // All checks passed
    if (health.mongodb === 'connected' && health.redis === 'connected') {
      res.status(200).json(health);
    } else {
      res.status(503).json(health);  // Service Unavailable
    }
  } catch (error) {
    health.status = 'down';
    health.error = error.message;
    res.status(503).json(health);
  }
});

export default router;
```

---

## Volume Mounts

### Persistent Data:

```yaml
volumes:
  - mongodb-data:/data/db          # Database data
  - redis-data:/data                # Redis data
  - ./cdn-storage:/app/cdn-storage  # User uploads
  - ./logs:/app/logs                # Application logs
```

### Node Modules (Development):

```yaml
# ⚠️ Only in development, NOT production
volumes:
  - ./src:/app/src                       # Hot reload source
  - /app/node_modules                    # Prevent overwrite from host
  - ./node_modules:/app/node_modules:ro  # Read-only host modules
```

### Named Volumes:

```yaml
volumes:
  mongodb-data:
    driver: local
  redis-data:
    driver: local
```

---

## Networks

### Bridge Network (Default):

```yaml
networks:
  tenpennynovels-network:
    driver: bridge
```

### External Network (Cross-Compose):

```yaml
# Main docker-compose.yml
networks:
  tenpennynovels-network:
    external: false  # Create if not exists

# local-ai/docker-compose.yml
networks:
  tenpennynovels-network:
    external: true   # Use existing network
```

### Service Discovery:

```yaml
services:
  unified-backend:
    # ...
    networks:
      - tenpennynovels-network

  mongodb:
    # ...
    networks:
      - tenpennynovels-network

# unified-backend can reach mongodb via hostname:
# mongodb://mongodb:27017/tenpennynovels
```

---

## Environment Variables

### Loading Order:

```yaml
services:
  unified-backend:
    environment:
      - NODE_ENV=production        # 1. Inline (highest priority)
    env_file:
      - .env.production            # 2. env_file
      - .env                       # 3. Fallback env_file
```

### .env.production:

```bash
# Database
MONGODB_URI=mongodb://mongodb:27017/tenpennynovels
REDIS_URL=redis://redis:6379

# Security
JWT_SECRET=${JWT_SECRET}  # Injected from host environment

# Ports
PORT=3001
```

### Secrets (Sensitive Data):

**❌ DON'T** commit `.env.production` with secrets

**✅ DO** use environment variable substitution:

```bash
# On host (CI/CD or local)
export JWT_SECRET=your-secret-here

# Docker Compose reads from host environment
docker compose up -d
```

---

## Docker Commands Cheat Sheet

### Build & Run:

```bash
# Build single service
docker compose build unified-backend

# Build all services
docker compose build

# Start services (detached)
docker compose up -d

# Start specific service
docker compose up -d unified-backend

# Stop services
docker compose stop

# Stop specific service
docker compose stop unified-backend

# Remove containers (keep volumes)
docker compose down

# Remove containers + volumes (⚠️ data loss!)
docker compose down -v
```

### After Rebuild (CRITICAL):

```bash
# ✅ CORRECT
docker compose stop unified-backend
docker compose build unified-backend
docker compose up -d unified-backend

# ❌ WRONG (doesn't load new image)
docker compose build unified-backend
docker compose restart unified-backend
```

### Logs:

```bash
# Follow logs
docker compose logs -f unified-backend

# Last 100 lines
docker compose logs --tail=100 unified-backend

# All services
docker compose logs -f
```

### Exec into Container:

```bash
# Shell
docker compose exec unified-backend sh

# Run command
docker compose exec unified-backend node scripts/migrate.js
```

### Inspect:

```bash
# List containers
docker compose ps

# Inspect container
docker inspect tenpennynovels-unified-backend

# Check resource usage
docker stats
```

### Cleanup:

```bash
# Remove stopped containers
docker compose rm

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove everything (⚠️ dangerous!)
docker system prune -a --volumes
```

---

## Production Deployment (PM2)

### Ecosystem File:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'api-gateway',
      script: 'dist/index.js',
      cwd: '/var/www/tenpennynovels/services/api-gateway',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 8000
      }
    },
    {
      name: 'unified-backend',
      script: 'dist/index.js',
      cwd: '/var/www/tenpennynovels/services/unified-backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
```

### PM2 Commands:

```bash
# Start all apps
pm2 start ecosystem.config.js

# Restart app
pm2 restart unified-backend

# Stop app
pm2 stop unified-backend

# Logs
pm2 logs unified-backend

# Status
pm2 status

# Monitor
pm2 monit

# Save configuration
pm2 save

# Startup script (auto-start on reboot)
pm2 startup
```

---

## Deployment Workflow

### Development → Staging → Production:

```bash
# 1. Develop locally
npm run dev

# 2. Build and test
npm run build
npm test

# 3. Create Docker image
docker compose build unified-backend

# 4. Test in Docker
docker compose up -d unified-backend
docker compose logs -f unified-backend

# 5. Tag image for production
docker tag tenpennynovels/unified-backend:latest tenpennynovels/unified-backend:v1.2.3

# 6. Push to registry (if using)
docker push tenpennynovels/unified-backend:v1.2.3

# 7. Deploy to production (SSH to VPS)
ssh user@51.83.47.109
cd /var/www/tenpennynovels
git pull origin master
npm run build:backend:all
pm2 restart all
```

---

## Qdrant Docker

### Special healthcheck:

```yaml
qdrant:
  image: qdrant/qdrant:latest
  ports:
    - "6333:6333"
  volumes:
    - qdrant-data:/qdrant/storage
  healthcheck:
    test: ["CMD", "wget", "--spider", "http://localhost:6333/health"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 10s
  # ✅ Use service_started for depends_on (not service_healthy)
```

**Why `service_started` not `service_healthy`?**
- Qdrant healthcheck can be slow to report healthy
- Service is functional before healthcheck passes
- `service_started` prevents timeout issues

---

## Cross-References

- **Node version**: [02-node-environment.md](./02-node-environment.md)
- **Build tools dependencies**: [00-project-wide.md](./00-project-wide.md#7-build-tools-in-production-dependencies)
- **Health endpoint implementation**: [services/shared-backend.md](./services/shared-backend.md)
