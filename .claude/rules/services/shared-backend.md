---
type: rules
category: backend
scope: all-services
criticality: high
last_updated: 2026-03-27
---

# Shared Backend Patterns

Common patterns, utilities, and CRITICAL rules that apply to ALL backend services (api-gateway, unified-backend, embeddings-worker). These are non-negotiable standards enforced across the codebase.

## CRITICAL: Winston Logger (NEVER console.log)

**Memory reference:** 2026-03-03 - Fixed api-gateway to replace all console.log with Winston logger.

### Rule
**ALWAYS use a structured logger. NEVER use console.log, console.error, console.warn, or console.debug in ANY backend service.**

Winston is the standard in api-gateway, unified-backend and local-ai (`local-ai/shared/logger.ts` wraps Winston). **Eccezione**: `embeddings-worker` usa un logger strutturato custom (`services/embeddings-worker/src/utils/logger.ts`, classe `Logger` con gli stessi livelli `debug/info/warn/error`), non Winston — stesso principio (mai console.*), implementazione diversa. Vedi [embeddings-worker.md](./embeddings-worker.md).

**Debito tecnico**: nessuno dei backend service (`services/*`, `local-ai/services/*`, `local-ai/gateway`) ha una configurazione ESLint propria (nessun `.eslintrc*`/`eslint.config.*` in quelle directory), quindi la regola "mai console.*" NON è enforced automaticamente lì come lo è in game/management (`no-console` via ESLint). Verificare manualmente in code review finché non viene aggiunta una config ESLint ai services.

### Why
- Structured logging with timestamps, module tags, log levels
- File logging (combined.log, error.log, module-specific logs)
- Production-ready error tracking
- Consistent log format across services

### Logger Creation

```typescript
// services/*/src/utils/logger.ts (pattern used in all services)
import winston from 'winston';

export function createModuleLogger(moduleName: string) {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { module: moduleName },
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat()
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, module, ...metadata }) => {
            const moduleTag = module ? `[${module}]` : '';
            const metaStr = Object.keys(metadata).length > 0
              ? ' ' + JSON.stringify(metadata, null, 2)
              : '';
            return `${timestamp} ${moduleTag} ${level}: ${message}${metaStr}`;
          })
        )
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: winston.format.json()
      }),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.json()
      })
    ]
  });
}

// Default logger for shared code
export const logger = createModuleLogger('core');
```

### Logger Levels

```typescript
logger.error('Critical error', { error: err, context }); // Errors, exceptions
logger.warn('Deprecated API usage', { userId });          // Warnings, deprecations
logger.info('Server started', { port: 3001 });           // Important events
logger.debug('Request received', { method, url });       // Debug info (dev only)
```

### Usage Examples

**✅ CORRECT:**
```typescript
// CORS blocked request (api-gateway)
logger.warn(`[CORS] Origine bloccata: ${origin}`);

// Proxy callback (api-gateway)
logger.error(`Errore proxy ${name}:`, { error: err.message, target: svc.target });

// Database connection (unified-backend)
logger.info('✅ MongoDB connected');

// Module-specific logger (unified-backend)
import { createModuleLogger } from '@shared/utils/logger';
const logger = createModuleLogger('auth');
logger.info('User logged in', { userId, username });

// Error with stack trace
logger.error('Auth middleware error:', { error: err, stack: err.stack });
```

**❌ WRONG:**
```typescript
console.log('Server started'); // ❌ No timestamps, no structure, not logged to files
console.error('Database error:', err); // ❌ Not tracked in error.log
console.warn('CORS blocked'); // ❌ No context, no metadata
```

### Morgan HTTP Access Logs (API Gateway)

For HTTP access logs, use Morgan with Winston stream:

```typescript
// services/api-gateway/src/app.ts
import morgan from 'morgan';
import { httpLoggerStream } from './utils/logger';

app.use(morgan('combined', { stream: httpLoggerStream }));

// services/*/src/utils/logger.ts
export const httpLoggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};
```

## CRITICAL: MongoDB _id Usage

**Memory reference:** 2026-02-25 - Fixed LocationService bug using `id` instead of `_id`.

### Rule
**ALWAYS use `_id` (not `id`) for MongoDB documents. This is the project standard across ALL schemas and services.**

### Why
- Mongoose default: ObjectId field is `_id`
- Project consistency: UserSchema, CharacterSchema, LocationSchema, MessageSchema, MarketItemSchema all use `_id`
- Frontend types expect `_id`

### Schema Definition

```typescript
// ✅ CORRECT (all schemas in unified-backend)
import { Schema } from 'mongoose';

const UserSchema = new Schema({
  // Mongoose automatically creates _id field
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  // ...
});

// Access: user._id (ObjectId)
// Convert to string: user._id.toString()
```

### API Response Format

```typescript
// ✅ CORRECT
{
  _id: location._id.toString(),  // MongoDB standard
  slug: location.slug,
  name: location.name,
  settings: { ... }
}

// ❌ WRONG (inconsistent with project standard)
{
  id: location._id.toString(),  // ❌ NOT used in this project
  slug: location.slug,
  name: location.name
}
```

### LocationService Example (2026-02-25 Fix)

**Before (WRONG):**
```typescript
// services/unified-backend/src/modules/game/services/LocationService.ts (OLD)
const locations = await Location.find({ 'settings.visible': true });
return locations.map(location => ({
  id: location._id.toString(), // ❌ WRONG - inconsistent
  name: location.name
}));
```

**After (CORRECT):**
```typescript
// services/unified-backend/src/modules/game/services/LocationService.ts (FIXED)
const locations = await Location.find({ 'settings.visible': true });
return locations.map(location => ({
  _id: location._id.toString(), // ✅ CORRECT - project standard
  slug: location.slug,           // ✅ Added missing field
  name: location.name,
  settings: {                    // ✅ Added missing object (frontend expects this)
    visible: location.settings?.visible ?? true,
    chat: location.settings?.chat ?? true,
    shop: location.settings?.shop ?? false,
    private: location.settings?.private ?? false
  }
}));
```

## API Response Format Standard

**File:** `services/unified-backend/src/shared/utils/apiResponse.ts`

### Response Types

All backend APIs use standardized response format with `success`, `data`, `timestamp`, and optional `requestId`.

```typescript
// Success response
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  requestId?: string;
  timestamp: string; // ISO 8601
}

// Error response
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
  requestId?: string;
  timestamp: string;
}

// List response (with pagination)
interface ListResponse<T> {
  success: true;
  list: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message?: string;
  requestId?: string;
  timestamp: string;
}
```

### Helper Functions

```typescript
// Success response
export function successResponse<T>(data: T, message?: string, requestId?: string): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    requestId,
    timestamp: new Date().toISOString()
  };
}

// Error response
export function errorResponse(
  error: string,
  code?: string,
  details?: any,
  _statusCode?: number,
  requestId?: string
): ErrorResponse {
  return {
    success: false,
    error,
    code,
    details,
    requestId,
    timestamp: new Date().toISOString()
  };
}

// List response
export function listResponse<T>(
  list: T[],
  pagination: PaginationInfo,
  message?: string,
  requestId?: string
): ListResponse<T> {
  return {
    success: true,
    list,
    pagination,
    message,
    requestId,
    timestamp: new Date().toISOString()
  };
}
```

### Usage Examples

**✅ CORRECT:**
```typescript
// Controller success response
const user = await User.findById(id);
res.status(200).json(successResponse(user));
// → { success: true, data: {...}, timestamp: '...' }

// Controller error response
res.status(404).json(errorResponse('User not found', 'USER_NOT_FOUND', { userId }));
// → { success: false, error: '...', code: '...', details: {...}, timestamp: '...' }

// List with pagination
const users = await User.find().limit(25).skip(0);
const total = await User.countDocuments();
res.status(200).json(listResponse(users, {
  page: 1,
  limit: 25,
  total,
  totalPages: Math.ceil(total / 25)
}));

// Creation response (HTTP 201)
const newUser = await User.create(data);
res.status(201).json(createResponse(newUser, 'User created successfully'));

// Update response
const updated = await User.findByIdAndUpdate(id, data, { new: true });
res.status(200).json(updateResponse(updated, 'User updated successfully'));

// Delete response
await User.findByIdAndDelete(id);
res.status(200).json(deleteResponse('User deleted successfully'));
```

**❌ WRONG:**
```typescript
// Inconsistent format
res.json({ user }); // ❌ No success flag, no timestamp

// No error code
res.status(404).json({ error: 'Not found' }); // ❌ Missing code, timestamp

// Direct data return
res.json(users); // ❌ No success wrapper
```

## Error Handling Middleware

**File:** `services/unified-backend/src/shared/middleware/errorHandler.ts`

### Centralized Error Handler

Catches ALL errors from controllers and formats them in standard ErrorResponse format.

```typescript
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = res.locals.requestId || 'unknown';

  // Log error with full context
  logger.error(`[${requestId}] Error: ${err.message}`, {
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params
  });

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const { message, code, details } = translateMongooseError(err);
    res.status(400).json({ success: false, error: message, code, details });
    return;
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    const { message, code, details } = translateCastError(err);
    res.status(400).json({ success: false, error: message, code, details });
    return;
  }

  // MongoDB Duplicate Key (code 11000)
  if (err.code === 11000 && err.keyPattern) {
    const { message, code, details } = translateDuplicateKeyError(err);
    res.status(409).json({ success: false, error: message, code, details });
    return;
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'Token non valido',
      code: 'TOKEN_INVALID',
      details: { reason: err.message }
    });
    return;
  }

  // Generic error fallback
  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = statusCode === 500
    ? 'Errore interno del server'
    : err.message || 'Errore sconosciuto';

  res.status(statusCode).json({ success: false, error: message, code });
}
```

### Mongoose Error Translation

```typescript
// Translate Mongoose ValidationError to Italian
export function translateMongooseError(err: ValidationError) {
  const details: Record<string, string> = {};

  Object.keys(err.errors).forEach(field => {
    const error = err.errors[field];
    if (error.kind === 'required') {
      details[field] = `Il campo ${field} è obbligatorio`;
    } else if (error.kind === 'unique') {
      details[field] = `${field} già in uso`;
    } else {
      details[field] = error.message;
    }
  });

  return {
    message: 'Errore di validazione',
    code: 'VALIDATION_ERROR',
    details
  };
}

// Translate CastError (invalid ObjectId)
export function translateCastError(err: CastError) {
  return {
    message: `Formato non valido per il campo ${err.path}`,
    code: 'INVALID_FORMAT',
    details: { field: err.path, value: err.value }
  };
}

// Translate MongoDB duplicate key error
export function translateDuplicateKeyError(err: any) {
  const field = Object.keys(err.keyPattern)[0];
  const value = err.keyValue[field];

  return {
    message: field === 'username' ? 'Username già in uso' : 'Valore già esistente',
    code: field === 'username' ? 'USERNAME_TAKEN' : 'DUPLICATE_KEY',
    details: { field, value }
  };
}
```

### Not Found Handler (404)

Mount BEFORE errorHandler in app.ts:

```typescript
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  res.status(404).json({
    success: false,
    error: `Endpoint non trovato: ${req.method} ${req.path}`,
    code: 'RESOURCE_NOT_FOUND',
    details: {
      method: req.method,
      path: req.path
    }
  });
}

// In app.ts
app.use(notFoundHandler);      // Mount BEFORE errorHandler
app.use(errorHandler);         // Mount LAST
```

## Request Validation (express-validator)

```typescript
import { body, param, query, validationResult } from 'express-validator';

// Validation chain example
export const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username richiesto'),
  body('password').notEmpty().withMessage('Password richiesta')
];

// Validation middleware
export function handleValidationErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details: Record<string, string> = {};
    errors.array().forEach(err => {
      details[err.param] = err.msg;
    });

    res.status(400).json({
      success: false,
      error: 'Errore di validazione',
      code: 'VALIDATION_ERROR',
      details
    });
    return;
  }
  next();
}

// Usage in route
router.post('/login', loginValidation, handleValidationErrors, AuthController.login);
```

## Health Check Endpoints

All services expose `/health` for monitoring and load balancer checks.

### Unified Backend Pattern

```typescript
// services/unified-backend/src/shared/routes/health.ts
import { Router } from 'express';
import mongoose from 'mongoose';
import { redis } from '@config/runtime/redis';

const router = Router();

router.get('/health', async (_req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  let redisStatus = 'disconnected';
  try {
    await redis.ping();
    redisStatus = 'connected';
  } catch (error) {
    logger.error('Redis health check failed', error);
  }

  const healthy = mongoStatus === 'connected' && redisStatus === 'connected';

  res.status(healthy ? 200 : 503).json({
    success: true,
    data: {
      status: healthy ? 'healthy' : 'unhealthy',
      mongodb: mongoStatus,
      redis: redisStatus,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    }
  });
});

export default router;
```

### API Gateway Pattern (Checks Backend Services)

```typescript
// services/api-gateway/src/app.ts
app.get('/health', async (_req, res) => {
  const healthChecks = {
    auth: `${BACKEND}/auth/health`,
    game: `${BACKEND}/game/health`,
    admin: `${BACKEND}/admin/health`
  };

  const servicesStatus: Record<string, any> = {};

  for (const [name, url] of Object.entries(healthChecks)) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        servicesStatus[name] = { status: 'healthy', url, data: json.data };
      } else {
        servicesStatus[name] = { status: 'unhealthy', url, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      servicesStatus[name] = { status: 'unreachable', url, error: (error as Error).message };
    }
  }

  const unhealthy = Object.values(servicesStatus).filter(s => s.status !== 'healthy').length;
  const overallStatus = unhealthy === 0 ? 'healthy' : 'degraded';

  res.json({
    success: true,
    data: {
      gateway: { service: 'API Gateway', status: overallStatus, uptime: process.uptime() },
      services: servicesStatus,
      summary: { healthy: Object.keys(servicesStatus).length - unhealthy, unhealthy }
    }
  });
});
```

## TypeScript Compilation with tsc

All services use TypeScript with `tsc` compiler (NOT esbuild, except for specific services with memory issues).

### tsconfig.json Pattern

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "baseUrl": "./src",
    "paths": {
      "@shared/*": ["shared/*"],
      "@modules/*": ["modules/*"],
      "@database/*": ["database/*"],
      "@config/*": ["config/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Module Aliases (Production)

In production, `module-alias` resolves TypeScript paths:

```typescript
// services/unified-backend/package.json
{
  "_moduleAliases": {
    "@shared": "dist/shared",
    "@modules": "dist/modules",
    "@database": "dist/database",
    "@config": "dist/config"
  }
}

// services/unified-backend/src/server.ts
if (process.env.NODE_ENV === 'production') {
  require('module-alias/register');
}
```

### Build Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js"
  }
}
```

**Exception:** embeddings-worker might use esbuild if tsc crashes with heap OOM (memory reference: 2026-03-04).

## Docker Multi-Stage Builds

Pattern used in all backend Dockerfiles:

```dockerfile
# Stage 1: Builder
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:24-alpine

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy production dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

USER nodejs

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

## Environment Variables Pattern

**CRITICAL:** Load dotenv BEFORE any imports to ensure environment variables are available.

```typescript
// ✅ CORRECT (ALWAYS at top of entry file)
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env'
});

// NOW safe to import config
import { config } from './config';
import { logger } from './utils/logger';

// ❌ WRONG (imports happen before dotenv loads)
import { config } from './config'; // ❌ config.env.* will be undefined!
require('dotenv').config();
```

### Bootstrap Pattern (PM2)

For PM2 deployments, use bootstrap.js to load dotenv before main script:

```javascript
// services/api-gateway/bootstrap.js
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env'
});
require('./dist/index.js');
```

```javascript
// ecosystem.config.js
{
  name: 'api-gateway',
  cwd: './services/api-gateway',
  script: 'bootstrap.js', // NOT dist/index.js directly
  env_production: { NODE_ENV: 'production' }
}
```

## Cross-References

- **Logger examples:** See api-gateway.md → Logging section
- **WebSocket res.status check:** See api-gateway.md → WebSocket Proxying
- **Module structure:** See unified-backend.md → Module Structure
- **Bull queue patterns:** See embeddings-worker.md → Bull Queue Configuration
- **SessionStore:** See unified-backend.md → SessionStore section

## Incidents & Lessons Learned

### Incident: console.log Cleanup (2026-03-03)
**Problem:** api-gateway mixed console.log and Winston logger, making production debugging difficult.

**Solution:** Replaced all console.log with logger.debug/info/warn/error. Standardized logging across services.

**Pattern:** NEVER use console.log. Always use Winston logger with appropriate level.

### Incident: LocationService _id Bug (2026-02-25)
**Problem:** LocationService returned `id` instead of `_id`, crashing frontend that expected `_id`.

**Root Cause:** Inconsistent field naming - project standard is `_id` across all schemas.

**Solution:** Fixed LocationService to use `_id`. Added missing `slug` and `settings` fields.

**Pattern:** ALWAYS use `_id` for MongoDB documents. Check project schemas before creating API responses.

### Lesson: esbuild-in-devDependencies pitfall (general pattern, no service currently affected)
**Problem (historical/generic):** Production deployment with `npm install --production` excludes devDependencies; if a build script imports esbuild from devDependencies, the build fails.

**Solution:** Move the build tool to production dependencies.

**Pattern:** Build tools used in deployment scripts MUST be in `dependencies`, not `devDependencies`. Today every service builds with `tsc`, so this isn't a live issue — keep the pattern in mind if a service switches build tool.

---

**Next:** See service-specific rule files (api-gateway.md, unified-backend.md, embeddings-worker.md) for detailed patterns.
