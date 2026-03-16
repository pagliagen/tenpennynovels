# Architettura TenPennyNovels

## Panoramica

TenPennyNovels è una piattaforma RPG basata su chat per ambientazione Victorian London con regole Call of Cthulhu. L'architettura è un monorepo con microservizi backend e multiple applicazioni frontend.

## Architettura Generale

### Monorepo Structure
```
tenpennynovels/
├── apps/              # 4 applicazioni frontend Next.js
├── services/          # 3 servizi backend + codice condiviso
├── scripts/           # Script di utilità e migrazioni
└── docs/              # Documentazione completa
```

### Frontend Applications (4)
1. **Landing** (porta 4000) - Autenticazione e selezione personaggio
2. **Game** (porta 4001) - Interfaccia principale di gioco con chat real-time, ticketing, e forum integrati
3. **Documents** (porta 4003) - Guide ambientazione e regole
4. **Management** (porta 4004) - Strumenti per game masters e amministrazione

**Note**: Forum e Ticketing sono **integrati nella Game app**, non applicazioni standalone.

### Backend Services (3)
1. **API Gateway** (porta 8000) - Reverse proxy, routing centralizzato, rate limiting, security
2. **Unified Backend** (porta 3001) - Backend monolitico unificato con tutti i moduli:
   - Auth module (autenticazione, registrazione, profili)
   - Game module (characters, locations, chat, sessions)
   - Documents module (knowledge base, semantic search)
   - Tickets module (support system)
   - Forum module (discussioni community)
   - Admin module (gestione utenti, characters, locations, documents)
   - WebSocket real-time via Socket.IO + Redis adapter
3. **Embeddings Worker** (porta 5001) - Servizio Python + Node.js per semantic search:
   - Python: Generazione embeddings (sentence-transformers)
   - Node.js: Bull queue worker per processing asincrono
   - Qdrant integration per vector storage

## Pattern Architetturali

### Event-Driven Architecture
- Servizi comunicano via Redis pub/sub per eventi real-time
- Loose coupling tra microservizi
- Eventi per: chat messages, character movements, notifications

### API Gateway Pattern
- Punto di ingresso unificato per tutte le API frontend
- Routing basato su path prefix (proxy a Unified Backend):
  - `/auth/*` → Unified Backend (auth module)
  - `/game/*` → Unified Backend (game module)
  - `/documents/*` → Unified Backend (documents module)
  - `/admin/*` → Unified Backend (admin module)
- Funzionalità: CORS, helmet security, rate limiting, request logging
- Unified Backend porta 3001 gestisce tutta la business logic

### Database Architecture
- **MongoDB 7.0**: Database condiviso da Unified Backend (36+ collections)
- **Modelli Mongoose**: Centralizzati in `services/unified-backend/src/database/models/`
- **Redis 7.2**: Cache, session storage, Socket.IO adapter, Bull queue
- **Qdrant**: Vector database per semantic search (384D embeddings)
- **Elasticsearch**: Full-text search (hybrid con semantic search)

## Comunicazione tra Servizi

### HTTP REST
- Comunicazione sincrona via HTTP
- API Gateway instrada richieste
- Formato API standardizzato

### Redis Pub/Sub
- Comunicazione asincrona per eventi
- Eventi real-time (chat, notifications)
- Decoupling tra servizi

### WebSocket
- Connessioni persistenti per chat real-time
- Gestito da Game Backend
- Socket.io per gestione connessioni

## Stack Tecnologico

### Frontend
- **Framework**: Next.js (React)
- **Language**: TypeScript
- **Styling**: SCSS Modules + Design System condiviso
- **State**: React Hooks + Context API

### Backend
- **Runtime**: Node.js v22.13.1
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Mongoose (MongoDB)

### Database & Cache
- **Database**: MongoDB v6.x
- **Cache**: Redis v7.x
- **Models**: 37+ modelli Mongoose

### Real-time
- **WebSocket**: Socket.io
- **Events**: Redis pub/sub

## Flussi Principali

### Autenticazione
1. User registra/login → API Gateway → Unified Backend (auth module)
2. JWT token generato e salvato in HttpOnly cookie
3. Character session creata in MongoDB (CharacterSession model)
4. WebSocket connection stabilita con Unified Backend

### Gameplay
1. User seleziona character → Character session attiva (via auth module)
2. User si muove in location → Unified Backend (game module) aggiorna Location.occupants
3. User invia messaggio chat → WebSocket broadcast via Socket.IO + Redis adapter
4. Eventi pubblicati su Redis → Altri client WebSocket notificati in real-time

### Admin Operations
1. Admin accede via Management app → API Gateway → Unified Backend (admin module)
2. Operazioni CRUD su users, characters, locations, documents
3. Audit log automatico (AuditLog model)
4. Real-time updates via WebSocket o polling (react-query)

## Note Importanti

- **Type Safety**: TypeScript strict mode ovunque
- **API Format**: Formato standardizzato con `result`, `data`, `list`
- **Error Handling**: Gestione errori centralizzata
- **Logging**: Logging strutturato con logger
- **Security**: JWT authentication, input validation, rate limiting

