# Project Structure

**Navigation**: [Home](../INDEX.md) > [Getting Started](./README.md) > Project Structure

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-01

Complete overview della struttura del repository TenpennyNovels monorepo.

---

## Overview

TenpennyNovels è organizzato come **monorepo** con npm workspaces. Tutti i frontend apps e backend services condividono dependencies e tooling centralizzato.

**Repository Type**: Monorepo
**Package Manager**: npm workspaces
**Version Control**: Git
**Total Apps**: 4 frontend + 3 backend services

---

## Root Directory

```
tenpennynovels/
├── .claude/                # Claude AI project config
├── .git/                   # Git repository
├── apps/                   # Frontend applications (Next.js)
├── services/               # Backend services (Node.js)
├── scripts/                # Utility scripts (testing, deployment)
├── docs/                   # Documentation (THIS FILE!)
├── deploy/                 # Deployment configs (Docker, Nginx)
├── pricing/                # Pricing calculations (reference)
│
├── .nvmrc                  # Node version (22.13.1)
├── .env                    # Environment variables (NEVER commit!)
├── .env.example            # Environment template
├── .gitignore              # Git ignore rules
├── docker-compose.yml      # Docker orchestration (7 services)
├── package.json            # Root package.json (workspaces)
├── package-lock.json       # Lock file
├── tsconfig.json           # TypeScript config base
├── ecosystem.config.js     # PM2 config (legacy)
└── README.md               # Project README
```

---

## Frontend Apps (`/apps`)

### Landing App (`apps/landing`)

**Purpose**: Homepage, login, registration, character selection

**Tech Stack**:
- Next.js 16.0.2
- React 18.3.1
- Sass 1.83.4
- NextAuth

**Routes**:
```
/                    - Homepage
/register            - User registration
/forgot-password     - Password reset request
/reset-password/[token] - Password reset form
/verify-email/[token] - Email verification
/character-select    - Character selection screen
/character-creation  - Character creation wizard
/credits             - Credits page
/privacy             - Privacy policy
/terms               - Terms of service
```

**Build Output**: Static HTML in `apps/landing/out/`

**Deployment**: Vercel or Nginx static hosting

---

### Game App (`apps/game`)

**Purpose**: Main gameplay interface (locations, chat, actions)

**Tech Stack**:
- Next.js 16.0.2
- React 19.0.0 (experimental)
- Socket.IO Client 4.8.3
- Zustand 5.0.3
- TanStack Query 5.64.4

**Key Features**:
- Real-time location updates (WebSocket)
- Turn-based action system
- Character sheet management
- On-game messaging (postal system)
- Off-game chat
- Housing dashboard

**Main Pages**:
```
/                         - Dashboard/Home
/locations                - Location browser
/locations/[locationId]   - Location detail (chat, actions)
/characters               - Character list
/housing                  - Housing dashboard
/shop/[locationSlug]      - Shop interface
```

**Build Output**: Static HTML in `apps/game/out/`

**Deployment**: Vercel or Nginx static hosting

**Details**: [WebSocket Patterns](../05-frontend/websocket-patterns.md)

---

### Documents App (`apps/documents`)

**Purpose**: Browse game documentation (ambientazione, regolamento)

**Tech Stack**:
- Next.js 16.0.2
- React 18.3.1
- Markdown rendering

**Routes**:
```
/                     - Documents homepage
/ambientazione        - Setting docs list
/ambientazione/[slug] - Setting document detail
/regolamento          - Rules docs list
/regolamento/[slug]   - Rules document detail
/preferiti            - User favorites
/search               - Semantic search (Qdrant)
```

**Features**:
- Hierarchical navigation
- Semantic search integration
- Favorites system
- Mobile-responsive

**Build Output**: Static HTML in `apps/documents/out/`

**Deployment**: Vercel or Nginx static hosting

---

### Management App (`apps/management`)

**Purpose**: Admin panel for Masters and staff

**Tech Stack**:
- Next.js 16.0.2
- React 18.3.1
- TanStack Query 5.64.4
- Recharts (analytics)

**Key Features**:
- Character approval workflow
- User management (ban, permissions)
- Document management
- Ticket system
- Analytics dashboard
- System configuration

**Main Pages**:
```
/                                - Dashboard
/characters/character-list       - All characters
/characters/character-pending    - Pending approvals
/characters/approval             - Approval interface
/users/user-list                 - User management
/users/ban-list                  - Banned users
/users/permissions               - Permission management
/documents                       - Document management
/documents/ambientazione         - Setting docs management
/documents/regolamento           - Rules docs management
/tickets/my-tickets              - My tickets
/tickets/department-tickets      - Department tickets
/tickets/all-tickets             - All tickets
/system/configurations           - System config
/system/broadcast                - Broadcast messages
```

**Access**: Admin/Master only (role-based)

**Build Output**: Static HTML in `apps/management/out/`

**Deployment**: Vercel or Nginx static hosting

---

## Backend Services (`/services`)

### Unified Backend (`services/unified-backend`)

**Purpose**: Main backend with all modules (auth, game, admin)

**Port**: 3001
**Tech**: Express 5.2.1, Mongoose 9.2.1, Socket.IO 4.8.3

**Structure**:
```
services/unified-backend/
├── src/
│   ├── modules/
│   │   ├── auth/             # Authentication module
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   └── services/
│   │   ├── game/             # Game logic module
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── websocket/
│   │   ├── admin/            # Admin module
│   │   ├── forum/            # Forum module (future)
│   │   ├── documents/        # Documents module
│   │   └── tickets/          # Tickets module (future)
│   ├── database/
│   │   ├── models/           # 42 Mongoose schemas
│   │   ├── migrations/       # Database migrations
│   │   └── index.ts          # MongoDB connection
│   ├── middleware/
│   │   ├── auth.ts           # JWT authentication
│   │   ├── errorHandler.ts  # Global error handler
│   │   └── validation.ts     # Request validation
│   ├── utils/
│   │   ├── logger.ts         # Winston logger
│   │   └── apiResponse.ts    # Standardized responses
│   └── index.ts              # Entry point
├── Dockerfile.dev            # Development Dockerfile
├── package.json
└── tsconfig.json
```

**Module Architecture**:
Each module (`auth`, `game`, `admin`) è self-contained con:
- Controllers (route handlers)
- Routes (Express routers)
- Services (business logic)
- WebSocket handlers (if needed)

**Entry Point**:
```typescript
// src/index.ts
import express from 'express';
import authRoutes from './modules/auth/routes';
import gameRoutes from './modules/game/routes';
import adminRoutes from './modules/admin/routes';

const app = express();

app.use('/auth', authRoutes);
app.use('/game', gameRoutes);
app.use('/admin', adminRoutes);

app.listen(3001);
```

**Details**: [Unified Backend Architecture](../02-backend/unified-backend-architecture.md)

---

### API Gateway (`services/api-gateway`)

**Purpose**: Single entry point, proxy routing, CORS, rate limiting

**Port**: 8000 (PUBLIC)
**Tech**: Express 5.2.1, http-proxy-middleware 3.x

**Structure**:
```
services/api-gateway/
├── src/
│   ├── app.ts                # Main application
│   ├── utils/
│   │   └── logger.ts         # Winston logger
│   └── index.ts              # Entry point
├── Dockerfile
├── package.json
└── tsconfig.json
```

**Proxy Routes**:
```typescript
// src/app.ts
app.use('/auth', createProxyMiddleware({
  target: 'http://unified-backend:3001/auth',
  changeOrigin: true
}));

app.use('/game', createProxyMiddleware({
  target: 'http://unified-backend:3001/game',
  changeOrigin: true
}));

app.use('/socket.io', createProxyMiddleware({
  target: 'http://unified-backend:3001',
  changeOrigin: true,
  ws: true  // WebSocket support
}));
```

**Details**: [API Gateway](../02-backend/api-gateway.md)

---

### BotAI Backend (`services/botai-backend`) - DISABLED

**Purpose**: AI-powered bot characters (temporarily disabled)

**Port**: 8080
**Tech**: Express, Anthropic SDK, Claude Sonnet 4.5

**Status**: Disabled - migrating to unified-backend

**Details**: [BotAI Backend](../02-backend/botai-backend.md)

---

### Embeddings Service (`services/embeddings-service`)

**Purpose**: ML service per generazione embeddings

**Port**: 5001
**Tech**: Flask 3.1.0, sentence-transformers

**Structure**:
```
services/embeddings-service/
├── embeddings_service.py     # Flask app
├── requirements.txt          # Python dependencies
├── Dockerfile
└── .dockerignore
```

**Model**: `paraphrase-multilingual-MiniLM-L12-v2` (384D)

**API**:
```python
@app.route('/embed', methods=['POST'])
def generate_embedding():
    text = request.json['text']
    embedding = model.encode(text)
    return jsonify({ 'embedding': embedding.tolist() })
```

**Details**: [Embeddings Architecture](../04-ai-ml/embeddings-architecture.md)

---

### Embeddings Worker (`services/embeddings-worker`)

**Purpose**: Async worker per processing embeddings via Bull queue

**Tech**: Node.js 22, Bull 4.x, TypeScript

**Structure**:
```
services/embeddings-worker/
├── src/
│   ├── workers/
│   │   └── embedding-worker.ts  # Bull worker
│   ├── config/
│   │   ├── database.ts          # MongoDB connection
│   │   └── redis.ts             # Redis connection
│   └── index.ts                 # Entry point
├── Dockerfile
├── package.json
└── tsconfig.json
```

**Job Processing**:
```typescript
// Subscribes to Redis channels
redisSubscriber.subscribe('document:created');

// On event, adds job to Bull queue
embeddingQueue.add({ documentId, text });

// Worker processes job
embeddingQueue.process(5, async (job) => {
  const embedding = await generateEmbedding(job.data.text);
  await storeInQdrant(job.data.documentId, embedding);
});
```

---

## Scripts (`/scripts`)

### Testing Scripts

```
scripts/
├── test-auth-endpoints.sh        # Test authentication API
├── test-game-endpoints.sh        # Test game logic API
├── test-housing-endpoints.sh     # Test housing system (12/13 passing)
├── test-documents-endpoints.sh   # Test documents API
├── test-create-character.sh      # Character creation flow
└── health-check.sh               # Check all services health
```

**Usage**:
```bash
# Test housing endpoints
./scripts/test-housing-endpoints.sh

# Health check all services
./scripts/health-check.sh
```

**Details**: [API Testing Scripts](../07-testing/api-testing-scripts.md)

---

### Deployment Scripts

```
scripts/
├── docker-backends.sh            # Start backend services only
├── start-dev.sh                  # Start development environment
└── backup-mongodb.sh             # MongoDB backup (future)
```

---

## Documentation (`/docs`)

**New Structure** (as of 2026-03-01):

```
docs/
├── INDEX.md                      # Master entry point
├── GLOSSARY.md                   # Victorian + tech terminology
│
├── 00-getting-started/           # Onboarding
│   ├── README.md
│   ├── tech-stack.md             # THIS FILE!
│   └── project-structure.md      # Repository organization
│
├── 01-infrastructure/            # Docker, DB, Redis, Qdrant
│   ├── README.md
│   ├── docker-compose.md         # 7 services orchestration
│   ├── mongodb-schemas.md        # 42 database schemas
│   ├── redis-pubsub.md           # Event channels
│   ├── qdrant-vector-db.md       # Vector search
│   └── environment-variables.md  # Complete env vars reference
│
├── 02-backend/                   # Backend services
│   ├── README.md
│   ├── unified-backend-architecture.md  # Module structure
│   ├── api-gateway.md            # Proxy configuration
│   ├── authentication-system.md  # Dual-token JWT
│   └── botai-backend.md          # AI service (disabled)
│
├── 03-game-systems/              # Gameplay mechanics
│   ├── README.md
│   ├── character-system.md       # Character creation (v2.0)
│   ├── location-system.md        # Hierarchical locations
│   ├── housing-system.md         # Rent/purchase system
│   ├── corporation-management.md # Corporations
│   ├── experience-points.md      # XP system
│   ├── session-management.md     # Gaming sessions
│   ├── messaging-system.md       # Postal + off-game
│   └── chat-monitoring.md        # Moderation
│
├── 04-ai-ml/                     # AI/ML systems
│   ├── README.md
│   ├── embeddings-architecture.md # Embeddings system (consolidated)
│   ├── semantic-search.md        # Qdrant integration
│   ├── botai-psychology.md       # Psychology system
│   └── botai-costs.md            # API costs
│
├── 05-frontend/                  # Frontend apps
│   ├── README.md
│   ├── websocket-patterns.md     # CRITICAL - No direct socket calls
│   ├── game-app.md               # Main gameplay
│   ├── landing-app.md            # Login, character select
│   ├── documents-app.md          # Content browsing
│   ├── management-app.md         # Admin panel
│   └── shared-ui-system.md       # Victorian design
│
├── 06-operations/                # Deployment & maintenance
│   ├── README.md
│   ├── deployment-guide.md       # Production deployment
│   ├── docker-troubleshooting.md # Common issues
│   ├── monitoring.md             # Logs, health checks
│   └── backup-restore.md         # MongoDB backup
│
├── 07-testing/
│   ├── README.md
│   ├── api-testing-scripts.md    # Bash scripts usage
│   └── wizard-testing-guide.md   # UI testing
│
├── 08-reference/                 # Game rules reference
│   ├── README.md
│   ├── call-of-cthulhu-rules.md  # CoC system
│   ├── occupations-reference.md  # 55 occupations
│   └── skills-reference.md       # Skill system
│
└── _archive/                     # Deprecated docs
    ├── README.md
    └── character-system-v1.md    # Old character system
```

**Navigation**: Ogni file ha breadcrumbs per facile navigazione

**Details**: [Documentation Index](../INDEX.md)

---

## Deployment Configs (`/deploy`)

```
deploy/
├── docker/
│   └── docker-compose.prod.yml   # Production overrides
├── nginx/
│   ├── api.conf                  # API Gateway reverse proxy
│   ├── frontend.conf             # Frontend apps serving
│   └── ssl.conf                  # SSL/TLS configuration
└── pm2/
    └── ecosystem.config.js        # PM2 config (legacy)
```

---

## Configuration Files

### Root Level

#### .nvmrc

```
22.13.1
```

**Usage**: `nvm use` (auto-reads .nvmrc)

---

#### package.json (Root)

```json
{
  "name": "tenpennynovels",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "services/*"
  ],
  "scripts": {
    "dev": "npm run dev --workspace=apps/landing",
    "docker:all:start": "docker compose up -d",
    "docker:logs": "docker compose logs -f",
    "docker:check": "./scripts/health-check.sh",
    "frontend:build": "npm run build --workspaces --if-present"
  },
  "devDependencies": {
    "@types/node": "^22.13.1",
    "typescript": "^5.7.2"
  }
}
```

**Workspaces**: npm automaticamente linka dependencies tra apps/services

---

#### docker-compose.yml

**7 Services**:
1. MongoDB (27017)
2. Redis (6379)
3. Qdrant (6333)
4. Embeddings Service (5001)
5. Embeddings Worker
6. Unified Backend (3001)
7. API Gateway (8000)

**Details**: [Docker Compose](../01-infrastructure/docker-compose.md)

---

#### .env

**CRITICAL**: Never commit this file!

**Template**: Copy from `.env.example`

```bash
cp .env.example .env
nano .env  # Edit with your values
```

**Details**: [Environment Variables](../01-infrastructure/environment-variables.md)

---

#### .gitignore

```
# Dependencies
node_modules/

# Build output
.next/
out/
dist/
build/

# Environment
.env
.env.local
.env.*.local

# Logs
logs/
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
```

---

## Common Paths Reference

### Frontend Apps

```
apps/landing/               - Landing app root
apps/landing/src/           - Source code
apps/landing/public/        - Static assets
apps/landing/out/           - Build output (static HTML)

apps/game/                  - Game app root
apps/game/src/              - Source code
apps/game/src/components/   - React components
apps/game/src/contexts/     - React contexts (WebSocket, Game, Auth)
apps/game/src/pages/        - Next.js pages
apps/game/public/           - Static assets
```

---

### Backend Services

```
services/unified-backend/src/                    - Source code
services/unified-backend/src/modules/            - Feature modules
services/unified-backend/src/database/models/    - 42 Mongoose schemas
services/unified-backend/logs/                   - Winston logs

services/api-gateway/src/                        - Source code

services/embeddings-service/                     - Flask service
services/embeddings-worker/src/                  - Worker code
```

---

### Testing

```
scripts/test-*.sh           - API testing scripts
apps/*/src/               - Frontend tests (future)
```

---

### Documentation

```
docs/INDEX.md               - Documentation entry point
docs/00-getting-started/    - Onboarding guides
docs/01-infrastructure/     - Docker, DB, Redis
docs/02-backend/            - Backend services
docs/03-game-systems/       - Game mechanics
docs/04-ai-ml/              - AI/ML systems
docs/05-frontend/           - Frontend apps
docs/06-operations/         - Deployment, ops
docs/07-testing/            - Testing guides
docs/08-reference/          - Game rules reference
```

---

## Development Workflow

### 1. Clone Repository

```bash
git clone git@github.com:your-org/tenpennynovels.git
cd tenpennynovels
```

---

### 2. Install Dependencies

```bash
# Switch to correct Node version
nvm use

# Install all workspaces
npm install
```

**npm workspaces** auto-installa dependencies per tutti apps/services

---

### 3. Configure Environment

```bash
# Copy template
cp .env.example .env

# Edit
nano .env

# Set required variables
# - MONGODB_URI
# - REDIS_URL
# - JWT_SECRET
# - JWT_REFRESH_SECRET
```

---

### 4. Start Services

```bash
# Option 1: Docker (recommended)
docker compose up -d

# Option 2: Individual services
cd services/unified-backend && npm run dev
cd services/api-gateway && npm run dev
```

---

### 5. Start Frontend

```bash
# Landing app
npm run dev --workspace=apps/landing

# Game app
npm run dev --workspace=apps/game

# Documents app
npm run dev --workspace=apps/documents

# Management app
npm run dev --workspace=apps/management
```

---

### 6. Test

```bash
# Health check
./scripts/health-check.sh

# API tests
./scripts/test-auth-endpoints.sh
./scripts/test-game-endpoints.sh
./scripts/test-housing-endpoints.sh
```

---

## Build & Deploy

### Build Frontend

```bash
# Build all apps
npm run frontend:build

# Or individually
cd apps/landing && npm run build && npm run export
cd apps/game && npm run build && npm run export
```

**Output**: Static HTML in `apps/*/out/`

---

### Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy each app
cd apps/landing && vercel --prod
cd apps/game && vercel --prod
cd apps/documents && vercel --prod
cd apps/management && vercel --prod
```

---

### Deploy Backend (Docker)

```bash
# Production server
git pull origin main
docker compose build
docker compose -f docker-compose.yml -f deploy/docker/docker-compose.prod.yml up -d
```

**Details**: [Deployment Guide](../06-operations/deployment-guide.md)

---

## Related Documentation

- [Tech Stack](./tech-stack.md) - Complete technology overview
- [Docker Compose](../01-infrastructure/docker-compose.md) - Service orchestration
- [MongoDB Schemas](../01-infrastructure/mongodb-schemas.md) - Database structure
- [Deployment Guide](../06-operations/deployment-guide.md) - Production deployment

---

## Quick Reference

**Monorepo**: npm workspaces
**Node Version**: 22.13.1 (.nvmrc)
**Frontend Apps**: 4 (landing, game, documents, management)
**Backend Services**: 3 (unified-backend, api-gateway, embeddings-service/worker)
**Total Schemas**: 42 MongoDB collections
**Public Entry**: http://localhost:8000 (API Gateway)
**Docs Entry**: [INDEX.md](../INDEX.md)
