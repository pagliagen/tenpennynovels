---
type: rules
category: backend
scope: unified-backend
criticality: high
last_updated: 2026-03-27
---

# Unified Backend Service

Main business logic backend with 6 domain modules, Socket.IO WebSocket server, Redis pub/sub, CRON jobs, and comprehensive middleware chain.

**Port:** 3001 (internal only - accessed via api-gateway)
**Deployment:** PM2 fork mode (1 instance)
**Tech Stack:** Express 5.1, Socket.IO, Mongoose, Redis, Bull

## Module Structure

Unified-backend is organized into 6 independent domain modules, each with its own controllers, services, routes, and models.

```
services/unified-backend/src/
├── server.ts                    # Entry point, WebSocket setup, CRON jobs
├── app.ts                       # Express app, middleware chain, route registration
├── modules/                     # Domain modules
│   ├── auth/                    # User authentication, JWT, email verification
│   │   ├── controllers/         # AuthController (login, register, verify, etc.)
│   │   ├── services/            # EmailService, TokenService
│   │   ├── middleware/          # auth.ts (AuthMiddleware)
│   │   ├── routes/              # auth.routes.ts
│   │   └── utils/               # crypto.ts, validation
│   ├── game/                    # Locations, characters, chat, inventory, actions
│   │   ├── controllers/         # ChatController (2873 lines), LocationController, etc.
│   │   ├── services/            # LocationService, CharacterService
│   │   ├── websocket/           # Socket.IO handlers
│   │   └── routes/              # game.routes.ts
│   ├── admin/                   # Admin panel, user/character/location management
│   │   ├── controllers/         # AdminController, AdminDocumentsController
│   │   ├── middleware/          # adminAuth.ts
│   │   └── routes/              # admin.routes.ts
│   ├── documents/               # Content management, semantic search
│   │   ├── controllers/         # DocumentsController
│   │   ├── services/            # DocumentsService
│   │   └── routes/              # documents.routes.ts
│   ├── forum/                   # Forum posts, threads
│   │   ├── controllers/         # ForumController
│   │   └── routes/              # forum.routes.ts
│   └── tickets/                 # Support ticket system
│       ├── controllers/         # TicketsController
│       └── routes/              # tickets.routes.ts
├── shared/                      # Cross-module utilities
│   ├── utils/
│   │   ├── logger.ts            # Winston logger (createModuleLogger)
│   │   ├── apiResponse.ts       # Standard API response format
│   │   └── validation.ts        # Mongoose error translation
│   ├── middleware/
│   │   └── errorHandler.ts      # Centralized error handler
│   ├── services/
│   │   └── NotificationService.ts # WebSocket notification system
│   └── routes/
│       └── health.ts            # Health check endpoint
├── database/                    # Mongoose models, connection
│   ├── models/                  # User, Character, Location, Message, etc.
│   ├── connection.ts            # MongoDB connection singleton
│   └── plugins/                 # softDelete plugin (deletedAt timestamp)
└── config/                      # Runtime config, Redis, permissions
    ├── runtime/
    │   ├── appConfig.ts         # Environment variables, feature flags
    │   ├── redis.ts             # Redis singleton client
    │   └── envValidation.ts     # Validate required env vars
    └── permissions.ts           # Admin permission system
```

## Controller Pattern (Static Methods)

All controllers use static methods (no instance state) for simplicity and testability.

```typescript
// Example: modules/auth/controllers/AuthController.ts
import { Request, Response } from 'express';
import { successResponse, errorResponse } from '@shared/utils/apiResponse';
import { logger } from '@shared/utils/logger';

export class AuthController {
  /**
   * POST /auth/login
   * Authenticate user and return JWT token
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;

      // Service layer handles business logic
      const user = await User.findOne({ username });
      if (!user) {
        res.status(401).json(errorResponse('Username o password errati', 'INVALID_CREDENTIALS'));
        return;
      }

      const isValid = await user.comparePassword(password);
      if (!isValid) {
        res.status(401).json(errorResponse('Username o password errati', 'INVALID_CREDENTIALS'));
        return;
      }

      // Generate JWT token
      const token = CryptoUtils.generateAuthToken(user);

      // Set cookie
      AuthMiddleware.setAuthCookie(res, token, req.body.rememberMe);

      res.status(200).json(successResponse({ user, token }, 'Login effettuato con successo'));
    } catch (error) {
      logger.error('Login error', { error, username: req.body.username });
      res.status(500).json(errorResponse('Errore durante il login', 'LOGIN_ERROR'));
    }
  }

  /**
   * POST /auth/logout
   * Clear auth cookies
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      AuthMiddleware.clearAuthCookies(res);
      res.status(200).json(successResponse(undefined, 'Logout effettuato con successo'));
    } catch (error) {
      logger.error('Logout error', { error });
      res.status(500).json(errorResponse('Errore durante il logout', 'LOGOUT_ERROR'));
    }
  }
}
```

### Controller Best Practices

**✅ CORRECT:**
```typescript
// Static methods
static async getUser(req: Request, res: Response): Promise<void> { ... }

// Explicit return type (Promise<void>)
static async createUser(...): Promise<void> { ... }

// Service layer for business logic
const user = await UserService.createUser(data);

// Standard response format
res.status(200).json(successResponse(user));

// Error handling with context
logger.error('Error creating user', { error, userId: req.user?.userId });
```

**❌ WRONG:**
```typescript
// Instance methods (unnecessary state)
async getUser(req: Request, res: Response) { ... }

// Missing return type
static async createUser(req: Request, res: Response) { ... }

// Business logic in controller
const user = await User.create(req.body); // ❌ Use service layer

// Inconsistent response
res.json({ user }); // ❌ Use successResponse()
```

## Service Layer Pattern

Services encapsulate business logic, database operations, and external API calls.

```typescript
// Example: modules/game/services/LocationService.ts
import { Location } from '@database/models';
import { logger } from '@shared/utils/logger';

export class LocationService {
  /**
   * Get all visible locations for authenticated users
   */
  static async getAccessibleLocations(userId?: string): Promise<any[]> {
    try {
      const query = userId
        ? { $or: [{ 'settings.visible': true }, { 'settings.private': false }] }
        : { 'settings.visible': true, 'settings.private': false };

      const locations = await Location.find(query).sort({ name: 1 });

      return locations.map(location => ({
        _id: location._id.toString(),  // ✅ CRITICAL: Use _id (not id)
        slug: location.slug,            // ✅ CRITICAL: Include slug for SEO URLs
        name: location.name,
        description: location.description,
        settings: {                     // ✅ CRITICAL: Frontend expects this object
          visible: location.settings?.visible ?? true,
          chat: location.settings?.chat ?? true,
          shop: location.settings?.shop ?? false,
          private: location.settings?.private ?? false
        },
        hasShop: location.settings?.shop || false,
        hasChat: location.settings?.chat || false,
        isPrivate: location.settings?.private || false,
        occupants: location.occupants || []  // ✅ Avoid undefined errors
      }));
    } catch (error) {
      logger.error('Error fetching accessible locations', { error, userId });
      throw error;
    }
  }

  /**
   * Set character's current location
   */
  static async setCharacterLocation(
    characterId: string,
    locationId: string | null
  ): Promise<void> {
    try {
      const Character = (await import('@database/models')).Character;

      const character = await Character.findById(characterId);
      if (!character) {
        throw new Error('Character not found');
      }

      // Cleanup old location occupants
      if (character.currentLocation) {
        await Location.findByIdAndUpdate(
          character.currentLocation,
          { $pull: { occupants: characterId } }
        );
      }

      // Set new location
      character.currentLocation = locationId;
      await character.save();

      // Add to new location occupants
      if (locationId) {
        await Location.findByIdAndUpdate(
          locationId,
          { $addToSet: { occupants: characterId } }
        );
      }

      logger.info('Character location updated', { characterId, locationId });
    } catch (error) {
      logger.error('Error setting character location', { error, characterId, locationId });
      throw error;
    }
  }
}
```

## Route Registration

Routes are registered in `app.ts` after middleware chain is set up.

```typescript
// services/unified-backend/src/app.ts
import express from 'express';
import authRoutes from '@modules/auth/routes/auth.routes';
import gameRoutes from '@modules/game/routes/game.routes';
import adminRoutes from '@modules/admin/routes/admin.routes';
import documentsRoutes from '@modules/documents/routes/documents.routes';
import forumRoutes from '@modules/forum/routes/forum.routes';
import ticketsRoutes from '@modules/tickets/routes/tickets.routes';
import healthRoutes from '@shared/routes/health';
import { notFoundHandler, errorHandler } from '@shared/middleware/errorHandler';

const app = express();

// Middleware chain
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Routes
app.use('/auth', authRoutes);
app.use('/game', gameRoutes);
app.use('/admin', adminRoutes);
app.use('/documents', documentsRoutes);
app.use('/forum', forumRoutes);
app.use('/tickets', ticketsRoutes);
app.use('/health', healthRoutes);

// Error handlers (MUST be last)
app.use(notFoundHandler);  // 404 handler
app.use(errorHandler);     // Centralized error handler

export default app;
```

### Route Definition Pattern

```typescript
// modules/auth/routes/auth.routes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { AuthMiddleware } from '../middleware/auth';
import { loginValidation, handleValidationErrors } from '../utils/validation';

const router = Router();

// Public routes (no auth required)
router.post('/login', loginValidation, handleValidationErrors, AuthController.login);
router.post('/register', AuthController.register);
router.post('/verify-email', AuthController.verifyEmail);

// Protected routes (auth required)
router.get('/me', AuthMiddleware.authenticateUser(), AuthController.getMe);
router.post('/logout', AuthMiddleware.authenticateUser(), AuthController.logout);

// Admin routes (admin auth required)
router.get(
  '/users',
  AuthMiddleware.authenticateUser(),
  AuthMiddleware.requireAdmin(['manage_users']),
  AuthController.listUsers
);

export default router;
```

## Middleware Chain

### AuthMiddleware (JWT + Character Context)

**File:** `modules/auth/middleware/auth.ts`

```typescript
export class AuthMiddleware {
  /**
   * Authenticate user via auth_token cookie (JWT)
   */
  static authenticateUser(required = true) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const authToken = req.cookies?.auth_token;

      if (!authToken) {
        if (required) {
          return res.status(401).json({
            result: false,
            error: 'Autenticazione richiesta',
            code: 'AUTH_REQUIRED'
          });
        }
        return next();
      }

      try {
        const decoded = CryptoUtils.verifyAuthToken(authToken);
        req.user = decoded;

        // Check if account is deleted/anonymized
        const user = await User.findById(decoded.userId).select('accountStatus');
        if (user && (user.accountStatus === 'anonymized' || user.accountStatus === 'deleted')) {
          AuthMiddleware.clearAuthCookies(res);
          return res.status(403).json({
            result: false,
            error: 'Account non più attivo',
            code: 'ACCOUNT_DELETED'
          });
        }

        next();
      } catch (error) {
        res.clearCookie('auth_token');
        if (required) {
          return res.status(401).json({
            result: false,
            error: 'Sessione non valida o scaduta',
            code: 'INVALID_SESSION'
          });
        }
        next();
      }
    };
  }

  /**
   * Authenticate character via X-Session-Id header (Redis SessionStore)
   * NEW FLOW: Redis-based multi-tab session support
   */
  static authenticateCharacter(required = true) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const { SessionStore } = await import('../services/SessionStore');
      const { Character } = await import('@database/models');

      // Read sessionId from header (or body for sendBeacon)
      const sessionId = (req.headers['x-session-id'] as string) || req.body?.sessionId;

      if (!sessionId) {
        if (required) {
          return res.status(400).json({
            result: false,
            error: 'Selezione del personaggio richiesta',
            code: 'CHARACTER_REQUIRED'
          });
        }
        return next();
      }

      // Lookup Redis session
      const session = await SessionStore.getSession(sessionId);
      if (!session) {
        if (required) {
          return res.status(401).json({
            result: false,
            error: 'Sessione non valida o scaduta',
            code: 'INVALID_SESSION'
          });
        }
        return next();
      }

      // CRITICAL: Ownership validation (defense in depth)
      if (req.user && session.userId !== req.user.userId) {
        return res.status(403).json({
          result: false,
          error: 'Sessione non valida per questo utente',
          code: 'SESSION_OWNERSHIP_MISMATCH'
        });
      }

      // Populate req.character from Character model
      const character = await Character.findById(session.characterId);
      if (!character) {
        if (required) {
          return res.status(404).json({
            result: false,
            error: 'Personaggio non trovato',
            code: 'CHARACTER_NOT_FOUND'
          });
        }
        return next();
      }

      req.character = {
        characterId: character.id,
        characterName: character.surname
          ? `${character.name} ${character.surname}`
          : character.name,
        userId: session.userId,
        gameplayRoles: character.gameplayRoles || [],
        isApproved: character.playerStatus === 'approved',
        isGestore: character.isGestore || false,
        playerStatus: character.playerStatus || 'draft',
        characterPermissions: character.characterPermissions || []
      };

      req.sessionId = sessionId;

      // Update session activity (async, non-blocking)
      SessionStore.updateSessionActivity(sessionId).catch(err =>
        logger.error('Failed to update session activity', { error: err, sessionId })
      );

      next();
    };
  }

  /**
   * Require admin privileges
   */
  static requireAdmin(permissions: string[] = []) {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.user?.canAccessAdminPanel) {
        return res.status(403).json({
          result: false,
          error: 'Privilegi admin richiesti',
          code: 'ADMIN_REQUIRED'
        });
      }

      // Check specific permissions if provided
      if (permissions.length > 0) {
        const { hasAdminPermission } = await import('@config/permissions');
        const hasPermission = permissions.every((p) =>
          hasAdminPermission(
            req.user!.gameplayRoles ?? [],
            req.user!.adminPermissions ?? [],
            req.user!.isGestore ?? false,
            p as AdminPermission
          )
        );

        if (!hasPermission) {
          return res.status(403).json({
            result: false,
            error: 'Permessi admin insufficienti',
            code: 'INSUFFICIENT_PERMISSIONS'
          });
        }
      }

      next();
    };
  }

  /**
   * Require gameplay role (player, master, moderatore)
   * isGestore bypasses check
   */
  static requireGameplayRole(roles: ('player' | 'master' | 'moderatore')[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!req.character) {
        return res.status(400).json({
          result: false,
          error: 'Selezione del personaggio richiesta',
          code: 'CHARACTER_REQUIRED'
        });
      }

      if (req.character.isGestore) {
        return next(); // Bypass check for gestore
      }

      const hasRole = roles.some(role => req.character!.gameplayRoles?.includes(role));
      if (!hasRole) {
        return res.status(403).json({
          result: false,
          error: 'Permessi di gioco insufficienti',
          code: 'INSUFFICIENT_GAMEPLAY_ROLE'
        });
      }

      next();
    };
  }
}
```

### Middleware Chain Example

```typescript
// Route requiring user auth + character context + gameplay role
router.post(
  '/chat/send',
  AuthMiddleware.authenticateUser(),              // Step 1: Verify JWT
  AuthMiddleware.authenticateCharacter(),         // Step 2: Verify character session
  AuthMiddleware.requireGameplayRole(['player']), // Step 3: Check gameplay role
  ChatController.sendMessage                      // Step 4: Controller logic
);
```

## Authentication Flow Dettagliato

TenPennyNovels usa un sistema di autenticazione a **due livelli**:
1. **User Authentication**: JWT-based user authentication
2. **Character Session**: Redis-based character session for gameplay

### User Authentication (JWT)

#### Registrazione

**Flow:**
1. User compila form → `POST /auth/register`
2. Backend (AuthController):
   - Valida input (username, email, password)
   - Hash password con bcrypt (10 rounds)
   - Genera email verification token
   - Crea User in MongoDB
   - Invia email verifica
3. Response: User creato, email verifica inviata

**Security:**
- Password NEVER in plain text
- bcrypt salt rounds: 10
- Email verification required before login

#### Verifica Email

**Flow:**
1. User clicca link verifica: `/?token=xxx` → landing index
2. Index estrae token da query param → `GET /auth/verify-email/:token`
3. Backend (AuthController):
   - Valida token (ttl 24h)
   - Update `User.isEmailVerified = true`
4. Response: Email verificata (o errore con canResend flag)

#### Login

**Flow:**
1. User inserisce credenziali → `POST /auth/login`
2. Backend (AuthController):
   - Valida username/email + password
   - Genera JWT token (exp: 24h)
   - Salva token in **HttpOnly cookie** (`auth_token`)
   - Crea user session in Redis (opzionale)
3. Response: Login success, token in cookie

**JWT Token Structure:**
```typescript
{
  userId: string;      // MongoDB _id
  username: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  iat: number;         // Issued at
  exp: number;         // Expiry (24h default)
}
```

**Cookie Settings:**
- `httpOnly: true` → NOT accessible from JavaScript (XSS protection)
- `secure: true` → HTTPS only in production
- `sameSite: 'strict'` → CSRF protection
- `maxAge: 24h`

#### Refresh Token

**Flow:**
1. Frontend detecta token expiry → `POST /auth/refresh`
2. Backend:
   - Valida existing token (anche se expired da poco)
   - Genera nuovo JWT
   - Aggiorna cookie `auth_token`
3. Response: New token generated

### Character Session (Redis SessionStore)

#### Avvio Sessione (Character Selection)

**Flow:**
1. User seleziona character → `POST /auth/select-character` (body: `{ characterId }`)
2. Backend (AuthController.selectCharacter):
   - Verifica ownership: `character.userId === req.user._id`
   - Verifica stato: character NOT deleted/banned
   - Crea/aggiorna sessione in **Redis** via SessionStore
   - Genera opaque `sessionId` (UUID v4)
   - Optional: audit log in MongoDB (CharacterSession collection)
3. Response:
   ```typescript
   {
     success: true,
     data: {
       sessionId: string,  // Client MUST store this
       character: { /* character data */ }
     }
   }
   ```

**Client Storage:**
```typescript
// Landing app (after selection)
sessionStorage.setItem('character_session_id', sessionId);

// Redirect to game with sessionId
window.location.href = `${GAME_URL}?sessionId=${sessionId}`;

// Game app (_app.tsx extracts from query param)
useEffect(() => {
  const { sessionId } = router.query;
  if (sessionId) {
    sessionStorage.setItem('character_session_id', sessionId);
  }
}, [router.query]);
```

**API Client Setup:**
```typescript
// Game app: lib/api/client.ts
apiClient.interceptors.request.use((config) => {
  // Add X-Session-Id header for character context
  const sessionId = sessionStorage.getItem('character_session_id');
  if (sessionId) {
    config.headers['X-Session-Id'] = sessionId;
  }
  return config;
});
```

**WebSocket Setup:**
```typescript
// Game app: contexts/WebSocketContext.tsx
const socket = io(WEBSOCKET_URL, {
  withCredentials: true,  // Send auth_token cookie
  auth: {
    sessionId: sessionStorage.getItem('character_session_id')  // Character context
  }
});
```

#### Sessione Attiva

**Middleware Flow:**
1. Request arrives with `X-Session-Id` header
2. `AuthMiddleware.authenticateCharacter()` called
3. Lookup session in Redis: `SessionStore.getSession(sessionId)`
4. Validate session:
   - Session exists
   - Not expired (TTL)
   - Character still valid (not deleted)
5. Populate `req.character` with character data
6. Controller has access to both `req.user` and `req.character`

**Deprecation Note:**
- Old system: `character_context` cookie → **DEPRECATED**
- Current system: `X-Session-Id` header + Redis SessionStore
- Cookie kept for backwards compatibility only

#### Terminazione / Cambio Character

**Options:**
1. **Logout**: `POST /auth/logout` → invalidates both JWT and sessions
2. **Switch Character**: `POST /auth/select-character` with new characterId → creates new session
3. **Security Invalidation**: Admin can invalidate sessions via SecurityController

**Redis Cleanup:**
- TTL-based expiry (1h inactivity default)
- Manual cleanup on logout
- CRON job cleans expired sessions (see CRON Jobs section)

### Middleware Types & Usage

#### AuthMiddleware (auth module)

**Location:** `modules/auth/middleware/auth.ts`
**Used on:** `/auth` routes

```typescript
// JWT verification only
router.post('/change-password',
  AuthMiddleware.requireUserAuth,  // Verify JWT, populate req.user
  AuthController.changePassword
);
```

**Methods:**
- `requireUserAuth()` → Verify JWT, throw 401 if invalid
- `authenticateUser(required)` → Optional auth (populate req.user if token present)

#### AuthMiddleware (game module)

**Location:** `modules/game/middleware/auth.ts`
**Used on:** `/game` routes

```typescript
// JWT + Character session verification
router.post('/chat/send',
  AuthMiddleware.authenticateUser(),              // Step 1: JWT
  AuthMiddleware.authenticateCharacter(),         // Step 2: Character session (X-Session-Id)
  AuthMiddleware.requireGameplayRole(['player']), // Step 3: Role check
  ChatController.sendMessage
);
```

**Methods:**
- `authenticateUser(required)` → JWT verification
- `authenticateCharacter(required)` → SessionStore lookup, populate req.character
- `requireGameplayRole(roles)` → Check character role (player/master/admin)

#### AdminAuthMiddleware (admin module)

**Location:** `modules/admin/middleware/adminAuth.ts`
**Used on:** `/admin` routes

```typescript
// Admin permission verification
router.delete('/users/:id',
  AdminAuthMiddleware.requireAdminAccess,         // JWT + admin role
  AdminAuthMiddleware.requirePermission('users.delete'),  // Granular permission
  AdminController.deleteUser
);
```

**Methods:**
- `requireAdminAccess` → Verify JWT + admin/moderator role
- `requirePermission(permission)` → Check granular permission
- `logAdminAction(action)` → Audit log admin operations

### Security Best Practices

**Password Security:**
- ✅ bcrypt hashing (10 rounds)
- ✅ NEVER log passwords (even hashed)
- ✅ Password reset with temporary token (24h TTL)
- ✅ Rate limiting on login endpoint (via api-gateway)

**Token Security:**
- ✅ JWT exp: 24h (not too long)
- ✅ HttpOnly cookies (XSS protection)
- ✅ Secure flag in production (HTTPS only)
- ✅ SameSite: strict (CSRF protection)
- ✅ Token refresh before expiry

**Session Security:**
- ✅ SessionId: UUID v4 (cryptographically random)
- ✅ Redis storage with TTL (auto-cleanup)
- ✅ Ownership validation (sessionId.userId === jwt.userId)
- ✅ Defense in depth: JWT + SessionId validation

**Error Messages:**
- ✅ Generic errors: "Invalid credentials" (don't reveal "user exists")
- ✅ NEVER leak: password, token, internal errors
- ✅ Log detailed errors server-side only

**Audit Logging:**
- ✅ Log sensitive operations: login, character selection, admin actions
- ✅ Include: userId, IP, timestamp, action
- ✅ Store in MongoDB AuditLog collection

### Common Issues & Solutions

**Issue:** Character session lost on page refresh
**Solution:** Game app `_app.tsx` extracts sessionId from query param and stores in sessionStorage

**Issue:** 401 on API calls after character selection
**Solution:** Verify `X-Session-Id` header is sent (check apiClient interceptors)

**Issue:** WebSocket connection but no character context
**Solution:** Verify `auth.sessionId` passed to Socket.IO connect options

**Issue:** "Session not found" error
**Solution:** Session expired (1h TTL), user must re-select character

## SessionStore (Redis Multi-Tab Support)

**Pattern:** Redis-based session management for multi-tab character context.

```typescript
// modules/auth/services/SessionStore.ts
import { redis } from '@config/runtime/redis';
import { v4 as uuidv4 } from 'uuid';

interface CharacterSession {
  sessionId: string;
  userId: string;
  characterId: string;
  createdAt: number;
  lastActivity: number;
}

export class SessionStore {
  private static SESSION_PREFIX = 'session:';
  private static SESSION_TTL = 24 * 60 * 60; // 24 hours

  /**
   * Create new character session
   */
  static async createSession(userId: string, characterId: string): Promise<string> {
    const sessionId = uuidv4();
    const session: CharacterSession = {
      sessionId,
      userId,
      characterId,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    await redis.setex(
      `${this.SESSION_PREFIX}${sessionId}`,
      this.SESSION_TTL,
      JSON.stringify(session)
    );

    return sessionId;
  }

  /**
   * Get session by ID
   */
  static async getSession(sessionId: string): Promise<CharacterSession | null> {
    const data = await redis.get(`${this.SESSION_PREFIX}${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update session activity timestamp
   */
  static async updateSessionActivity(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      await redis.setex(
        `${this.SESSION_PREFIX}${sessionId}`,
        this.SESSION_TTL,
        JSON.stringify(session)
      );
    }
  }

  /**
   * Delete session
   */
  static async deleteSession(sessionId: string): Promise<void> {
    await redis.del(`${this.SESSION_PREFIX}${sessionId}`);
  }
}
```

## WebSocket Handlers (Socket.IO + Redis Adapter)

**File:** `modules/game/websocket/index.ts`

### Setup Pattern

```typescript
// server.ts
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: appConfig.isProduction ? false : true,
    credentials: appConfig.isProduction ? false : true
  },
  transports: ['websocket', 'polling']
});

// Setup Redis adapter (horizontal scaling support)
async function setupRedisAdapter() {
  const pubClient = createClient({ url: appConfig.db.redisUrl });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  io.adapter(createAdapter(pubClient, subClient));
  logger.info('✅ Socket.IO Redis adapter configured');
}

// Import and setup WebSocket handlers
const { setupWebSocket } = await import('@modules/game/websocket');
await setupWebSocket(io);
```

### WebSocket Event Handlers

```typescript
// modules/game/websocket/index.ts
import { Server, Socket } from 'socket.io';
import { CryptoUtils } from '@modules/auth/utils/crypto';
import { SessionStore } from '@modules/auth/services/SessionStore';
import cookie from 'cookie';

export async function setupWebSocket(io: Server): Promise<void> {
  io.on('connection', async (socket: Socket) => {
    try {
      // Parse cookies from handshake
      const cookies = cookie.parse(socket.handshake.headers.cookie || '');
      const authToken = cookies.auth_token;

      if (!authToken) {
        socket.emit('error', { code: 'AUTH_REQUIRED', message: 'Autenticazione richiesta' });
        socket.disconnect();
        return;
      }

      // Verify JWT
      const user = CryptoUtils.verifyAuthToken(authToken);

      // Get sessionId from handshake query
      const sessionId = socket.handshake.query.sessionId as string;
      if (!sessionId) {
        socket.emit('error', { code: 'SESSION_REQUIRED', message: 'Sessione richiesta' });
        socket.disconnect();
        return;
      }

      // Validate session ownership
      const session = await SessionStore.getSession(sessionId);
      if (!session || session.userId !== user.userId) {
        socket.emit('error', { code: 'INVALID_SESSION', message: 'Sessione non valida' });
        socket.disconnect();
        return;
      }

      // Store session data in socket
      socket.data.userId = user.userId;
      socket.data.characterId = session.characterId;
      socket.data.sessionId = sessionId;

      logger.info('WebSocket connected', {
        userId: user.userId,
        characterId: session.characterId,
        socketId: socket.id
      });

      // Join character room (for targeted broadcasts)
      socket.join(`character:${session.characterId}`);

      // Register event handlers
      socket.on('chat:send', handleChatSend);
      socket.on('location:join', handleLocationJoin);
      socket.on('location:leave', handleLocationLeave);
      socket.on('disconnect', handleDisconnect);

    } catch (error) {
      logger.error('WebSocket connection error', { error });
      socket.emit('error', { code: 'CONNECTION_ERROR', message: 'Errore di connessione' });
      socket.disconnect();
    }
  });
}

// Event handler example
async function handleChatSend(this: Socket, data: any) {
  try {
    const { characterId, sessionId } = this.data;

    // Validate and process message
    const message = await ChatController.sendMessageWebSocket(characterId, data);

    // Broadcast to location room
    this.to(`location:${data.locationId}`).emit('chat:message', message);

    // Acknowledge to sender
    this.emit('chat:sent', { messageId: message._id });

  } catch (error) {
    logger.error('Chat send error', { error, characterId: this.data.characterId });
    this.emit('error', { code: 'CHAT_ERROR', message: 'Errore invio messaggio' });
  }
}
```

### WebSocket Error Handling (CRITICAL)

**Memory reference:** 2026-03-03 - Fixed api-gateway WebSocket proxy to check res.status before calling.

```typescript
// CRITICAL: After WebSocket upgrade, response object is a TCP socket, not HTTP Response
// Always check if res.status exists before calling

// ✅ CORRECT
io.use((socket, next) => {
  try {
    // Validation logic
    next();
  } catch (error) {
    next(new Error('Validation failed'));
  }
});

// ✅ CORRECT (error handler in proxy)
on: {
  error: (err, _req, res) => {
    logger.error('WebSocket proxy error', { error: err.message });
    if (!res.headersSent && typeof res.status === 'function') {
      res.status(502).json({ error: 'WebSocket unavailable' });
    }
  }
}

// ❌ WRONG (crashes on upgrade)
on: {
  error: (err, _req, res) => {
    res.status(502).json({ error: 'WebSocket unavailable' }); // ❌ res.status is undefined
  }
}
```

## Redis Pub/Sub Pattern

Used for cross-service communication (e.g., unified-backend → embeddings-worker).

```typescript
// Publisher (unified-backend)
import { redis } from '@config/runtime/redis';

export class DocumentsService {
  static async publishEmbeddingEvent(documentId: string, content: string): Promise<void> {
    const event = {
      documentId,
      title: document.title,
      content,
      timestamp: Date.now()
    };

    await redis.publish('embeddings:document:new', JSON.stringify(event));
    logger.info('Published embedding event', { documentId });
  }
}

// Subscriber (embeddings-worker)
import { createClient } from 'redis';

const subscriber = createClient({ url: config.database.redisUrl });
await subscriber.connect();

subscriber.subscribe('embeddings:document:new', async (message) => {
  const event = JSON.parse(message);
  await embeddingsQueue.add('document-embedding', event);
  logger.info('Received embedding event', { documentId: event.documentId });
});
```

## Soft Delete Plugin

**Pattern:** All models use `deletedAt` timestamp for soft deletes (audit trail).

```typescript
// database/plugins/softDelete.ts
import { Schema } from 'mongoose';

export function softDeletePlugin(schema: Schema) {
  schema.add({ deletedAt: { type: Date, default: null } });

  // Override find methods to exclude deleted documents
  schema.pre(/^find/, function(this: any) {
    if (!this.getOptions().includeDeleted) {
      this.where({ deletedAt: null });
    }
  });

  // Soft delete method
  schema.methods.softDelete = async function() {
    this.deletedAt = new Date();
    return this.save();
  };

  // Restore method
  schema.methods.restore = async function() {
    this.deletedAt = null;
    return this.save();
  };
}

// Usage in model
import { softDeletePlugin } from '../plugins/softDelete';

const UserSchema = new Schema({ ... });
UserSchema.plugin(softDeletePlugin);

// Query excludes deleted documents by default
const users = await User.find(); // Only non-deleted users

// Include deleted documents explicitly
const allUsers = await User.find().setOptions({ includeDeleted: true });

// Soft delete
await user.softDelete();

// Restore
await user.restore();
```

## CRON Jobs

### Sitemap Generation (Daily)

```typescript
// cron/sitemapGeneration.ts
import cron from 'node-cron';
import { SitemapService } from '@modules/documents/services/SitemapService';

// Run daily at 03:00 + immediate on boot
cron.schedule('0 3 * * *', async () => {
  try {
    logger.info('Starting sitemap generation');
    await SitemapService.generateSitemap();
    logger.info('✅ Sitemap generation completed');
  } catch (error) {
    logger.error('❌ Sitemap generation failed', { error });
  }
});

// Immediate generation on boot
SitemapService.generateSitemap().catch(err =>
  logger.error('Initial sitemap generation failed', { error: err })
);
```

### Presence Cleanup (5 minutes)

```typescript
// cron/presenceCleanup.ts
import cron from 'node-cron';
import { PresenceService } from '@modules/game/services/PresenceService';
import { appConfig } from '@config/runtime';

// Only run if feature flag enabled
if (appConfig.features.presenceCleanup) {
  cron.schedule('*/5 * * * *', async () => {
    try {
      await PresenceService.cleanupStalePresence();
      logger.debug('Presence cleanup completed');
    } catch (error) {
      logger.error('Presence cleanup failed', { error });
    }
  });
}
```

## ChatController Note (Tech Debt)

**File:** `modules/game/controllers/ChatController.ts` (2873 lines)

**Issue:** ChatController is too large and handles too many responsibilities:
- Message sending (20+ action types)
- Message editing/deletion
- Attachment handling
- Notification dispatch
- WebSocket broadcasting
- Redis pub/sub

**TODO:** Split into smaller controllers:
- `ChatController` - Core chat operations
- `ChatActionsController` - Action type handlers
- `ChatNotificationsController` - Notification logic
- `ChatWebSocketController` - WebSocket handlers

**Pattern:** Until refactored, be cautious when modifying ChatController. Test thoroughly due to high coupling.

## Cross-References

- **Logger patterns:** See shared-backend.md → Winston Logger
- **API responses:** See shared-backend.md → API Response Format
- **Error handling:** See shared-backend.md → Error Handling Middleware
- **WebSocket proxy:** See api-gateway.md → WebSocket Proxying
- **Bull queue:** See embeddings-worker.md → Bull Queue Configuration

## Incidents & Lessons Learned

### Incident: Location Management Double API Call (2026-02-19)
**Problem:** Frontend called `joinLocation()` and `leaveLocation()` APIs directly, causing flickering UI. Backend didn't clean up occupants when leaving.

**Solution:**
1. Added dedicated `POST /game/locations/leave` endpoint
2. GameContext provides `joinLocation()` and `leaveLocation()` with optimistic updates
3. Fixed `setCharacterLocation()` to cleanup old location occupants

**Pattern:** For state-changing operations, provide dedicated endpoints and client-side context hooks with optimistic updates + rollback.

### Incident: LocationService Response Mismatch (2026-02-25)
**Problem:** `getAccessibleLocations()` returned incomplete structure (missing `slug`, `settings` object), used `id` instead of `_id`.

**Solution:**
1. Fixed to use `_id` (project standard)
2. Added missing `slug` field (SEO URLs)
3. Added missing `settings` object (frontend expects this)
4. Added `occupants: []` fallback to avoid undefined errors

**Pattern:** Before creating API responses, check project schemas and frontend types. Ensure all required fields are present.

### Incident: Document Toggle Race Condition (2026-03-01)
**Problem:** Toggle visibility/draft showed correct state briefly then reverted (flicker).

**Root Cause:** `onSettled` invalidation triggered immediate refetch that overwrote optimistic update.

**Solution:**
1. Removed `onSettled` invalidation - trust optimistic update
2. Created `updateDocumentNodeInRoutes` helper - traverses `Route[] → DocumentTreeNode[]` hierarchy
3. Keep `onError` rollback for backend failures

**Pattern:** For toggle operations, avoid `invalidateQueries` in `onSettled` to prevent race conditions. Only rollback on error.

---

**Next:** See api-gateway.md for reverse proxy patterns, embeddings-worker.md for Bull queue patterns.
