# Backend Services

**Navigation**: [Home](../INDEX.md) > Backend

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-01

Overview dei servizi backend di TenPennyNovels: unified-backend, API gateway, BotAI.

---

## Overview

Il backend di TenPennyNovels utilizza un'architettura modulare consolidata in un unico servizio (unified-backend) con un API Gateway come single entry point. Questa architettura è il risultato del consolidamento di auth-backend, game-backend e management-backend in un'unica applicazione modulare.

---

## Architecture

```
┌───────────────────────────┐
│    Frontend Apps          │
│  (Next.js 16, React 18)   │
└────────────┬──────────────┘
             │ HTTP/WebSocket
     ┌───────▼───────┐
     │  API Gateway  │ ← Port 8000
     │  (Proxy)      │   Single Entry Point
     └───────┬───────┘
             │
     ┌───────▼─────────────┐
     │  Unified Backend    │ ← Port 3001
     │                     │   Modular Monolith
     ├─────────────────────┤
     │  Module: auth       │ → /auth/*
     │  Module: game       │ → /game/*
     │  Module: admin      │ → /admin/*
     │  Module: forum      │ → /forum/*
     │  Module: documents  │ → /documents/*
     └──────┬──────────────┘
            │
     ┌──────▼──────────────────────┐
     │  Infrastructure             │
     │  MongoDB, Redis, Qdrant     │
     └─────────────────────────────┘
```

---

## Services

### 1. Unified Backend (Port 3001)

**Main application backend** con architettura modulare.

**Technology Stack**:
- Node.js 22.13.1
- Express 5.2.1
- TypeScript 5.9.3
- Mongoose 9.2.1 (MongoDB ORM)
- Socket.IO 4.8.3 (WebSocket)
- Winston 3.19.0 (Logging)

**Modules**:

#### auth Module (`/auth/*`)
- User registration, login, logout
- JWT generation (dual-token: auth_token + character_context)
- Password reset, email verification
- Profile management
- Session management via CharacterSessionManager

#### game Module (`/game/*`)
- **Characters**: Creation, approval, CRUD, skills
- **Locations**: Hierarchical locations, join/leave, occupants
- **Housing**: Property rental, purchase, rent collection
- **Corporations**: Management, membership, treasury
- **Experience**: Daily XP, skill advancement
- **Sessions**: Turn-based gameplay, templates
- **Messaging**: OffGame chat, OnGame postal system
- **Items**: Inventory, shop integration
- **Documents**: Content management, semantic search

#### admin Module (`/admin/*`)
- User management (ban, permissions)
- Character approval workflow
- Corporation oversight
- Housing analytics
- System configuration
- Broadcast messages
- Audit logs

#### forum Module (`/forum/*`)
- Forum posts and threads (archived feature)
- Moderation

#### documents Module (`/documents/*`)
- Document CRUD (L1 - full text)
- Semantic search (L2 - vector)
- Route management (categories, redirects)
- Favorites system

**Details**: [Unified Backend Architecture](./unified-backend-architecture.md)

---

### 2. API Gateway (Port 8000)

**Single entry point** per tutte le richieste client.

**Technology Stack**:
- Node.js 22.13.1
- Express 5.2.1
- http-proxy-middleware v3

**Key Features**:
- **Proxy Routing**: Forwards requests to unified-backend modules
- **CORS Management**: 4 frontend origins (landing, game, documents, management)
- **Rate Limiting**: Tiered (authenticated: 120/15min, unauthenticated: 30/15min)
- **WebSocket Upgrade**: Socket.IO proxy
- **Request Logging**: Morgan HTTP logger
- **Security**: Helmet middleware

**Routing Table**:
```
/auth/*       → unified-backend:3001/auth
/game/*       → unified-backend:3001/game
/admin/*      → unified-backend:3001/admin
/forum/*      → unified-backend:3001/forum
/documents/*  → unified-backend:3001/documents
/socket.io/** → unified-backend:3001 (WebSocket)
```

**Details**: [API Gateway](./api-gateway.md)

---

### 3. BotAI Backend (Port 8080) - DISABLED

**NPC AI service** per personaggi bot intelligenti.

**Technology Stack**:
- Node.js 22.13.1
- Express 5.2.1
- Ollama (modelli locali, gratuito)

**Status**: Sostituito da Local AI Platform (`local-ai/`)

**Key Features**:
- **Psychology System**: 6 axes, central wound, duality
- **Semantic Memory**: Embeddings-based memory retrieval
- **Relationship Archetypes**: Mentor, rival, romantic, suspicious
- **Victorian Narrative Style**: Agatha Christie-inspired

**Communication**: Webhook-based with unified-backend

**Details**: [BotAI Backend](./botai-backend.md) (includes psychology system documentation)

---

## Authentication System

### Dual-Token JWT

**auth_token** (User Authentication):
- Payload: `userId`, `username`, `email`, `canAccessAdminPanel`, `userRoles`, `characterRoles`, `characterPermissions`
- Duration: 24h (default) or 7 days (remember-me)
- Cookie: httpOnly, secure (production)

**character_context** (Character Selection):
- Payload: `userId`, `characterId`, `characterName`, `isApproved`, `gameplayRoles`
- Duration: 24h
- Validated against CharacterSessionManager (prevents multi-session)

### Middleware Chain

```
Request → authenticateUser → authenticateCharacter → requireAdmin/requireGameplayRole → Controller
```

**Details**: [Authentication System](./authentication-system.md)

---

## API Reference

### Key Endpoint Groups

**Authentication** (`/auth/*`):
- `POST /auth/register` - User registration
- `POST /auth/login` - Login
- `POST /auth/logout` - Logout
- `POST /auth/select-character` - Character selection
- `POST /auth/forgot-password` - Password reset request
- `POST /auth/reset-password/:token` - Password reset

**Characters** (`/game/characters/*`):
- `GET /game/characters` - List user characters
- `POST /game/characters` - Create character
- `GET /game/characters/:id` - Character details
- `PUT /game/characters/:id` - Update character
- `DELETE /game/characters/:id` - Delete character

**Locations** (`/game/locations/*`):
- `GET /game/locations/accessible` - List accessible locations
- `POST /game/locations/join` - Join location
- `POST /game/locations/leave` - Leave location
- `GET /game/locations/:id` - Location details
- `POST /game/locations/:id/action` - Post action in location

**Housing** (`/game/housing/*`):
- `GET /game/housing/available/:district` - Available properties
- `POST /game/housing/rent` - Rent property
- `POST /game/housing/purchase` - Purchase property
- `GET /game/housing/my-properties` - My properties
- `POST /game/housing/:id/pay-rent` - Pay rent

**Documents** (`/game/documents/*` or `/documents/*`):
- `GET /documents/routes` - Document navigation tree
- `GET /documents/route` - Resolve route to document
- `GET /documents/search` - Semantic + full-text search
- `GET /documents/:id` - Document details

**Admin** (`/admin/*`):
- `GET /admin/characters/pending` - Pending character approvals
- `PUT /admin/characters/:id/approve` - Approve character
- `GET /admin/users` - List users
- `PUT /admin/users/:id/ban` - Ban user

**Complete Reference**: [API Reference](./api-reference.md)

---

## WebSocket Events

### Event Types

**Location Events**:
- `player_joined` - Character joined location
- `player_left` - Character left location
- `action_created` - New action posted
- `turn_advanced` - Turn progression (turn-based)

**Character Events**:
- `xp_granted` - Experience awarded
- `state_changed` - Character status update

**Session Events**:
- `session_started` - Gaming session started
- `session_ended` - Gaming session ended

**Global Events**:
- `presence_updated` - Online/offline status

### Room-Based Broadcasting

Rooms per isolation:
- `user_{userId}` - User-specific events
- `character_{characterId}` - Character-specific events
- `location_{locationId}` - Location-scoped events
- `admin` - Admin-only events
- `staff` - Staff-only events

**Pattern**: [WebSocket Patterns](../05-frontend/websocket-patterns.md)

---

## Database Access

### Mongoose Models

44+ schemas organizzati per categoria:

**Core**: User, Character, CharacterProgression, CharacterFinances

**Gameplay**: Location, LocationAction, Corporation, HousingProperty, ExperienceGrant, GamingSession

**Communication**: OnGameMessage, OffGameChatMessage, OffGameChat

**Content**: Document, DocumentChunk, DocumentSection

**Admin**: Ticket, TicketMessage, ForumPost

**Details**: [MongoDB Schemas](../01-infrastructure/mongodb-schemas.md)

---

## Middleware Stack

### Request Flow

```
1. Helmet (Security headers)
2. CORS (Cross-origin)
3. Compression (gzip)
4. Cookie Parser
5. Morgan (HTTP logging)
6. Rate Limiter (if applicable)
7. authenticateUser (if protected)
8. authenticateCharacter (if game route)
9. requireAdmin/requireGameplayRole (if restricted)
10. Controller
11. Error Handler
```

---

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

### Common Error Codes

- `AUTH_REQUIRED` - Authentication required
- `CHARACTER_REQUIRED` - Character selection required
- `PERMISSION_DENIED` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Input validation failed
- `RATE_LIMIT_EXCEEDED` - Too many requests

---

## Files in This Section

- [README.md](./README.md) - This file
- [Unified Backend Architecture](./unified-backend-architecture.md) - Modular architecture details
- [API Gateway](./api-gateway.md) - Proxy configuration
- [Authentication System](./authentication-system.md) - Dual-token JWT
- [BotAI Backend](./botai-backend.md) - NPC AI system
- [API Reference](./api-reference.md) - Complete endpoint list

---

## Related Documentation

- [Infrastructure](../01-infrastructure/README.md) - MongoDB, Redis setup
- [WebSocket Patterns](../05-frontend/websocket-patterns.md) - Real-time communication
- [Game Systems](../03-game-systems/README.md) - Gameplay mechanics
- [Environment Variables](../01-infrastructure/environment-variables.md) - Configuration
- [Testing Scripts](../07-testing/api-testing-scripts.md) - API testing
