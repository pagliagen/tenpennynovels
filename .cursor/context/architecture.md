# Architettura TenpennyNovels

## Panoramica

TenpennyNovels è una piattaforma RPG basata su chat per ambientazione Victorian London con regole Call of Cthulhu. L'architettura è un monorepo con microservizi backend e multiple applicazioni frontend.

## Architettura Generale

### Monorepo Structure
```
tenpennynovels/
├── apps/              # 6 applicazioni frontend Next.js
├── services/          # 4+ servizi backend + codice condiviso
├── scripts/           # Script di utilità e migrazioni
└── docs/              # Documentazione completa
```

### Frontend Applications (6)
1. **Landing** (porta 4000) - Autenticazione e selezione personaggio
2. **Game** (porta 4001) - Interfaccia principale di gioco con chat real-time
3. **Documents** (porta 4002) - Guide ambientazione e regole
4. **Forum** (porta 4003) - Discussioni community
5. **Management** (porta 4004) - Strumenti per game masters
6. **Tickets** (porta 4005) - Sistema di supporto

### Backend Services (4+)
1. **API Gateway** (porta 8000) - Routing centralizzato
2. **Authentication Backend** (porta 3000) - Autenticazione e gestione utenti
3. **Game Backend** (porta 3001) - Logica di gameplay e WebSocket
4. **Management Backend** (porta 3002) - Funzionalità amministrative

### Servizi Aggiuntivi
- **Embeddings Service** (Python, porta 5001) - Generazione embeddings per ricerca semantica
- **Embeddings Worker** (TypeScript) - Worker asincrono per embeddings

## Pattern Architetturali

### Event-Driven Architecture
- Servizi comunicano via Redis pub/sub per eventi real-time
- Loose coupling tra microservizi
- Eventi per: chat messages, character movements, notifications

### API Gateway Pattern
- Punto di ingresso unificato per tutte le API
- Routing basato su path prefix:
  - `/auth/*` → Authentication Backend
  - `/game/*` → Game Backend
  - `/admin/*` → Management Backend

### Database per Servizio
- Tutti i servizi condividono MongoDB (per ora)
- Modelli centralizzati in `services/database/models/`
- Possibile evoluzione verso database separati per servizio

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
1. User registra/login → Authentication Backend
2. JWT token generato e salvato in HttpOnly cookie
3. Character session avviata → Game Backend
4. WebSocket connection stabilita per chat

### Gameplay
1. User seleziona character → Character session attiva
2. User si muove in location → Game Backend aggiorna stato
3. User invia messaggio chat → WebSocket broadcast
4. Eventi pubblicati su Redis → Altri servizi notificati

### Admin Operations
1. Admin accede Management Backend
2. Operazioni creano audit log
3. Modifiche pubblicate su Redis per aggiornamenti real-time
4. Frontend Management aggiornato via polling/WebSocket

## Note Importanti

- **Type Safety**: TypeScript strict mode ovunque
- **API Format**: Formato standardizzato con `result`, `data`, `list`
- **Error Handling**: Gestione errori centralizzata
- **Logging**: Logging strutturato con logger
- **Security**: JWT authentication, input validation, rate limiting

