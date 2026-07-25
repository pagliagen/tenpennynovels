# Unified Backend Architecture

**Navigation**: [Home](../../INDEX.md) > [Backend](./README.md) > Unified Backend

**Status**: ✅ Production Ready | **Last Updated**: 2026-07-25

Complete documentation of the TenPennyNovels Unified Backend architecture — modular structure with all services consolidated in a single Express application.

---

## Overview

TenPennyNovels uses a **Unified Backend** that consolidates all backend modules (authentication, game, admin, documents, forum, tickets) in a single Express service.

**Key Benefits**:
- ✅ **Single Deployment**: One process, one port (3001)
- ✅ **Shared Resources**: MongoDB connection pool, Redis client, shared middleware
- ✅ **Zero Breaking Changes**: API Gateway maintains same path prefixes
- ✅ **Simplified Infrastructure**: Fewer containers, less complexity
- ✅ **Hot-Reload Dev**: tsx watch for rapid development

**Previous Architecture** (deprecated):
```mermaid
flowchart LR
    GW[API Gateway] --> A[Auth Backend 3000]
    GW --> G[Game Backend 3001]
    GW --> M[Management Backend 3002]
    GW --> B[BotAI Backend 8080]
```

**Current Architecture**:
```mermaid
flowchart TB
    subgraph Gateway["API Gateway (8000)"]
        GW[Single Entry Point]
    end

    subgraph Backend["Unified Backend (3001)"]
        direction TB
        A["/auth"]
        G["/game"]
        AD["/admin"]
        D["/documents"]
        F["/forum"]
        T["/game/tickets"]
    end

    GW --> A
    GW --> G
    GW --> AD
    GW --> D
    GW --> F
    GW --> T

    subgraph Infra["Infrastructure"]
        MongoDB[(MongoDB)]
        Redis[(Redis)]
        Qdrant[(Qdrant)]
    end

    Backend --> MongoDB
    Backend --> Redis
    Backend --> Qdrant
```

**6 moduli, tutti mounted**: `auth`, `documents`, `game`, `admin` in `app.ts`; `forum` in `app.ts` (`/forum`); `tickets` sotto il router `game` (`/game/tickets`, non `/tickets`).

---

## Entry Point & Technology Stack

| Component | Version |
|-----------|---------|
| **Entry Point** | `src/server.ts` → `src/app.ts` |
| **Port** | 3001 |
| **Node.js** | 24.x (`.nvmrc`: v24.18.0) |
| **Express** | 5.2.1 |
| **TypeScript** | 5.9 |
| **Mongoose** | 9.2.1 |
| **Socket.IO** | 4.8.3 |

---

## Module Structure

### Root Directory

```mermaid
flowchart TB
    subgraph SRC["services/unified-backend/src/"]
        subgraph MOD["modules/"]
            AUTH["auth/"]
            GAME["game/"]
            ADMIN["admin/"]
            DOCS["documents/"]
            FORUM["forum/"]
            TICKETS["tickets/"]
        end
        DB["database/"]
        MW["middleware/"]
        UTILS["utils/"]
        APP["app.ts"]
        SERVER["server.ts"]
    end

    APP --> AUTH
    APP --> GAME
    APP --> ADMIN
    APP --> DOCS
```

```
services/unified-backend/
├── src/
│   ├── modules/              # Feature modules
│   │   ├── auth/             # Authentication & User management ✅ Mounted
│   │   ├── game/             # Core gameplay logic ✅ Mounted
│   │   ├── admin/            # Administrative operations ✅ Mounted
│   │   ├── documents/        # Document management ✅ Mounted
│   │   ├── forum/            # Forum system (mounted at /forum)
│   │   └── tickets/          # Support tickets (mounted at /game/tickets)
│   ├── database/
│   │   ├── models/           # 42 Mongoose schemas
│   │   ├── migrations/       # Database migrations
│   │   └── index.ts          # MongoDB connection
│   ├── middleware/
│   │   ├── auth.ts           # JWT authentication
│   │   ├── errorHandler.ts   # Global error handler
│   │   ├── validation.ts     # Request validation
│   │   └── requireMaster.ts  # Master role check
│   ├── utils/
│   │   ├── logger.ts         # Winston logger
│   │   ├── apiResponse.ts    # Standardized API responses
│   │   └── events/           # Redis event publishers
│   ├── app.ts                # Express app setup
│   └── server.ts             # Server entry point
├── logs/                     # Winston logs
├── Dockerfile.dev            # Development container
├── package.json
└── tsconfig.json
```

---

## Modules

### 1. Authentication Module (`/auth`) ✅ Active

**Purpose**: User management, JWT token system, password reset

**Structure**:
```
src/modules/auth/
├── controllers/
│   ├── AuthController.ts         # Login, logout, token refresh
│   ├── RegistrationController.ts # User registration
│   ├── PasswordController.ts     # Password reset workflow
│   ├── ProfileController.ts     # User profile management
│   └── SecurityController.ts    # Account deletion
├── routes/
│   └── auth.ts                  # Auth router (mounted at /auth)
└── services/
    └── EmailService.ts          # Email notifications
```

**Key Features**:
- **Dual-Token JWT**: `auth_token` (user) + `character_context` (character selection)
- **Password Reset**: Email-based with secure tokens
- **Email Verification**: Required before full access
- **Account Deletion**: GDPR-compliant deletion workflow

**Endpoints**:
```typescript
POST   /auth/register           - User registration
POST   /auth/login              - User login
POST   /auth/logout             - User logout
POST   /auth/refresh            - Refresh JWT
POST   /auth/forgot-password    - Request password reset
POST   /auth/reset-password/:token - Reset password
GET    /auth/verify-email/:token - Verify email
DELETE /auth/delete-account/:token - Delete account
POST   /auth/select-character   - Select character (character_context token)
GET    /auth/profile            - Get profile
PUT    /auth/profile            - Update profile
GET    /auth/occupations        - List occupations
```

**Details**: [Authentication System](./authentication-system.md)

---

### 2. Game Module (`/game`) ✅ Active

**Purpose**: Core gameplay logic, characters, locations, housing, sessions

**Structure**:
```
src/modules/game/
├── controllers/
│   ├── CharacterController.ts          # Character CRUD
│   ├── CharacterCrudController.ts      # Admin character ops
│   ├── CharacterLifecycleController.ts # Approval workflow
│   ├── CharacterLocationController.ts   # Location join/leave
│   ├── CharacterSkillsController.ts    # Skill management
│   ├── CharacterCorporationsController.ts # Corporation membership
│   ├── LocationController.ts           # Location operations
│   ├── LocationPropertyController.ts           # Housing system
│   ├── SessionController.ts            # Gaming sessions
│   ├── CorporationController.ts        # Corporations
│   ├── SkillController.ts              # Skills
│   ├── OccupationController.ts         # Occupations
│   ├── CharacterRelationController.ts  # Character Relations
│   └── ... (20+ controllers)
├── routes/
│   └── index.ts                        # Game router (mounted at /game)
├── services/
│   ├── LocationService.ts              # Location business logic
│   ├── TurnManager.ts                  # Turn-based system
│   └── ...
└── websocket/
    ├── index.ts                        # Socket.IO server setup
    ├── gameHandlers.ts                 # Game event handlers
    └── chatHandlers.ts                 # Chat event handlers
```

**Key Features**:
- **Character Management**: Complete character lifecycle (creation, approval, progression)
- **Location System**: Hierarchical locations with join/leave mechanics
- **Housing System**: Property rental/purchase with automated rent collection
- **Gaming Sessions**: Turn-based sessions with Master tools
- **Messaging**: On-game postal system + off-game chat
- **Corporations**: Corporate management with treasury
- **WebSocket**: Real-time updates via Socket.IO

**Details**:
- [Personaggi (funzionale)](../../funzionale/personaggi.md)
- [Locations (funzionale)](../../funzionale/locations.md)
- [Housing (funzionale)](../../funzionale/housing.md)
- [Chat e sessioni (funzionale)](../../funzionale/chat-sessioni.md)
- [WebSocket Patterns](../frontend/websocket-patterns.md)

---

### 3. Admin Module (`/admin`) ✅ Active

**Purpose**: Administrative operations, analytics, oversight

**Structure**:
```
src/modules/admin/
├── controllers/
│   ├── CharacterApprovalController.ts  # Character review
│   ├── UserManagementController.ts     # User management
│   ├── DocumentManagementController.ts # Document management
│   ├── ForumManagementController.ts    # Forum moderation
│   ├── TicketManagementController.ts    # Ticket management
│   └── ... (15+ controllers)
├── routes/
│   └── index.ts                        # Admin router (mounted at /admin)
└── middleware/
    └── adminAuth.ts                    # Admin role verification
```

**Key Features**:
- **Character Approval**: Review and approve pending characters
- **User Management**: Ban/unban users, permission management
- **Analytics**: System-wide statistics and reports
- **Moderation**: Chat monitoring and moderation actions
- **System Config**: Global settings management

---

### 4. Documents Module (`/documents`) ✅ Active

**Purpose**: Game documentation (ambientazione, regolamento), semantic search

**Structure**:
```
src/modules/documents/
├── controllers/
│   └── DocumentController.ts       # Document operations + semantic search
└── routes/
    └── index.ts                    # Documents router (mounted at /documents)
```

**Key Features**:
- **Hierarchical Documents**: Sections and subsections
- **Semantic Search**: Qdrant-powered vector search
- **Favorites**: User favorite documents
- **Visibility Control**: Public, authenticated, admin

**Endpoints**:
```typescript
GET    /documents/routes/list           - List documents
GET    /documents/routes/list-hierarchical - Hierarchical sidebar
GET    /documents/semantic-search       - Semantic search (Qdrant)
GET    /documents/ask                   - AI-powered Q&A
GET    /documents/:type/:path           - Get document by path
GET    /documents/favorites             - User favorites
POST   /documents/:type/:path/favorite - Toggle favorite
```

**Details**: [Documents App](../frontend/documents-app.md) (ricerca semantica)

---

### 5. Forum Module (`/forum`) ✅ Active

**Purpose**: Community discussions (topics → discussions → posts), bookmarks, subscriptions, notifications, favorites

**Status**: Mounted in `app.ts` (`app.use('/forum', forumRoutes)`). Sviluppo attivo — verificare sempre lo stato reale nel codice prima di fidarsi di questa sezione, il modulo si è mosso più volte.

**Struttura reale** (`src/modules/forum/`):
```
controllers/
├── ForumController.ts               # Categorie, topic, discussioni, post
├── ForumBookmarkController.ts       # Bookmark sui post
├── ForumSubscriptionController.ts   # Sottoscrizioni alle discussioni
└── ForumNotificationController.ts   # Notifiche
routes/forum.ts                      # Router (mounted at /forum)
services/
├── ForumAccessService.ts            # Permessi/visibilità per categoria e topic
├── ForumContentSanitizer.ts         # Sanitizzazione HTML dei post
├── ForumSerializer.ts               # Serializzazione response
└── NotificationService.ts
```

⚠️ `ForumReactionController` e `ForumFollowController` citati in versioni precedenti di questo doc **non esistono più** — sostituiti da `ForumAccessService`/`ForumContentSanitizer`/`ForumSerializer`.

**Endpoint principali** (`routes/forum.ts`): `GET /forum/init`, `/categories`, `/topics`, `/topics/:slug`, `/topics/:topicSlug/discussions[/:discussionSlug]`, CRUD post su `/posts/:postId`, `favorite`/`bookmark`/`subscribe` toggle, `/search`, `/recent`, `/popular`, `/notifications`.

Moderazione forum: `ForumManagementController` nel modulo Admin (`/admin`).

---

### 6. Tickets Module (`/game/tickets`) ✅ Active

**Purpose**: Sistema di ticket di supporto per i personaggi

**Status**: Mounted sotto `/game` (`router.use('/', ticketRoutes)` in `modules/game/routes/index.ts`) → endpoint reali su `/game/tickets`, non `/tickets`.

**Struttura reale** (`src/modules/tickets/`): `controllers/TicketController.ts`, `routes/tickets.ts`, `logger.ts`.

**Endpoint**: `GET/POST /game/tickets`, `/game/tickets/categories`, `/game/tickets/unread-count`, `/game/tickets/:id`, `PUT /:id/reopen`, `/:id/close`, `POST /:id/messages`, `GET /:id/messages`, `PUT /:id/read`.

Gestione admin (`TicketManagementController`, `TicketDashboardController`, `EscalationService`) è nel modulo Admin, sotto `/admin`.

---

## Technology Stack

### Framework — Express 5.2.1

**Why Express 5?**
- ✅ **Promise Support**: Automatic promise rejection handling
- ✅ **Async/Await**: No more `next()` callbacks in async routes
- ✅ **Performance**: Improved routing performance

**Example**:
```typescript
// Express 5 - automatic error handling
app.get('/characters', async (req, res) => {
  const characters = await Character.find();
  res.json({ success: true, data: characters });
  // If promise rejects, error middleware catches it automatically
});
```

---

### ORM — Mongoose 9.2.1

**Connection**:
```typescript
// src/database/index.ts
import mongoose from 'mongoose';

export async function connectDatabase() {
  await mongoose.connect(process.env.MONGODB_URI!, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000
  });
  logger.info('MongoDB connected successfully');
}
```

**Details**: [MongoDB Schemas](../01-infrastructure/mongodb-schemas.md)

---

### WebSocket — Socket.IO 4.8.3

**Features**:
- **Room-Based Broadcasting**: Targeted events per location/session
- **Redis Adapter**: Multi-instance synchronization
- **Automatic Reconnection**: Client resilience

**Details**: [WebSocket Patterns](../frontend/websocket-patterns.md)

---

## Database Architecture

### MongoDB — 42 Collections

**Categories**:
1. **Core** (3): User, CharacterSession, SystemConfiguration
2. **Characters** (3): Character, CharacterProgression, CharacterFinances
3. **Locations & Gameplay** (4): Location, Chat, Route, CharacterNotes
4. **Housing & Economy** (1): LocationProperty *(removed: EstateTransaction, Economy, FinancialTransaction)*
5. **Messaging** (7): OnGameMessage, OnGameMessageView, OffGameChat, OffGameChatMessage, etc.
6. **Documents** (3): Document, DocumentSection, DocumentChunk
7. **Gaming Sessions** (3): GamingSession, SessionManagement, SessionTemplate *(removed: Campaign)*
8. **Tickets** (3): Ticket, TicketMessage, TicketNotification
9. **Corporations** (2): Corporation, CharacterRelation
10. **Game Rules** (3): Occupation, Skill, SocialClassConfig
11. **Items** (1): Item
12. **Experience** (0): *(removed: ExperienceGrant)*
13. **Moderation** (2): ChatModerationAction, BroadcastMessage
14. **System** (1): WebSocketEvent

---

## Middleware Stack

### Request Flow

```mermaid
flowchart TB
    A[Incoming Request] --> B[CORS]
    B --> C[Helmet]
    C --> D[Compression]
    D --> E[Body Parser]
    E --> F[Cookie Parser]
    F --> G[Morgan]
    G --> H[Request ID]
    H --> I[Query Params Normalization]
    I --> J{Authentication?}
    J -->|Yes| K[Auth Middleware]
    J -->|No| L[Route Handler]
    K --> L
    L --> M[Error Handler]
    M --> N[Response]
```

---

## Event-Driven Architecture

### Redis Pub/Sub Channels

```mermaid
flowchart LR
    subgraph Channels["Redis Channels"]
        C1["character:updated"]
        C2["location:action_created"]
        C3["session:created"]
        C4["document:created"]
        C5["chat:new_message"]
    end

    Backend[Unified Backend] --> Channels
    Channels --> Worker[embeddings-worker]
```

---

## Development Workflow

### Hot-Reload Setup

```bash
# Start development server
npm run dev

# tsx watch automatically reloads on file changes
# No build step needed
```

---

## Quick Reference

| Property | Value |
|----------|-------|
| **Port** | 3001 |
| **Entry Point** | `src/server.ts` → `src/app.ts` |
| **Framework** | Express 5.2.1 |
| **ORM** | Mongoose 9.3.0 |
| **WebSocket** | Socket.IO 4.8.3 |
| **Node** | 24.x (`.nvmrc`: v24.18.0) |
| **TypeScript** | 5.9 |
| **Mounted Modules** | auth, documents, game, admin, forum, tickets (sotto `/game`) |

---

## Related Documentation

- [API Gateway](./api-gateway.md) - Proxy routing
- [Authentication System](./authentication-system.md) - JWT system
- [API Reference](./api-reference.md) - Complete endpoint list
- [MongoDB Schemas](../01-infrastructure/mongodb-schemas.md) - Database structure
- [WebSocket Patterns](../frontend/websocket-patterns.md) - Eventi real-time
- [Deploy README](../../deploy/README.md) - Produzione
