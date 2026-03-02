# TenpennyNovels Documentation

> Victorian Role-Playing Game via chat — London 1880s — Call of Cthulhu d100 System

**Status**: ✅ Production | **Last Updated**: 2026-03-01 | **Version**: 2.0

---

## 🚀 Quick Start

### New to TenpennyNovels?
- **First Time Setup** → [Getting Started Guide](./00-getting-started/README.md)
- **Docker Environment** → [Docker Compose Setup](./01-infrastructure/docker-compose.md)
- **Understanding the Stack** → [Tech Stack Overview](./00-getting-started/tech-stack.md)

### Quick Links by Role

**For Developers:**
- [Project Structure](./00-getting-started/project-structure.md) - Repository organization
- [Infrastructure Overview](./01-infrastructure/README.md) - Docker, MongoDB, Redis, Qdrant
- [Backend Architecture](./02-backend/unified-backend-architecture.md) - Modules and routing
- [Frontend Apps](./05-frontend/README.md) - Next.js applications
- [WebSocket Patterns](./05-frontend/websocket-patterns.md) - Real-time communication

**For Operations:**
- [Deployment Guide](./06-operations/deployment-guide.md) - Production deployment
- [Docker Troubleshooting](./06-operations/docker-troubleshooting.md) - Common issues
- [Monitoring](./06-operations/monitoring.md) - Logs and health checks
- [Backup & Restore](./06-operations/backup-restore.md) - Database backup

**For QA/Testing:**
- [Testing Strategy](./07-testing/README.md) - Testing overview
- [API Testing Scripts](./07-testing/api-testing-scripts.md) - Automated testing
- [Character Wizard Testing](./07-testing/wizard-testing-guide.md) - UI testing

---

## 📚 Documentation Map

### [00 - Getting Started](./00-getting-started/README.md)
Onboarding rapido per nuovi sviluppatori. Setup environment, tech stack, project structure.

**Key Files:**
- [README.md](./00-getting-started/README.md) - Quick start guide
- [Tech Stack](./00-getting-started/tech-stack.md) - Node 22, Express 5.2.1, MongoDB, Redis
- [Project Structure](./00-getting-started/project-structure.md) - Repository organization

---

### [01 - Infrastructure](./01-infrastructure/README.md)
Docker, database, caching, vector search infrastructure.

**Key Files:**
- [Docker Compose](./01-infrastructure/docker-compose.md) - 7 services orchestration
- [MongoDB Schemas](./01-infrastructure/mongodb-schemas.md) - 44+ database models
- [Redis Pub/Sub](./01-infrastructure/redis-pubsub.md) - Event channels
- [Qdrant Vector DB](./01-infrastructure/qdrant-vector-db.md) - Semantic search
- [Environment Variables](./01-infrastructure/environment-variables.md) - Complete env reference

---

### [02 - Backend](./02-backend/README.md)
Backend services architecture: unified-backend, API gateway, BotAI.

**Key Files:**
- [Unified Backend Architecture](./02-backend/unified-backend-architecture.md) - Modular architecture
- [API Gateway](./02-backend/api-gateway.md) - Proxy and WebSocket routing
- [Authentication System](./02-backend/authentication-system.md) - Dual-token JWT
- [BotAI Backend](./02-backend/botai-backend.md) - NPC AI system
- [API Reference](./02-backend/api-reference.md) - All endpoints

---

### [03 - Game Systems](./03-game-systems/README.md)
Gameplay mechanics: characters, locations, housing, experience, corporations.

**Key Files:**
- [Character System](./03-game-systems/character-system.md) - Call of Cthulhu character creation
- [Location System](./03-game-systems/location-system.md) - Hierarchical locations
- [Housing System](./03-game-systems/housing-system.md) - Property rental and ownership
- [Corporation Management](./03-game-systems/corporation-management.md) - Organizations
- [Experience Points](./03-game-systems/experience-points.md) - XP and skill advancement
- [Session Management](./03-game-systems/session-management.md) - Turn-based gameplay
- [Messaging System](./03-game-systems/messaging-system.md) - Postal and off-game chat
- [Chat Monitoring](./03-game-systems/chat-monitoring.md) - Moderation system

---

### [04 - AI & Machine Learning](./04-ai-ml/README.md)
Embeddings, semantic search, bot psychology system.

**Key Files:**
- [Embeddings Architecture](./04-ai-ml/embeddings-architecture.md) - Vector generation pipeline
- [Semantic Search](./04-ai-ml/semantic-search.md) - Document retrieval
- [BotAI Psychology](./04-ai-ml/botai-psychology.md) - Psychology axes and central wound
- [BotAI Costs](./04-ai-ml/botai-costs.md) - Cost optimization

---

### [05 - Frontend](./05-frontend/README.md)
Next.js applications: landing, game, documents, management.

**Key Files:**
- [WebSocket Patterns](./05-frontend/websocket-patterns.md) - **CRITICAL** real-time patterns
- [Game App](./05-frontend/game-app.md) - Main gameplay interface
- [Landing App](./05-frontend/landing-app.md) - Login and character selection
- [Documents App](./05-frontend/documents-app.md) - Knowledge base
- [Management App](./05-frontend/management-app.md) - Admin panel
- [Shared UI System](./05-frontend/shared-ui-system.md) - Victorian design system

---

### [06 - Operations](./06-operations/README.md)
Deployment, monitoring, troubleshooting, backup strategies.

**Key Files:**
- [Deployment Guide](./06-operations/deployment-guide.md) - Production deployment
- [Docker Troubleshooting](./06-operations/docker-troubleshooting.md) - Common issues
- [Monitoring](./06-operations/monitoring.md) - Logs and health checks
- [Backup & Restore](./06-operations/backup-restore.md) - Database backup

---

### [07 - Testing](./07-testing/README.md)
Testing strategy, API scripts, UI testing guides.

**Key Files:**
- [API Testing Scripts](./07-testing/api-testing-scripts.md) - Automated API testing
- [Character Wizard Testing](./07-testing/wizard-testing-guide.md) - UI testing guide

---

### [08 - Reference](./08-reference/README.md)
Game rules, occupations, skills, items reference material.

**Key Files:**
- [Call of Cthulhu Rules](./08-reference/call-of-cthulhu-rules.md) - Victorian adaptation
- [Occupations Reference](./08-reference/occupations-reference.md) - 55 occupations
- [Skills Reference](./08-reference/skills-reference.md) - Complete skill system

---

## 🔍 Find What You Need

### Common Tasks

**"I need to set up my local environment"**
→ [Getting Started](./00-getting-started/README.md) → [Docker Compose](./01-infrastructure/docker-compose.md)

**"I want to understand the backend architecture"**
→ [Unified Backend Architecture](./02-backend/unified-backend-architecture.md) → [API Gateway](./02-backend/api-gateway.md)

**"I need to add a new API endpoint"**
→ [Unified Backend Architecture](./02-backend/unified-backend-architecture.md) → [API Reference](./02-backend/api-reference.md)

**"I'm getting Docker errors"**
→ [Docker Troubleshooting](./06-operations/docker-troubleshooting.md)

**"I want to test the API"**
→ [API Testing Scripts](./07-testing/api-testing-scripts.md)

**"How do I integrate WebSocket in a component?"**
→ [WebSocket Patterns](./05-frontend/websocket-patterns.md) - **Read the CRITICAL RULE first**

**"How does the location system work?"**
→ [Location System](./03-game-systems/location-system.md)

**"How does the housing system work?"**
→ [Housing System](./03-game-systems/housing-system.md)

**"How do embeddings and semantic search work?"**
→ [Embeddings Architecture](./04-ai-ml/embeddings-architecture.md) → [Semantic Search](./04-ai-ml/semantic-search.md)

**"How does the bot AI work?"**
→ [BotAI Backend](./02-backend/botai-backend.md) → [BotAI Psychology](./04-ai-ml/botai-psychology.md)

---

## 📊 System Overview

### Technology Stack
- **Backend**: Node.js 22, Express 5.2.1, TypeScript 5.9.3
- **Frontend**: Next.js 16, React 18/19, TypeScript 5.9.3
- **Database**: MongoDB 7.0 (Mongoose 9.2.1), Redis 7.2, Qdrant 1.17
- **Real-time**: Socket.IO 4.8.3
- **AI/ML**: Claude Sonnet 4.5, Sentence Transformers (paraphrase-multilingual-MiniLM-L12-v2)

### Services Architecture
```
Frontend Apps (Next.js)
  ↓
API Gateway (Port 8000) ← WebSocket Upgrade
  ↓
Unified Backend (Port 3001)
  ├── auth module
  ├── game module
  ├── admin module
  ├── forum module
  └── documents module
  ↓
Infrastructure
  ├── MongoDB (Port 27017) - 44+ schemas
  ├── Redis (Port 6379) - Pub/Sub + Caching
  ├── Qdrant (Port 6333) - Vector search
  ├── Embeddings Service (Port 5001) - Flask ML service
  └── Embeddings Worker - Bull queue processor
```

### Frontend Applications
- **Landing** (Port 4000) - Login, registration, character selection
- **Game** (Port 4001) - Main gameplay interface
- **Documents** (Port 4003) - Knowledge base and documentation
- **Management** (Port 4004) - Admin panel

---

## 📖 Glossary

For Victorian terminology and technical terms, see [GLOSSARY.md](./GLOSSARY.md).

---

## 🗂️ Archive

Deprecated documentation is preserved in [`_archive/`](./_archive/README.md) for historical reference.

---

## 🤝 Contributing to Documentation

When updating documentation:

1. **Use lowercase-with-dashes** for filenames
2. **Add breadcrumbs** at the top: `**Navigation**: [Home](../INDEX.md) > [Category](./README.md) > Current`
3. **Add status badge**: `**Status**: ✅ Production Ready | 🚧 In Development | 📦 Deprecated`
4. **Update last modified date**: `**Last Updated**: YYYY-MM-DD`
5. **Add related docs** section at the bottom
6. **Test all links** before committing

---

**Questions?** Check the [Getting Started Guide](./00-getting-started/README.md) or consult the specific system documentation above.
