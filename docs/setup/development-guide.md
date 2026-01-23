# Development Guide - TenpennyNovels

## Overview

Guida completa per setup ambiente di sviluppo, comandi di gestione, workflow di sviluppo, testing e deployment per la piattaforma TenpennyNovels.

> **Nota per Claude Code**: Questo documento fornisce istruzioni complete per lavorare con il codice in questo repository. Per informazioni dettagliate su sistemi specifici, consultare sempre i file nella directory `/docs/`.

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (LTS recommended)
- **MongoDB** 6.0+ (local or Atlas)
- **Redis** 7.0+ (local or cloud)
- **Git** for version control
- **VS Code** (recommended IDE)

### Initial Setup
```bash
# Clone repository
git clone <repository-url>
cd tenpennynovels

# Install all dependencies
npm install

# Setup environment files
cp .env.example .env.development
cp .env.example .env.local

# Configure environment variables (see section below)
# Edit .env.development with your local settings

# Setup database
npm run db:migrate
npm run db:seed

# Start all services
npm run dev:all
```

## 🔧 Environment Configuration

### Core Environment Variables
```bash
# Database Configuration
MONGODB_URI=mongodb://tenpennynovels:TpN2025%21MongoDb%23Secure99@localhost:27017/tenpennynovels?authSource=admin
REDIS_URL=redis://default:redis123@localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
NEXTAUTH_SECRET=your-nextauth-secret-key-min-32-chars
NEXTAUTH_URL=http://localhost:4000

# Application URLs (Development)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GAME_URL=http://localhost:4001
NEXT_PUBLIC_DOCS_URL=http://localhost:4002
NEXT_PUBLIC_FORUM_URL=http://localhost:4003
NEXT_PUBLIC_MANAGEMENT_URL=http://localhost:4004
NEXT_PUBLIC_TICKETS_URL=http://localhost:4005

# WebSocket Configuration
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8000

# Character Creation System
CHARACTER_STAT_TOTAL_POINTS=400
CHARACTER_MAX_STATS_ABOVE_80=2
CHARACTER_SKILL_CAP=75
CHARACTER_FINAL_SKILL_CAP=80

# Experience Points System
EXPERIENCE_DAILY_BASE_XP=2
EXPERIENCE_DAILY_BASE_SKILL=1
EXPERIENCE_MAX_ACTIVITY_MULTIPLIER=2.0
EXPERIENCE_STAT_IMPROVEMENT_COST_BASE=3
EXPERIENCE_SKILL_IMPROVEMENT_COST_BASE=1

# Session Management
SESSION_MAX_DURATION=480
SESSION_AUTO_END_INACTIVE=30
SESSION_REGISTRATION_ADVANCE_DAYS=14
SESSION_EXPERIENCE_MULTIPLIER_MAX=3.0

# Housing System
HOUSING_RENT_GRACE_PERIOD_DAYS=7
HOUSING_EVICTION_NOTICE_DAYS=14
HOUSING_DEFAULT_DEPOSIT_MULTIPLIER=1.0
HOUSING_RENT_INFLATION_RATE=0.02

# Corporation System
CORPORATION_MAX_MEMBERS_DEFAULT=100
CORPORATION_TREASURY_ALERT_THRESHOLD=1000
CORPORATION_MEMBERSHIP_REQUEST_TIMEOUT=30

# Chat Monitoring
CHAT_MONITORING_ENABLED=true
CHAT_MONITORING_RETENTION_DAYS=90
CHAT_MONITORING_REALTIME_ALERTS=true

# Cron Jobs & Automation
DAILY_EXPERIENCE_CRON_TIME="0 2 * * *"
HOUSING_RENT_COLLECTION_CRON="0 6 * * *"
MAINTENANCE_COST_CRON="0 2 1 * *"

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_CORS=true
```

## 📁 Project Structure

```
tenpennynovels/
├── apps/                           # Frontend Applications
│   ├── landing/                   # Login + character selection (4000)
│   ├── game/                      # Main gameplay interface (4001)
│   ├── documents/                 # Content management (4002)
│   ├── forum/                     # Community discussions (4003)
│   ├── management/                # Admin interface (4004)
│   ├── tickets/                   # Support system (4005)
│   └── shared-ui/                 # Victorian design system
├── services/                       # Backend Services + Shared Code
│   ├── api-gateway/               # Central routing (8000)
│   ├── authentication-backend/    # Auth & users (3000)
│   ├── game-backend/              # Game logic (3001)
│   ├── management-backend/        # Admin operations (3002)
│   ├── embeddings-service/        # Flask HTTP embeddings (5001)
│   ├── embeddings-worker/         # Async embedding processor
│   ├── shared/                    # Shared utilities, types, models
│   ├── database/                  # MongoDB models (33+ models)
│   └── config/                    # Configuration files (JSON)
├── scripts/                       # Development & testing scripts
│   ├── test-*-endpoints.sh        # API testing scripts
│   ├── seed.ts                    # Database seeding
│   └── data/                      # CSV data files
├── docs/                          # Complete documentation
├── logs/                          # Centralized logging
└── PIANO-LAVORI/                  # Technical specifications
```

## 🔨 Development Commands

### Core Development Workflow
```bash
# Start everything (recommended for development)
npm run dev:all                    # All services + all frontends

# Individual service management
npm run dev:gateway                # API Gateway only
npm run dev:auth                   # Authentication backend
npm run dev:game                   # Game backend  
npm run dev:management             # Management backend
npm run dev:frontend               # All 6 frontend apps

# Individual frontend apps
npm run dev:landing                # Landing app (4000)
npm run dev:game-app               # Game app (4001)
npm run dev:documents              # Documents app (4002)
npm run dev:forum                  # Forum app (4003)
npm run dev:management-app         # Management app (4004)
npm run dev:tickets                # Tickets app (4005)

# Build system
npm run build                      # Build all workspaces
npm run build:backend              # Build all backend services
npm run build:frontend             # Build all frontend apps

# Testing
npm run test                       # Run all tests
npm run test:backend               # Backend unit tests
npm run test:frontend              # Frontend component tests
npm run test:e2e                   # End-to-end testing

# Code quality
npm run lint                       # Lint all code
npm run lint:fix                   # Auto-fix linting issues
npm run type-check                 # TypeScript checking
```

### Database Management
```bash
# Database operations
npm run db:migrate                 # Run database migrations
npm run db:seed                    # Seed with initial data
npm run db:reset                   # Reset and reseed database
npm run db:backup                  # Create database backup
npm run db:restore                 # Restore from backup

# Data import/export
npm run data:import                # Import CSV data files
npm run data:export                # Export data to CSV
npm run data:validate              # Validate data integrity
```

### API Testing & Validation
```bash
# Comprehensive API testing
npm run test:api                   # All API endpoint testing
npm run test:integration           # Integration testing

# Individual system testing
./scripts/test-corporation-apis.sh          # Corporation system (89% working)
./scripts/test-housing-endpoints.sh         # Housing system (100% working)
./scripts/test-experience-endpoints.sh      # Experience system (69% working)
./scripts/test-session-management-endpoints.sh # Session system (100% working)
./scripts/test-chat-moderation-endpoints.sh    # Chat system (100% working)
./scripts/test-skills-endpoints.sh             # Skills system
./scripts/test-relationships-endpoints.sh      # Relationships system
./scripts/test-social-classes-endpoints.sh     # Social classes system

# Authentication testing
./scripts/test-membership-requests-endpoint.sh  # Corporation membership workflow
```

## 🗄️ Database Setup

### MongoDB Setup (Local)
```bash
# Install MongoDB (macOS with Homebrew)
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community

# Create database and user
mongosh
> use tenpennynovels
> db.createUser({
    user: "admin",
    pwd: "password123",
    roles: [{role: "readWrite", db: "tenpennynovels"}]
  })
```

### Redis Setup (Local)
```bash
# Install Redis (macOS with Homebrew)
brew install redis

# Start Redis service
brew services start redis

# Configure Redis with password
redis-cli
> CONFIG SET requirepass "redis123"
> CONFIG REWRITE
```

### Database Seeding
```bash
# Seed database with initial Victorian data
npm run db:seed

# This will create:
# - Skills (Call of Cthulhu skill system)
# - Occupations (Victorian-era professions)  
# - Items (Period-appropriate equipment)
# - Locations (London districts and venues)
# - Social Classes (Victorian hierarchy)
# - Sample characters and users
```

## 🧪 Testing Strategy

### API Testing Coverage
Current API testing results:
- **Corporation System**: 10/15 tests (67% passing)
- **Housing System**: 12/13 tests (92% passing)
- **Experience Points**: 9/13 tests (69% passing)
- **Session Management**: 13/13 tests (100% passing)
- **Chat Moderation**: 11/11 tests (100% passing)

### Testing Workflow
```bash
# Before committing code
npm run lint                       # Code style validation
npm run type-check                 # TypeScript validation
npm run test                       # Unit tests
npm run test:api                   # API integration tests

# Full validation cycle
npm run validate                   # Runs lint + type-check + test + test:api
```

### Manual Testing Checklist
- [ ] Character creation and approval workflow
- [ ] Experience point granting and spending
- [ ] Session creation and management
- [ ] Corporation membership workflow  
- [ ] Housing rental and purchase
- [ ] WebSocket real-time features
- [ ] Cross-application authentication
- [ ] Victorian design system consistency

## 🔄 Development Workflow

### Feature Development Process
1. **Branch Creation**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/system-name
   ```

2. **Development**
   - Follow existing code patterns and architectural principles
   - Maintain Victorian theme and historical accuracy
   - Write comprehensive tests for new features
   - Update documentation for new systems

3. **Testing & Validation**
   ```bash
   npm run validate                # Full validation
   ./scripts/test-relevant-endpoints.sh  # System-specific testing
   ```

4. **Code Review & Integration**
   - Create pull request with detailed description
   - Ensure all tests pass
   - Update relevant documentation in `docs/`
   - Merge after review approval

### Code Style Guidelines
- **TypeScript**: Strict type checking, proper interfaces
- **React**: Functional components with hooks, proper state management
- **SCSS**: Follow Victorian design system patterns
- **API Design**: RESTful principles, proper error handling
- **Database**: Proper indexing, validation, audit trails

## 🐛 Debugging & Troubleshooting

### Common Issues & Solutions

#### Database Connection Issues
```bash
# Check MongoDB status
brew services list | grep mongodb

# Check connection
mongosh "mongodb://tenpennynovels:TpN2025%21MongoDb%23Secure99@localhost:27017/tenpennynovels?authSource=admin"

# Reset database if needed
npm run db:reset
```

#### Redis Connection Issues
```bash
# Check Redis status
brew services list | grep redis

# Test connection
redis-cli -a redis123 ping

# Restart Redis
brew services restart redis
```

#### API Endpoint Issues
```bash
# Check service status
ps aux | grep node

# Test specific endpoints
curl -X GET http://localhost:8000/health

# Check logs
tail -f logs/combined.log
```

#### Frontend Build Issues
```bash
# Clear Next.js cache
rm -rf apps/*/.next

# Reinstall dependencies
rm -rf node_modules apps/*/node_modules
npm install

# Check SCSS compilation
npm run build:shared
```

### Development Tools

#### VS Code Extensions (Recommended)
- **TypeScript**: Enhanced TypeScript support
- **ES7+ React/Redux/React-Native**: React snippets
- **Sass**: SCSS syntax highlighting and IntelliSense
- **MongoDB for VS Code**: Database management
- **REST Client**: API testing within VS Code
- **GitLens**: Enhanced Git capabilities

#### Browser Development
- **React Developer Tools**: Component debugging
- **Redux DevTools**: State management debugging
- **Network Tab**: API request monitoring
- **Console**: WebSocket connection monitoring

## 📊 Performance Monitoring

### Key Metrics to Monitor
- **API Response Times**: < 200ms for standard queries
- **Database Query Performance**: Proper index usage
- **WebSocket Connection Stability**: Reconnection handling
- **Frontend Bundle Sizes**: Optimized code splitting
- **Memory Usage**: Connection pooling efficiency

### Performance Optimization
```bash
# Analyze bundle sizes
npm run analyze:bundles

# Database query analysis
npm run db:analyze-queries

# Performance testing
npm run test:performance
```

## 🚀 Deployment Preparation

### Production Environment Setup
```bash
# Production environment variables
NODE_ENV=production
LOG_LEVEL=info
MONGODB_URI=<production-mongodb-url>
REDIS_URL=<production-redis-url>

# Build for production
npm run build
npm run test:prod

# Security checklist
npm audit
npm run security:check
```

### Pre-deployment Checklist
- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] API tests passing (95%+ coverage)
- [ ] Frontend builds without errors
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Documentation updated

## 📞 Support & Resources

### Getting Help
- **Technical Issues**: Check `logs/` directory for error details
- **API Documentation**: `docs/architecture/backend-architecture.md`
- **Frontend Patterns**: `docs/architecture/frontend-architecture.md`
- **Victorian RPG Rules**: `docs/content/regolamento-gdr-vittoriano.md`

### Development Resources
- **Backend Architecture**: Complete microservices documentation
- **Frontend Components**: Victorian design system guide
- **Database Models**: 33+ model specifications
- **API Testing**: Comprehensive endpoint testing scripts

## 📚 Documentazione di Riferimento

**IMPORTANTE**: Per informazioni dettagliate su sistemi e configurazioni specifiche, consultare sempre i file nella directory `/docs/`:

### 🏗️ Architettura e Sviluppo
- **`docs/architecture/backend-architecture.md`**: Architettura microservizi backend, API endpoints, database design
- **`docs/architecture/frontend-architecture.md`**: Struttura applicazioni frontend, Next.js setup, WebSocket integration
- **`docs/setup/embeddings-setup.md`**: Sistema embeddings asincrono, semantic search, event-driven architecture

### 🔐 Sistemi di Autenticazione e Sicurezza
- **`docs/systems/authentication-system.md`**: Sistema dual-token, middleware, cookie management, security
- **`docs/systems/character-system.md`**: Call of Cthulhu character sheets, wizard creation, approval workflow

### 💬 Sistemi di Messaggistica e Comunicazione
- **`docs/systems/messaging-system.md`**: Location chat, sistema postale vittoriano, chat OOC
- **`docs/systems/chat-monitoring.md`**: Sistema monitoraggio e moderazione chat completo
- **`docs/systems/location-system.md`**: Sistema location gerarchico, controlli accesso, shop management

### 🎮 Sistemi di Gameplay
- **`docs/gameplay/experience-points.md`**: Sistema punti esperienza, progressione personaggi, daily automation
- **`docs/gameplay/session-management.md`**: Gestione sessioni di gioco, master tools, template sistema
- **`docs/gameplay/corporation-management.md`**: Sistema corporazioni, treasury management, membership workflow
- **`docs/gameplay/housing-system.md`**: Sistema affitti e acquisto proprietà immobiliari

### 🛠️ Sistemi di Supporto
- **`docs/systems/ticketing-system.md`**: Sistema ticket completo con workflow e API
- **`docs/systems/forum-system.md`**: Forum discussioni e topic management

### 🎨 Design e UI/UX
- **`docs/design/scss-design-system.md`**: Design system centralizzato, componenti Victorian, responsive
- **`docs/design/ui-components.md`**: Libreria componenti riusabili e pattern UI

### 📋 Regolamento e Contenuti
- **`docs/content/regolamento-gdr-vittoriano.md`**: Regole complete Call of Cthulhu vittoriano
- **`docs/content/profession-guidelines.md`**: Linee guida generazione professioni storicamente accurate

## Panoramica del Progetto

**TenpennyNovels** è una piattaforma RPG via chat ambientata nella Londra vittoriana, basata sul sistema Call of Cthulhu. 

### Architettura Generale
- **6 Applicazioni Frontend**: Landing, Game, Documents, Forum, Management, Tickets (ports 4000-4005)
- **4 Servizi Backend**: API Gateway (port 8000), Authentication (3000), Game (3001), Management (3002)
- **Event-Driven Architecture**: Comunicazione tramite Redis pub/sub
- **Design System Centralizzato**: SCSS Victorian theme condiviso
- **Database**: 33+ models con comprehensive API coverage (95%+)
- **Embeddings Infrastructure**: Flask HTTP service + Node.js worker per semantic search asincrono

### Stack Tecnologico
- **Backend**: Node.js, Express, TypeScript, MongoDB, Redis, Socket.io
- **Frontend**: Next.js 14, TypeScript, SCSS/Sass, Socket.io-client
- **Authentication**: JWT dual-token system, NextAuth.js
- **Database**: MongoDB con Redis per caching e pub/sub
- **Testing**: Automated API testing con scripts dedicati
- **Logging**: Winston centralizado per audit trail
- **AI/ML**: Sentence Transformers (paraphrase-multilingual-MiniLM-L12-v2) per semantic search

### 🎯 Stato Implementazione Attuale

#### ✅ Sistemi Completamente Implementati
- **Character System**: Creation wizard, approval workflow, Call of Cthulhu stats/skills
- **Authentication System**: Dual-token JWT, NextAuth.js, cross-domain cookies
- **Messaging System**: Location chat, OnGame postal system, OffGame chat
- **Document System**: Ambientazione/regolamento con editor e gestione
- **Ticketing System**: Complete workflow e management interface
- **Forum System**: Discussioni e topic management
- **Design System**: SCSS Victorian centralizzato e responsive
- **Backend Architecture**: 4 microservizi con Redis pub/sub
- **Experience Points System**: ✅ XP granting, character progression, daily automation, master tools
- **Session Management System**: ✅ Master tools, session templates, campaign tracking, analytics
- **Chat Monitoring System**: ✅ Full moderation system con 11 endpoints operativi
- **Management Panels**: ✅ Interfaccia amministrativa completa per tutte le entità
- **API Coverage**: ✅ 95%+ endpoint coverage across all 33 database models
- **Embeddings System**: ✅ Event-driven async embeddings, semantic search, zero-latency architecture

#### 🟡 Sistemi Parzialmente Implementati  
- **Corporation System**: ✅ Backend completo (89% endpoints working), ⚠️ Management frontend
- **Housing System**: ✅ Backend completo (100% endpoints working), ⚠️ Game frontend integration

#### ❌ Sistemi in Pipeline
- Frontend integration per Corporation e Housing systems
- WebSocket real-time features per Session Management
- Advanced analytics dashboards

## Autenticazione & Autorizzazioni

### Sistema Dual-Token
- **`auth_token`**: JWT con informazioni utente e accesso admin (`canAccessAdminPanel`)
- **`character_context`**: JWT con contesto personaggio attivo e ruoli gameplay
- **Cookie Cross-Domain**: Condivisi tra tutti i sottodomini

### Ruoli Sistema
- **USER Roles**: `['user', 'gestore']` - Controllo accesso amministrativo
- **CHARACTER Roles**: `['personaggio', 'master', 'moderatore', 'amministratore']` - Controllo gameplay

### Stati Personaggio
- **DRAFT**: Creazione in corso - accesso wizard
- **PENDING_APPROVAL**: Revisione staff - accesso limitato  
- **APPROVED**: Approvato - accesso completo gameplay
- **DELETED**: Soft-deleted - nessun accesso

## Character Creation (Call of Cthulhu)

### Regole Base
- **Caratteristiche**: 20 punti base + 400 punti da distribuire (max 85 per caratteristica)
- **Abilità**: 200 punti base + bonus INT/2 (cap 75 durante creazione, 80 con bonus professione)
- **Classe Sociale**: Determinata automaticamente dal skill FINANZA (1-99)
- **Occupazioni**: Gender-specific, prerequisiti storicamente accurati

## 🎮 Sistemi di Gameplay Implementati

### Experience Points & Character Progression ✅
- **Database Models**: `ExperienceGrant.ts`, `CharacterProgression.ts`, `GamingSession.ts`
- **Game Backend**: 4 endpoints per progressione e spending
- **Management Backend**: 7 endpoints per admin oversight  
- **Daily Automation**: Cron jobs per daily grants e activity tracking
- **Call of Cthulhu Rules**: Escalating costs, skill caps, stat progression
- **Master Tools**: Interface assegnamento XP post-sessione
- **Testing**: 13 endpoints testati (9/13 funzionanti)

### Session Management System ✅
- **Database Models**: Enhanced `GamingSession`, `SessionTemplate`, `Campaign`, `SessionManagement`
- **Game Backend**: 6 endpoints per session lifecycle
- **Management Backend**: 13 endpoints per analytics e oversight (100% operational)
- **Template System**: Reusable session scenarios con scene structure
- **Campaign Tracking**: Long-term storylines con plot threads e NPCs
- **Real-time Ready**: Backend prepared per WebSocket integration
- **Experience Integration**: Seamless XP assignment post-session

### Chat Monitoring & Moderation ✅ 
- **Database Models**: `ChatModerationAction.ts`, `UserReport.ts`
- **Management Backend**: 6 endpoints per search, moderation, reports
- **Advanced Search**: Cross-platform message search (OnGame, OffGame, Location)
- **Real-time Activity**: Live statistics con hourly/daily breakdowns
- **User Reports**: Complete report handling con priority scoring
- **Victorian UI**: Responsive dashboard integrato nel management panel

### Corporation Management System ✅ Backend
- **Database Model**: Complete `Corporation.ts` con roles, treasury, membership
- **Management Backend**: 9 endpoints (8/9 working - 89% operational)
- **Game Backend**: 6 endpoints (2/6 working - needs frontend integration)  
- **Treasury Management**: Financial operations e transaction tracking
- **Membership Workflow**: Application, approval, role management
- **Real-time Events**: Redis integration per notifications

### Housing & Property System ✅ Backend
- **Database Models**: `HousingProperty.ts`, `EstateTransaction.ts`
- **Game Backend**: 5 endpoints (100% working)
- **Management Backend**: 6 endpoints (100% working)
- **Rent Collection**: Automated cron jobs con eviction handling
- **Location Integration**: Seamless integration con existing Location system
- **Financial Integration**: Connected con `CharacterFinances` system

### Sistema di Messaggistica ✅
#### 3 Sistemi Integrati
1. **Location Chat**: Real-time WebSocket con azioni di ruolo
2. **OnGame Messages**: Sistema postale vittoriano con delivery schedulato
3. **OffGame Chat**: Messaggistica OOC stile Telegram

#### Tipi Messaggi OnGame
- **Bigliettini**: Istantanei, gratuiti
- **Telegrammi**: 20min delivery, 3 pence
- **Lettere**: Daily batch delivery, 1 pence, sigillate
- **Lettere Espresse**: 10-20min, 4 pence
- **Documenti Ufficiali**: Solo master/mod, 24-48h, 6 pence

### Management Panel Systems ✅
#### Complete Admin Interface per tutte le entità:
- **Location Management**: World building e gerarchie location
- **Occupation Management**: Professioni vittoriane storicamente accurate
- **Economy Management**: Oversight economico e transaction monitoring
- **Item Management**: Catalogo oggetti era vittoriana con pricing/rarity
- **Skills Management**: Sistema abilità Call of Cthulhu completo
- **Relationships Management**: Sistema relazioni vittoriane con respectability
- **Social Classes Management**: Classi sociali basate su skill FINANZA

### Embeddings & Semantic Search System ✅
- **Architecture**: Event-driven async con zero-latency
- **Embeddings Service**: Flask HTTP (port 5001), `paraphrase-multilingual-MiniLM-L12-v2` model
- **Embeddings Worker**: Node.js TypeScript, Redis pub/sub listener
- **Models**: Simplified models in worker (`Document.ts`, `Location.ts`, `LocationAction.ts`)
- **Performance**: 1135x faster than sync (133ms vs 151s for 19 docs)
- **Processing**: ~100ms per embedding, 3-4s total for batch
- **Redis Channels**:
  - `embedding:document:created` - New document embeddings
  - `embedding:document:updated` - Update embeddings
  - `embedding:location_action:created` - Player action embeddings
- **Use Cases**:
  - Semantic search su documenti ambientazione/regolamento
  - Ricerca giocate per personaggio/location/content
  - Future: RAG (Retrieval-Augmented Generation) con LLM

## SCSS Development Conventions

### Configurazione Build
- **Import**: Utilizzare `@import 'main'` (design system completo)
- **Next.js**: `sassOptions.includePaths: ['../shared-ui/src/styles']`
- **No Dipendenze Scoped**: Evitare `@tenpennynovels/*` per compatibilità production

### Pattern Architetturali
```scss
@import 'main';  // Import design system completo

.component {
  @include victorian-button('primary');
  color: $gold-primary;
  padding: $spacing-md;
}
```

## Performance & Security

### Database Architecture & Testing

#### Core Database Models (33+ models)
- **Character System**: `Character.ts`, `CharacterProgression.ts`, `ExperienceGrant.ts`
- **Session Management**: `GamingSession.ts`, `SessionTemplate.ts`, `Campaign.ts`
- **Corporation System**: `Corporation.ts` con treasury, roles, membership
- **Housing System**: `HousingProperty.ts`, `EstateTransaction.ts`
- **Messaging Systems**: `OnGameMessage.ts`, `OffGameChatMessage.ts`
- **Chat Moderation**: `ChatModerationAction.ts`, `UserReport.ts`
- **Location & Economy**: `Location.ts`, `Item.ts`, `CharacterFinances.ts`
- **Support Systems**: `Ticket.ts`, `Document.ts`, `User.ts`
- **Embeddings**: `Document.ts` (contentEmbedding, embeddingModel), `LocationAction.ts` (contentEmbedding)

#### API Testing Coverage
- **Automated Scripts**: `/scripts/test-*-endpoints.sh` per ogni sistema  
- **Overall Coverage**: 95%+ endpoint coverage across all systems
- **Testing Results**: Corporation (89%), Housing (100%), Experience (69%), Session (100%)
- **Authentication**: Real cookies.txt authentication per integration testing
- **Error Handling**: Comprehensive error scenarios e validation testing

#### Database Indexing (Performance Optimized)
```javascript
// Core indexes
db.characters.createIndex({ "userId": 1, "state": 1 })
db.tickets.createIndex({ "assignedTo": 1, "status": 1 })  
db.ongame_messages.createIndex({ "scheduledDelivery": 1, "deliveredAt": 1 })

// Experience system indexes
db.experience_grants.createIndex({ "characterId": 1, "createdAt": -1 })
db.character_progression.createIndex({ "characterId": 1 })
db.gaming_sessions.createIndex({ "masterId": 1, "sessionDate": -1 })

// Housing system indexes  
db.housing_properties.createIndex({ "district": 1, "isAvailable": 1 })
db.housing_properties.createIndex({ "currentTenantId": 1 })
db.housing_properties.createIndex({ "rentPaidUntil": 1 })

// Corporation system indexes
db.corporations.createIndex({ "type": 1, "isRecruiting": 1 })
db.corporations.createIndex({ "membershipType": 1 })

// Chat moderation indexes
db.chat_moderation_actions.createIndex({ "messageType": 1, "actionTakenAt": -1 })
db.chat_moderation_actions.createIndex({ "targetCharacterId": 1, "severity": 1 })
```

### Security Principles
1. **Server-Side Validation**: Tutti i controlli di autorizzazione
2. **Information Hiding**: Risposte 404 consistenti
3. **Minimum Privilege**: Accesso minimo richiesto
4. **Audit Trail**: Logging azioni amministrative

## 🔧 Sviluppo e Manutenzione

### Cron Jobs & Automation
- **Daily Experience**: `0 2 * * *` - Auto XP grants basati su attività
- **Housing Rent Collection**: `0 6 * * *` - Automated rent collection e evictions  
- **Monthly Maintenance**: `0 2 1 * *` - Property maintenance cost deduction
- **Activity Scoring**: Real-time character activity tracking per XP calculation

### Redis Events & WebSocket Integration
```typescript
// Core event types implemented
'character:experience_granted'              // XP notifications
'session:started', 'session:ended'         // Session lifecycle
'corporation:member_approved'               // Corporation events
'housing:rent_due_warning'                 // Housing notifications
'chat:moderation_applied'                  // Moderation actions
'embedding:document:created'               // Document embedding async processing
'embedding:document:updated'               // Document update embedding
'embedding:location_action:created'        // LocationAction embedding async processing
```

## 🚀 Comandi AI-Driven

### `/management-newcrud [ModelName]`

Genera automaticamente un CRUD completo per un modello del database nel management panel.

**Uso:**
```
/management-newcrud HousingProperty
/management-newcrud Character
/management-newcrud Item
```

**Cosa fa:**
1. Analizza il modello da `services/database/models/[ModelName].ts`
2. Genera/aggiorna backend controller in `services/management-backend/src/controllers/[ModelName]ManagementController.ts`
3. Genera/aggiorna routes in `services/management-backend/src/routes/[modelName]Routes.ts`
4. Aggiunge API helper in `apps/management/src/lib/api.ts`
5. Genera table configuration JSON in `apps/management/public/config/tables/[model-name]-list.json`
6. Genera frontend page in `apps/management/src/pages/[model-name]/[model-name]-list.tsx`
7. Genera SCSS module in `apps/management/src/styles/pages/[ModelName]List.module.scss`

**Standard API Response Format:**
Tutti i file generati DEVONO usare il formato standardizzato:
- `result: boolean` (NON `success`)
- `list: T[]` per liste (NON `data.items`)
- `data: T` per record singoli
- `pagination` a livello root
- Helper functions da `services/management-backend/src/utils/apiResponse.ts`

**Documentazione completa:** `docs/agents/management-crud-generator.md`

**Quando viene chiamato `/management-newcrud [ModelName]`:**
1. Leggi il modello da `services/database/models/[ModelName].ts`
2. Analizza i campi, tipi, relazioni
3. Genera tutti i file necessari seguendo i template nella documentazione
4. Usa i file esistenti come template (es. `character-list.tsx`, `UserManagementController.ts`)
5. Verifica build e linting dopo la generazione
6. Segui gli standard del progetto (SCSS centralizzato, componenti condivisi, etc.)

### 🎯 Development Priorities

#### ✅ Backend Implementation Complete
- Tutti i sistemi core hanno API backend complete e testate
- 95%+ endpoint coverage con automated testing
- Database models implementati e ottimizzati
- Cron jobs e automation systems attivi

#### ⚠️ Frontend Integration Needed
- Corporation Management frontend (backend 89% ready)
- Housing System game integration (backend 100% ready)
- Session Management real-time features (WebSocket integration)
- Chat Monitoring dashboard improvements

### Do's and Don'ts
✅ **DO**: Utilizzare sempre gli scripts di testing prima di deployment
✅ **DO**: Seguire i pattern di error handling e logging esistenti
✅ **DO**: Integrare con Redis events per real-time features
✅ **DO**: Rispettare le regole Call of Cthulhu per experience e character progression
✅ **DO**: Utilizzare i database indexes ottimizzati per performance
✅ **DO**: Mantenere consistency con Victorian theme e period accuracy

❌ **DON'T**: Modificare database schemas senza update dei test scripts
❌ **DON'T**: Saltare l'audit logging per azioni amministrative  
❌ **DON'T**: Ignorare i cron job schedules per automated systems
❌ **DON'T**: Creare endpoint senza proper authentication middleware
❌ **DON'T**: Modificare experience costs senza considerare game balance

## Important Instructions

**IMPORTANTE**: Consultare sempre la documentazione specifica in `/docs/` per dettagli implementativi, API endpoints, database schemas e configurazioni avanzate.

This development guide provides comprehensive setup and workflow instructions for contributing to the TenpennyNovels Victorian RPG platform while maintaining code quality, historical accuracy, and system reliability.