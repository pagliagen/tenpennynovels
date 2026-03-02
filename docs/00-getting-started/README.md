# Getting Started

**Navigation**: [Home](../INDEX.md) > Getting Started

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-01

Guida rapida per configurare l'ambiente di sviluppo TenpennyNovels e iniziare a contribuire al progetto.

---

## Overview

TenpennyNovels è un gioco di ruolo Victorian ambientato nella Londra del 1880 basato sul sistema Call of Cthulhu d100. L'applicazione utilizza un'architettura microservizi moderna con Next.js per il frontend e Node.js/Express per il backend.

---

## Prerequisites

Prima di iniziare, assicurati di avere installato:

- **Node.js** 22.13.1 (vedi `.nvmrc` nella root del progetto)
- **Docker** & **Docker Compose** (recommended per environment consistente)
- **Git** per version control
- **VS Code** (IDE raccomandato) con estensioni:
  - ESLint
  - Prettier
  - TypeScript
  - Docker

**Optional** (per local development senza Docker):
- **MongoDB** 7.0+
- **Redis** 7.2+
- **Python** 3.11+ (per embeddings-service)

---

## Quick Start (Docker - Recommended)

### 1. Clone Repository

```bash
git clone <repository-url>
cd tenpennynovels
```

### 2. Install Dependencies

```bash
# Use correct Node version
nvm use

# Install all dependencies (root + all workspaces)
npm install
```

### 3. Configure Environment

Le environment variables sono già pre-configurate per Docker. Se necessario, copia e modifica:

```bash
cp .env.example .env
# Edit .env per custom settings (optional)
```

Vedi [Environment Variables Reference](../01-infrastructure/environment-variables.md) per lista completa.

### 4. Start Infrastructure + Backend

```bash
# Start everything (MongoDB, Redis, Qdrant, embeddings, unified-backend, api-gateway)
npm run docker:all:start

# Wait 30-60 seconds for services to be healthy
npm run docker:check
```

### 5. Verify Services

```bash
# Check all Docker containers are running
docker ps

# Should see:
# - tenpennynovels-mongodb (port 27017)
# - tenpennynovels-redis (port 6379)
# - tenpennynovels-qdrant (port 6333)
# - tenpennynovels-embeddings-service (port 5001)
# - tenpennynovels-embeddings-worker
# - tenpennynovels-unified-backend (port 3001)
# - tenpennynovels-api-gateway (port 8000)

# Test API Gateway
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

### 6. Start Frontend Apps

```bash
# In separate terminals (or use tmux/screen):

# Terminal 1 - Landing (Login)
cd apps/landing
npm run dev
# → http://localhost:4000

# Terminal 2 - Game (Main Interface)
cd apps/game
npm run dev
# → http://localhost:4001

# Terminal 3 - Documents (Knowledge Base)
cd apps/documents
npm run dev
# → http://localhost:4003

# Terminal 4 - Management (Admin Panel)
cd apps/management
npm run dev
# → http://localhost:4004
```

### 7. Access Applications

- **Landing Page**: http://localhost:4000 (registration, login, character selection)
- **Game Interface**: http://localhost:4001 (main gameplay)
- **Documents**: http://localhost:4003 (documentation in-game)
- **Admin Panel**: http://localhost:4004 (admin only)
- **API Gateway**: http://localhost:8000 (backend API)

---

## Alternative: Local Development (Without Docker)

Se preferisci non usare Docker:

### 1. Start Infrastructure Manually

```bash
# MongoDB (in terminal 1)
mongod --dbpath ./data/db

# Redis (in terminal 2)
redis-server

# Qdrant (in terminal 3)
# Download from https://qdrant.tech/
./qdrant

# Python venv for embeddings-service (in terminal 4)
cd services/embeddings-service
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
python embeddings_service.py
```

### 2. Configure Environment for Local

Edit `.env` to point to local services:

```bash
MONGODB_URI=mongodb://localhost:27017/tenpennynovels
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333
EMBEDDINGS_SERVICE_URL=http://localhost:5001
```

### 3. Start Backend Services

```bash
# In root directory
npm run backend:all

# Or individually:
npm run backend:unified    # Unified backend (port 3001)
npm run backend:gateway    # API Gateway (port 8000)
npm run backend:worker     # Embeddings worker
```

### 4. Start Frontend Apps

Same as Docker method (step 6 above).

---

## Common First Steps

### Create Admin User

```bash
# Use the seed script
npm run seed:admin

# Or manually via MongoDB shell:
mongosh
use tenpennynovels
db.users.insertOne({
  username: "admin",
  email: "admin@tenpennynovels.com",
  password: "<hashed>",
  canAccessAdminPanel: true,
  userRoles: ["amministratore"]
})
```

### Test API Endpoints

```bash
# Test authentication
./scripts/test-auth-endpoints.sh

# Test game endpoints
./scripts/test-game-endpoints.sh

# Test housing system
./scripts/test-housing-endpoints.sh
```

Vedi [API Testing Scripts](../07-testing/api-testing-scripts.md) per dettagli.

---

## Project Structure Overview

```
tenpennynovels/
├── apps/                      # Frontend Next.js apps
│   ├── landing/              # Login, registration (port 4000)
│   ├── game/                 # Main gameplay (port 4001)
│   ├── documents/            # Knowledge base (port 4003)
│   ├── management/           # Admin panel (port 4004)
│   └── shared-ui/            # Shared UI components
├── services/                  # Backend services
│   ├── api-gateway/          # API Gateway (port 8000)
│   ├── unified-backend/      # Main backend (port 3001)
│   ├── embeddings-service/   # Flask ML service (port 5001)
│   ├── embeddings-worker/    # Bull queue worker
│   └── botai-backend/        # Bot AI service (port 8080, disabled)
├── docs/                      # Documentation (you are here)
├── scripts/                   # Utility and testing scripts
├── docker-compose.yml         # Docker orchestration
├── package.json              # Root package.json
└── .nvmrc                    # Node version (22.13.1)
```

Vedi [Project Structure](./project-structure.md) per dettagli completi.

---

## Next Steps

### For Developers

1. **Understand Architecture**: Read [Infrastructure Overview](../01-infrastructure/README.md)
2. **Backend Deep Dive**: Read [Unified Backend Architecture](../02-backend/unified-backend-architecture.md)
3. **Frontend Patterns**: Read [WebSocket Patterns](../05-frontend/websocket-patterns.md) (**CRITICAL**)
4. **Game Systems**: Explore [Game Systems](../03-game-systems/README.md)

### For Operations

1. **Deployment**: Read [Deployment Guide](../06-operations/deployment-guide.md)
2. **Monitoring**: Read [Monitoring](../06-operations/monitoring.md)
3. **Troubleshooting**: Keep [Docker Troubleshooting](../06-operations/docker-troubleshooting.md) handy

---

## Troubleshooting

### Docker Containers Not Starting

```bash
# Check logs
npm run docker:logs

# Or specific service
docker logs tenpennynovels-mongodb
docker logs tenpennynovels-unified-backend
```

Vedi [Docker Troubleshooting](../06-operations/docker-troubleshooting.md) per problemi comuni.

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>
```

### MongoDB Connection Refused

```bash
# Verify MongoDB is running
docker ps | grep mongodb

# Check MongoDB logs
docker logs tenpennynovels-mongodb

# Restart if needed
docker restart tenpennynovels-mongodb
```

### Frontend Build Errors

```bash
# Clear Next.js cache
cd apps/game
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install
```

---

## Files in This Section

- [README.md](./README.md) - This file
- [Tech Stack](./tech-stack.md) - Technology stack overview
- [Project Structure](./project-structure.md) - Repository organization

---

## Related Documentation

- [Infrastructure](../01-infrastructure/README.md) - Docker, MongoDB, Redis setup
- [Backend Architecture](../02-backend/unified-backend-architecture.md) - Backend modules
- [Frontend Apps](../05-frontend/README.md) - Next.js applications
- [Docker Compose](../01-infrastructure/docker-compose.md) - Service orchestration
- [Environment Variables](../01-infrastructure/environment-variables.md) - Complete reference
