# Unified Backend Architecture

**Navigation**: [Home](../INDEX.md) > [Backend](./README.md) > Unified Backend Architecture

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-01

Documentazione completa dell'architettura Unified Backend di TenpennyNovels - modular structure con tutti i servizi consolidati.

---

## Overview

TenpennyNovels utilizza un **Unified Backend** che consolida tutti i moduli backend (authentication, game, admin, forum, documents, tickets) in un singolo servizio Express.

**Key Benefits**:
- ✅ **Single Deployment**: Un solo processo, un solo port (3001)
- ✅ **Shared Resources**: MongoDB connection pool, Redis client, middleware condivisi
- ✅ **Zero Breaking Changes**: API Gateway mantiene stessi path prefixes
- ✅ **Simplified Infrastructure**: Meno containers, meno complexity
- ✅ **Hot-Reload Dev**: tsx watch per development rapido

**Previous Architecture** (deprecated):
```
API Gateway → Authentication Backend (3000)
           → Game Backend (3001)
           → Management Backend (3002)
           → BotAI Backend (8080)
```

**Current Architecture**:
```
API Gateway (8000) → Unified Backend (3001)
                       ├── /auth   (authentication module)
                       ├── /game   (game logic module)
                       ├── /admin  (admin module)
                       ├── /forum  (forum module)
                       └── /game/documents (documents module)
```

---

## Module Structure

### Root Directory

```
services/unified-backend/
├── src/
│   ├── modules/              # Feature modules
│   │   ├── auth/             # Authentication & User management
│   │   ├── game/             # Core gameplay logic
│   │   ├── admin/            # Administrative operations
│   │   ├── forum/            # Forum system (future)
│   │   ├── documents/        # Document management
│   │   └── tickets/          # Support tickets (future)
│   ├── database/
│   │   ├── models/           # 42 Mongoose schemas
│   │   ├── migrations/       # Database migrations
│   │   └── index.ts          # MongoDB connection
│   ├── middleware/
│   │   ├── auth.ts           # JWT authentication
│   │   ├── errorHandler.ts  # Global error handler
│   │   ├── validation.ts     # Request validation
│   │   └── requireMaster.ts  # Master role check
│   ├── utils/
│   │   ├── logger.ts         # Winston logger
│   │   ├── apiResponse.ts    # Standardized API responses
│   │   └── events/           # Redis event publishers
│   ├── app.ts                # Express app setup
│   └── index.ts              # Server entry point
├── logs/                     # Winston logs
├── Dockerfile.dev            # Development container
├── package.json
└── tsconfig.json
```

---

## Modules

### 1. Authentication Module (`/auth`)

**Purpose**: User management, JWT token system, password reset

**Structure**:
```
src/modules/auth/
├── controllers/
│   ├── AuthController.ts         # Login, logout, token refresh
│   ├── RegistrationController.ts # User registration
│   ├── PasswordController.ts     # Password reset workflow
│   ├── ProfileController.ts      # User profile management
│   └── SecurityController.ts     # Account deletion
├── routes/
│   └── index.ts                  # Auth router (mounted at /auth)
└── services/
    └── EmailService.ts           # Email notifications
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
POST   /auth/refresh-token      - Refresh JWT
POST   /auth/forgot-password    - Request password reset
POST   /auth/reset-password/:token - Reset password
GET    /auth/verify-email/:token - Verify email
DELETE /auth/delete-account/:token - Delete account
POST   /auth/character-select   - Select character (character_context token)
```

**Details**: [Authentication System](./authentication-system.md)

---

### 2. Game Module (`/game`)

**Purpose**: Core gameplay logic, characters, locations, housing, sessions

**Structure**:
```
src/modules/game/
├── controllers/
│   ├── CharacterController.ts          # Character CRUD
│   ├── CharacterCrudController.ts      # Admin character ops
│   ├── CharacterLifecycleController.ts # Approval workflow
│   ├── CharacterLocationController.ts  # Location join/leave
│   ├── CharacterSkillsController.ts    # Skill management
│   ├── CharacterCorporationsController.ts # Corporation membership
│   ├── LocationController.ts           # Location operations
│   ├── LocationActionsController.ts    # Location actions
│   ├── HousingController.ts            # Housing system
│   ├── SessionController.ts            # Gaming sessions
│   ├── SessionManagementController.ts  # Session management
│   ├── ExperienceController.ts         # XP grants
│   ├── OnGameMessageController.ts      # Postal system
│   ├── OffGameChatController.ts        # Off-game chat
│   ├── CorporationController.ts        # Corporations
│   ├── DocumentController.ts           # Documents
│   ├── SkillController.ts              # Skills
│   ├── OccupationController.ts         # Occupations
│   └── RelationshipController.ts       # Relationships
├── routes/
│   └── index.ts                        # Game router (mounted at /game)
├── services/
│   ├── LocationService.ts              # Location business logic
│   ├── TurnManager.ts                  # Turn-based system
│   ├── WeatherService.ts               # Weather simulation
│   └── OffGameChatService.ts           # Chat operations
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
- **Documents**: Content management with semantic search
- **WebSocket**: Real-time updates via Socket.IO

**Endpoints**: 95+ endpoints
```typescript
# Characters
GET    /game/characters              - List characters
POST   /game/characters              - Create character
GET    /game/characters/:id          - Get character
PATCH  /game/characters/:id          - Update character
DELETE /game/characters/:id          - Delete character

# Locations
GET    /game/locations/accessible    - Get accessible locations
POST   /game/locations/join          - Join location
POST   /game/locations/leave         - Leave location

# Housing
GET    /game/housing/available       - List properties
POST   /game/housing/rent            - Rent property
POST   /game/housing/purchase        - Purchase property
POST   /game/housing/pay-rent        - Pay rent

# Sessions
POST   /game/sessions                - Create session
GET    /game/sessions                - List sessions
POST   /game/sessions/:id/join       - Join session
POST   /game/sessions/:id/start      - Start session (Master)

# Messaging
GET    /game/messages                - List messages
POST   /game/messages                - Send message
GET    /game/messages/:threadId      - Get thread

# Documents
GET    /game/documents               - List documents
GET    /game/documents/:slug         - Get document
POST   /game/documents/search        - Semantic search

# ... (85+ more endpoints)
```

**Details**:
- [Character System](../03-game-systems/character-system.md)
- [Location System](../03-game-systems/location-system.md)
- [Housing System](../03-game-systems/housing-system.md)
- [Session Management](../03-game-systems/session-management.md)
- [WebSocket Patterns](../05-frontend/websocket-patterns.md)

---

### 3. Admin Module (`/admin`)

**Purpose**: Administrative operations, analytics, oversight

**Structure**:
```
src/modules/admin/
├── controllers/
│   ├── CharacterApprovalController.ts  # Character review
│   ├── UserManagementController.ts     # User management
│   ├── ExperienceManagementController.ts # XP oversight
│   ├── SessionManagementController.ts  # Session analytics
│   ├── CorporationManagementController.ts # Corporation admin
│   ├── HousingManagementController.ts  # Housing admin
│   ├── ChatMonitoringController.ts     # Chat moderation
│   ├── DocumentManagementController.ts # Document management
│   └── SystemConfigController.ts       # System configuration
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

**Endpoints**:
```typescript
# Character Management
GET    /admin/characters/pending     - Pending approvals
POST   /admin/characters/:id/approve - Approve character
POST   /admin/characters/:id/reject  - Reject character

# User Management
GET    /admin/users                  - List users
PATCH  /admin/users/:id              - Update user
POST   /admin/users/:id/ban          - Ban user
DELETE /admin/users/:id/ban          - Unban user

# System
GET    /admin/stats                  - System statistics
POST   /admin/broadcast              - Send broadcast

# ... (40+ more admin endpoints)
```

---

### 4. Forum Module (`/forum`) - Future

**Purpose**: Community discussions, announcements

**Planned Structure**:
```
src/modules/forum/
├── controllers/
│   ├── ForumPostController.ts
│   ├── ForumThreadController.ts
│   └── ForumModerationController.ts
├── routes/
│   └── index.ts
└── services/
    └── ForumService.ts
```

**Status**: ⏸️ Planned, not yet implemented

---

### 5. Documents Module (`/game/documents`)

**Purpose**: Game documentation (ambientazione, regolamento)

**Structure**:
```
src/modules/game/controllers/
└── DocumentController.ts       # Document operations + semantic search
```

**Key Features**:
- **Hierarchical Documents**: Sections and subsections
- **Semantic Search**: Qdrant-powered vector search
- **Favorites**: User favorite documents
- **Visibility Control**: Public, authenticated, admin

**Endpoints**:
```typescript
GET    /game/documents                - List documents
GET    /game/documents/:slug          - Get document by slug
POST   /game/documents/search         - Semantic search (Qdrant)
GET    /game/documents/favorites      - User favorites
POST   /game/documents/:slug/favorite - Toggle favorite
```

**Details**: [Semantic Search](../04-ai-ml/semantic-search.md)

---

### 6. Tickets Module (`/tickets`) - Future

**Purpose**: Support ticket system

**Planned Structure**:
```
src/modules/tickets/
├── controllers/
│   ├── TicketController.ts
│   └── TicketMessageController.ts
├── routes/
│   └── index.ts
└── services/
    └── TicketService.ts
```

**Status**: ⏸️ Planned, not yet implemented

---

## Technology Stack

### Framework - Express 5.2.1

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

// Error middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: err.message });
});
```

---

### ORM - Mongoose 9.2.1

**Features Used**:
- **Schema Validation**: Type safety at DB level
- **Middleware Hooks**: pre/post save, validate
- **Population**: Automatic ref resolution
- **Virtuals**: Computed properties
- **TypeScript**: First-class TS support

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

### WebSocket - Socket.IO 4.8.3

**Features**:
- **Room-Based Broadcasting**: Targeted events per location/session
- **Redis Adapter**: Multi-instance synchronization
- **Automatic Reconnection**: Client resilience
- **Event Namespacing**: Organized event types

**Setup**:
```typescript
// src/modules/game/websocket/index.ts
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

export function setupWebSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.GAME_URL,
      credentials: true
    }
  });

  // Redis adapter for multi-instance
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  // Event handlers
  io.on('connection', (socket) => {
    const characterId = socket.handshake.auth.characterId;

    // Join character room
    socket.join(`character:${characterId}`);

    // Location events
    socket.on('location:join', handleLocationJoin);
    socket.on('location:leave', handleLocationLeave);

    // ... more handlers
  });

  return io;
}
```

**Details**: [WebSocket Patterns](../05-frontend/websocket-patterns.md)

---

## Database Architecture

### MongoDB - 42 Collections

**Categories**:
1. **Core** (3): User, CharacterSession, SystemConfiguration
2. **Characters** (4): Character, CharacterProgression, CharacterFinances, BackgroundQuestion
3. **Locations & Gameplay** (5): Location, LocationAction, LocationTag, Route, BlockNotes
4. **Housing & Economy** (4): HousingProperty, EstateTransaction, Economy, FinancialTransaction
5. **Messaging** (7): OnGameMessage, OnGameMessageView, OffGameChat, OffGameChatMessage, etc.
6. **Documents** (3): Document, DocumentSection, DocumentChunk
7. **Gaming Sessions** (4): GamingSession, SessionManagement, SessionTemplate, Campaign
8. **Tickets** (3): Ticket, TicketMessage, TicketNotification
9. **Corporations** (2): Corporation, Relationship
10. **Game Rules** (3): Occupation, Skill, SocialClassConfig
11. **Items** (1): Item
12. **Experience** (1): ExperienceGrant
13. **Moderation** (2): ChatModerationAction, BroadcastMessage
14. **System** (1): WebSocketEvent

**Connection Pooling**:
- Max pool size: 10
- Min pool size: 2
- Idle timeout: 45s

**Details**: [MongoDB Schemas](../01-infrastructure/mongodb-schemas.md)

---

## Middleware Stack

### Request Flow

```
Incoming Request
    ↓
CORS (cors)
    ↓
Helmet (security headers)
    ↓
Compression (gzip)
    ↓
Body Parser (JSON/URL-encoded)
    ↓
Cookie Parser
    ↓
Morgan (HTTP logging)
    ↓
Authentication Middleware (if needed)
    ↓
Route Handler
    ↓
Error Handler
    ↓
Response
```

---

### Authentication Middleware

```typescript
// src/middleware/auth.ts
export function requireAuth(req, res, next) {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
}

export function requireCharacter(req, res, next) {
  const characterContext = req.cookies.character_context;

  if (!characterContext) {
    return res.status(403).json({
      success: false,
      error: 'Character context required'
    });
  }

  try {
    const decoded = jwt.verify(characterContext, process.env.CHARACTER_SESSION_MANAGER_SECRET);
    req.character = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      error: 'Invalid character context'
    });
  }
}
```

---

### Error Handler

```typescript
// src/middleware/errorHandler.ts
export function errorHandler(err, req, res, next) {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.userId
  });

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal server error'
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
```

---

## Event-Driven Architecture

### Redis Pub/Sub

**Channels**:
```typescript
// Character events
'character:updated'
'character:daily_experience'
'character:experience_granted'

// Location events
'location:action_created'
'turn:advanced'

// Session events
'session:created'
'session:started'
'session:ended'

// Corporation events
'corporation:created'
'corporation:member_approved'
'corporation:treasury_updated'

// Housing events
'housing:rent_due_warning'
'housing:rent_paid'
'housing:eviction_notice'

// Document events
'document:created'
'embedding:requested'

// Chat events
'chat:moderation_applied'
'chat:new_message'
```

**Publishing**:
```typescript
// src/utils/events/embedding-publisher.ts
export async function publishEmbeddingRequest(documentId: string, content: string) {
  await redisClient.publish('embedding:requested', JSON.stringify({
    documentId,
    content,
    timestamp: new Date()
  }));
}
```

**Subscribing** (embeddings-worker):
```typescript
// services/embeddings-worker/src/index.ts
redisSubscriber.subscribe('document:created');
redisSubscriber.on('message', async (channel, message) => {
  if (channel === 'document:created') {
    const { documentId, content } = JSON.parse(message);
    await embeddingQueue.add({ documentId, content });
  }
});
```

---

## Cron Jobs

### Daily Experience (2:00 AM UTC)

```typescript
// src/cron/dailyExperience.ts
import cron from 'node-cron';

cron.schedule('0 2 * * *', async () => {
  logger.info('Running daily experience grant');

  const activeCharacters = await Character.find({
    status: 'active',
    lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });

  for (const char of activeCharacters) {
    const activityScore = await calculateActivityScore(char._id);
    const xpGrant = Math.floor(2 * activityScore); // 2 XP base * multiplier
    const skillPoints = Math.floor(1 * activityScore);

    await CharacterProgression.findOneAndUpdate(
      { characterId: char._id },
      {
        $inc: {
          'experience.total': xpGrant,
          'experience.available': skillPoints
        }
      }
    );

    await publishEvent('character:daily_experience', {
      characterId: char._id,
      experiencePoints: xpGrant,
      skillPoints,
      activityScore
    });
  }

  logger.info(`Daily experience granted to ${activeCharacters.length} characters`);
});
```

---

### Rent Collection (6:00 AM UTC)

```typescript
// src/cron/rentCollection.ts
import cron from 'node-cron';

cron.schedule('0 6 * * *', async () => {
  logger.info('Running rent collection');

  const overdueProperties = await HousingProperty.find({
    isAvailable: false,
    rentPaidUntil: { $lt: new Date() }
  });

  for (const property of overdueProperties) {
    const daysOverdue = Math.floor(
      (Date.now() - property.rentPaidUntil.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysOverdue >= 14) {
      // Evict tenant
      await evictTenant(property._id, property.currentTenantId);
    } else if (daysOverdue >= 7) {
      // Final notice
      await sendFinalNotice(property.currentTenantId, property);
    } else {
      // Warning
      await sendWarning(property.currentTenantId, property, daysOverdue);
    }
  }

  logger.info(`Processed ${overdueProperties.length} overdue properties`);
});
```

**Details**: [Housing System](../03-game-systems/housing-system.md)

---

## API Response Standard

```typescript
// src/utils/apiResponse.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: Date;
}

export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date()
  };
}

export function errorResponse(error: string): ApiResponse<never> {
  return {
    success: false,
    error,
    timestamp: new Date()
  };
}
```

---

## Logging

### Winston Logger

```typescript
// src/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});
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

**Dockerfile.dev**:
```dockerfile
FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source (via volume mount in docker-compose)
# src/ is mounted as read-only volume

# Start with tsx watch
CMD ["npm", "run", "dev"]
```

**docker-compose.yml volume mounts**:
```yaml
volumes:
  - ./services/unified-backend/src:/app/src:ro  # Source (read-only)
  - ./services/unified-backend/logs:/app/logs   # Logs (read-write)
  - ./services/unified-backend/node_modules:/app/node_modules:ro  # Dependencies
```

---

## Deployment

### Production Build

```bash
# Build TypeScript
npm run build

# Output: dist/
```

### Docker Production

```dockerfile
# Multi-stage build
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

CMD ["node", "dist/index.js"]
```

**Details**: [Deployment Guide](../06-operations/deployment-guide.md)

---

## Testing

### API Testing

```bash
# Test authentication
./scripts/test-auth-endpoints.sh

# Test game endpoints
./scripts/test-game-endpoints.sh

# Test housing system (12/13 passing)
./scripts/test-housing-endpoints.sh
```

**Details**: [API Testing Scripts](../07-testing/api-testing-scripts.md)

---

## Performance Metrics

**API Response Times**:
- Standard queries: < 200ms
- Complex operations: < 500ms
- Database queries: < 50ms (with indexes)

**Memory Usage**:
- Development: ~300MB
- Production: ~500MB

**Throughput**:
- ~1000 req/sec (standard hardware)
- WebSocket: 10k+ concurrent connections

---

## Related Documentation

- [API Gateway](./api-gateway.md) - Proxy routing
- [Authentication System](./authentication-system.md) - JWT system
- [MongoDB Schemas](../01-infrastructure/mongodb-schemas.md) - Database structure
- [WebSocket Patterns](../05-frontend/websocket-patterns.md) - Real-time events
- [Docker Compose](../01-infrastructure/docker-compose.md) - Service orchestration
- [Deployment Guide](../06-operations/deployment-guide.md) - Production deployment

---

## Quick Reference

**Port**: 3001
**Framework**: Express 5.2.1
**ORM**: Mongoose 9.2.1
**WebSocket**: Socket.IO 4.8.3
**Database**: MongoDB 7.0 (42 collections)
**Cache**: Redis 7.2
**Hot-Reload**: tsx watch
**Modules**: auth, game, admin, forum (future), documents, tickets (future)
