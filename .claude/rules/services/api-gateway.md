---
type: rules
category: backend
scope: api-gateway
criticality: high
last_updated: 2026-03-27
---

# API Gateway Service

Reverse proxy, rate limiting, CORS, WebSocket proxy, and external entry point for all backend services.

**Port:** 8000 (external access via Nginx)
**Deployment:** PM2 cluster mode (2 instances)
**Tech Stack:** Express 5.1, http-proxy-middleware, express-rate-limit, Morgan + Winston

## Responsibilities

1. **Reverse Proxy:** Forward HTTP requests to unified-backend (port 3001)
2. **WebSocket Proxy:** Upgrade and proxy Socket.IO connections
3. **Rate Limiting:** Per-route limits (unauth/auth thresholds)
4. **CORS:** Development CORS (production disabled, Nginx handles it)
5. **Security:** Helmet headers, compression, cookie parsing
6. **CDN:** Static file serving from `/cdn` path
7. **Logging:** Morgan HTTP access logs + Winston structured logs

## Architecture Pattern

```
[External Client]
    ↓
[Nginx :80] → [API Gateway :8000] → [Unified Backend :3001]
                    ↓
            [WebSocket Upgrade] → [Socket.IO Backend :3001]
```

**CRITICAL:** API Gateway does NOT implement business logic. It only proxies requests to unified-backend.

## Reverse Proxy Configuration

**File:** `services/api-gateway/src/app.ts`

### Service Targets

```typescript
const BACKEND = config.backend.url; // http://localhost:3001

const services: Record<string, ServiceConfig> = {
  auth:      { target: `${BACKEND}/auth`,      timeout: 30000 },
  game:      { target: `${BACKEND}/game`,      timeout: 30000 },
  forum:     { target: `${BACKEND}/forum`,     timeout: 30000 },
  documents: { target: `${BACKEND}/documents`, timeout: 60000 }, // Longer timeout for semantic search
  admin:     { target: `${BACKEND}/admin`,     timeout: 30000 },
  webhooks:  { target: `${BACKEND}/webhooks`,  timeout: 30000 }
};
```

### Proxy Factory

```typescript
import { createProxyMiddleware } from 'http-proxy-middleware';

function createServiceProxy(name: string, svc: ServiceConfig) {
  return createProxyMiddleware({
    target: svc.target,
    changeOrigin: true,
    timeout: svc.timeout,
    on: {
      proxyReq: (proxyReq: any, req: any) => {
        // Add gateway headers
        proxyReq.setHeader('X-Forwarded-By', 'TenPennyNovels-Gateway');
        proxyReq.setHeader('X-Service-Route', name);

        // Forward cookies and authorization
        if (req.headers.cookie) {
          proxyReq.setHeader('Cookie', req.headers.cookie);
        }
        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization);
        }
      },
      proxyRes: (proxyRes: any, _req: any, res: any) => {
        // Forward set-cookie from backend
        if (proxyRes.headers['set-cookie']) {
          res.setHeader('set-cookie', proxyRes.headers['set-cookie']);
        }
      },
      error: (err: any, _req: any, res: any) => {
        logger.error(`Errore proxy ${name}:`, { error: err.message, target: svc.target });

        // CRITICAL: Check if res.status exists (WebSocket upgrade case)
        if (!res.headersSent && typeof res.status === 'function') {
          res.status(502).json({
            success: false,
            error: `Servizio ${name} temporaneamente non disponibile`,
            code: 'SERVICE_UNAVAILABLE',
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  });
}
```

### Route Registration

```typescript
// Mount proxies (order matters - specific routes before wildcards)
app.use('/auth', createServiceProxy('auth', services.auth));
app.use('/game', createServiceProxy('game', services.game));
app.use('/forum', createServiceProxy('forum', services.forum));
app.use('/documents', createServiceProxy('documents', services.documents));
app.use('/admin', createServiceProxy('admin', services.admin));
app.use('/webhooks', webhookAuth, createServiceProxy('webhooks', services.webhooks));
```

### Proxy Best Practices

**✅ CORRECT:**
```typescript
// Set timeout appropriately
{ target: '...', timeout: 30000 } // 30s for REST APIs
{ target: '...', timeout: 60000 } // 60s for long-running operations (semantic search)

// Forward cookies and auth headers
proxyReq.setHeader('Cookie', req.headers.cookie);
proxyReq.setHeader('Authorization', req.headers.authorization);

// Forward set-cookie from backend
if (proxyRes.headers['set-cookie']) {
  res.setHeader('set-cookie', proxyRes.headers['set-cookie']);
}

// Check res.status before calling (WebSocket upgrade case)
if (!res.headersSent && typeof res.status === 'function') {
  res.status(502).json({ error: 'Service unavailable' });
}
```

**❌ WRONG:**
```typescript
// Too short timeout
{ timeout: 5000 } // ❌ May timeout legitimate requests

// Missing cookie forwarding
// ❌ Backend won't receive auth_token cookie

// Not forwarding set-cookie
// ❌ Client won't receive auth cookies from backend

// Calling res.status without check
res.status(502).json({ ... }); // ❌ Crashes on WebSocket upgrade
```

## WebSocket Proxying (Socket.IO)

**Memory reference:** 2026-03-03 - Fixed WebSocket error handler to check res.status before calling.

### WebSocket Upgrade Pattern

```typescript
// CRITICAL: WebSocket proxy MUST be mounted BEFORE HTTP route proxies
app.use(createProxyMiddleware({
  target: BACKEND,
  changeOrigin: true,
  ws: true, // Enable WebSocket upgrade
  timeout: config.proxy.socketTimeout, // 120s
  pathFilter: '/socket.io/**',
  on: {
    proxyReq: (proxyReq: any, req: any) => {
      if (req.headers.cookie) proxyReq.setHeader('Cookie', req.headers.cookie);
      proxyReq.setHeader('X-Forwarded-By', 'TenPennyNovels-Gateway');
      proxyReq.setHeader('X-Service-Route', 'socketio');
    },
    error: (err: any, _req: any, res: any) => {
      logger.error('Errore proxy Socket.IO:', { error: err.message });

      // CRITICAL: After WebSocket upgrade, res is a TCP socket, not HTTP Response
      // Check if res.status exists before calling
      if (!res.headersSent && typeof res.status === 'function') {
        res.status(502).json({
          success: false,
          error: 'Servizio WebSocket temporaneamente non disponibile',
          code: 'WEBSOCKET_UNAVAILABLE'
        });
      }
    }
  }
}));
```

### Why res.status Check is CRITICAL

**Before WebSocket upgrade:**
```typescript
// res is Express Response object
res.status(502).json({ ... }); // ✅ Works
```

**After WebSocket upgrade:**
```typescript
// res is TCP Socket (no .status() method)
res.status(502); // ❌ TypeError: res.status is not a function
```

**Solution:**
```typescript
// ✅ CORRECT - Check if method exists
if (!res.headersSent && typeof res.status === 'function') {
  res.status(502).json({ ... });
}
```

### WebSocket Proxy Order (CRITICAL)

```typescript
// ✅ CORRECT ORDER
app.use('/socket.io/**', socketioProxy); // WebSocket proxy FIRST
app.use('/auth', authProxy);             // HTTP proxies AFTER
app.use('/game', gameProxy);

// ❌ WRONG ORDER
app.use('/auth', authProxy);             // ❌ HTTP proxies intercept WebSocket upgrade
app.use('/socket.io/**', socketioProxy); // ❌ Too late, upgrade already failed
```

## Rate Limiting

**File:** `services/api-gateway/src/app.ts`

### Per-Route Limits

```typescript
import rateLimit from 'express-rate-limit';

// /documents - Dual limits (unauth + auth)
const documentsRateLimitUnauth = rateLimit({
  windowMs: 60000,        // 1 minute
  max: 30,                // 30 requests per minute (unauthenticated)
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !!req.cookies?.auth_token || shouldSkipDocumentsRateLimit(req),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Troppe richieste. Riprova più tardi.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    });
  }
});

const documentsRateLimitAuth = rateLimit({
  windowMs: 60000,
  max: 120,               // 120 requests per minute (authenticated)
  skip: (req) => !req.cookies?.auth_token || shouldSkipDocumentsRateLimit(req),
  keyGenerator: (req) => req.cookies?.auth_token || 'unknown',
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Troppe richieste. Riprova più tardi.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    });
  }
});

// /auth - Gateway-level fallback (60 req/min per IP)
const authRateLimitGateway = rateLimit({
  windowMs: 60000,
  max: 60,
  skip: () => !config.isProduction,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Troppe richieste. Riprova più tardi.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    });
  }
});

// /game - Gateway-level fallback (300 req/min per IP)
const gameRateLimitGateway = rateLimit({
  windowMs: 60000,
  max: 300,
  skip: () => !config.isProduction,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Troppe richieste. Riprova più tardi.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    });
  }
});
```

### ISR Build Bypass Secret

Allows Next.js ISR builds to bypass rate limits (parallel requests during build).

```typescript
function shouldSkipDocumentsRateLimit(req: Request): boolean {
  if (config.rateLimit.documents.disabled) return true;
  if (!config.isProduction) return true;
  if (!config.rateLimit.documents.buildBypassSecret) return false;

  return req.get('x-tenpenny-documents-build') === config.rateLimit.documents.buildBypassSecret;
}

// Environment variable
DOCUMENTS_BUILD_BYPASS_SECRET=your-secret-token

// Next.js ISR request
fetch('/documents/api/routes', {
  headers: {
    'x-tenpenny-documents-build': process.env.DOCUMENTS_BUILD_BYPASS_SECRET
  }
});
```

### Rate Limit Mounting Order

```typescript
// Rate limits MUST be mounted BEFORE proxy middleware
app.use('/documents', documentsRateLimitUnauth, documentsRateLimitAuth);
app.use('/auth', authRateLimitGateway);
app.use('/game', gameRateLimitGateway);

// Now mount proxies
app.use('/documents', createServiceProxy('documents', services.documents));
app.use('/auth', createServiceProxy('auth', services.auth));
app.use('/game', createServiceProxy('game', services.game));
```

### Rate Limit Best Practices

**✅ CORRECT:**
```typescript
// Dual limits for auth/unauth
skip: (req) => !!req.cookies?.auth_token // Unauth limiter skips authenticated
skip: (req) => !req.cookies?.auth_token // Auth limiter skips unauthenticated

// Use auth token as key (not IP) for authenticated requests
keyGenerator: (req) => req.cookies?.auth_token || 'unknown'

// Disable in development
skip: () => !config.isProduction

// ISR bypass secret for build-time requests
if (req.get('x-tenpenny-documents-build') === buildBypassSecret) return true;
```

**❌ WRONG:**
```typescript
// Single limit for all users
max: 30 // ❌ Authenticated users should have higher limit

// IP-based key for authenticated requests
keyGenerator: (req) => req.ip // ❌ Multiple tabs = shared limit

// Enabled in development
// ❌ Slows down development

// No ISR bypass
// ❌ Next.js build will hit rate limits
```

## CORS Configuration

**Development:** Permissive CORS (allowed origins list)
**Production:** CORS disabled (Nginx handles it)

```typescript
import cors from 'cors';

app.use(cors({
  origin(origin, callback) {
    // No origin = same-origin request (allowed)
    if (!origin) return callback(null, true);

    if (config.cors.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`[CORS] Origine bloccata: ${origin}`);
      callback(new Error(`Origine ${origin} non consentita dal CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cookie',
    'X-Requested-With',
    'X-Session-Id',
    'X-Tenpenny-Documents-Build'
  ],
  optionsSuccessStatus: 200
}));

// CDN uses separate CORS (no credentials, public GET)
app.use('/cdn', cors({
  origin: config.cdn.allowedOrigins,
  credentials: false,
  methods: ['GET', 'HEAD']
}), express.static(config.cdn.storagePath));
```

### CORS Best Practices

**✅ CORRECT:**
```typescript
// Validate origin against whitelist
if (config.cors.allowedOrigins.includes(origin)) { ... }

// Enable credentials for cookies
credentials: true

// Log blocked origins for debugging
logger.warn(`[CORS] Origine bloccata: ${origin}`);

// Production: disable CORS (Nginx handles it)
if (config.isProduction) {
  // CORS disabled, Nginx adds headers
}
```

**❌ WRONG:**
```typescript
// Allow all origins
origin: '*' // ❌ Security risk

// No credentials
credentials: false // ❌ Cookies won't be sent

// Missing X-Session-Id header
allowedHeaders: ['Content-Type'] // ❌ Character sessions break
```

## Security Headers (Helmet)

```typescript
import helmet from 'helmet';

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // Allow CDN images
}));
```

## Logging (Morgan + Winston)

**HTTP Access Logs:** Morgan → Winston stream
**Application Logs:** Winston structured logs

```typescript
import morgan from 'morgan';
import { httpLoggerStream, logger } from './utils/logger';

// HTTP access logs (all requests)
app.use(morgan('combined', { stream: httpLoggerStream }));

// Application logs
logger.info('API Gateway started', { port: 8000 });
logger.warn('[CORS] Origine bloccata', { origin });
logger.error('Errore proxy auth', { error: err.message, target });
logger.debug('[AUTH] GET /auth/me'); // Dev only
```

### Morgan Format

```typescript
// services/api-gateway/src/utils/logger.ts
export const httpLoggerStream = {
  write: (message: string) => {
    logger.info(message.trim()); // Morgan logs go to Winston
  }
};

// Log format: combined
// ::1 - - [27/Mar/2026:10:30:45 +0000] "GET /auth/me HTTP/1.1" 200 1234
```

### Debug Middleware (Development)

```typescript
if (!config.isProduction) {
  const debugRoutes = ['/auth', '/game', '/forum', '/documents', '/admin'];
  for (const route of debugRoutes) {
    app.use(route, (req, _res, next) => {
      logger.debug(`[${route.slice(1).toUpperCase()}] ${req.method} ${req.originalUrl}`);
      next();
    });
  }
}
```

## CDN Static File Serving

```typescript
app.use('/cdn', cors({
  origin: config.cdn.allowedOrigins,
  credentials: false,
  methods: ['GET', 'HEAD']
}), express.static(config.cdn.storagePath, {
  maxAge: config.cdn.maxAge,        // 1 year (immutable assets)
  immutable: config.cdn.immutable,  // Cache-Control: immutable
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Development: disable cache
    if (!config.isProduction) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));
```

## Health Check Endpoint

```typescript
app.get('/health', async (_req, res) => {
  const healthChecks: Record<string, string> = {
    auth: `${services.auth.target}/health`,
    game: `${services.game.target}/health`,
    admin: `${services.admin.target}/health`
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
      logger.warn(`Health check ${name} fallito:`, { error: (error as Error).message });
    }
  }

  const unhealthy = Object.values(servicesStatus).filter(s => s.status !== 'healthy').length;
  const overallStatus = unhealthy === 0 ? 'healthy' : unhealthy < Object.keys(servicesStatus).length ? 'degraded' : 'unhealthy';

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

## Webhook Authentication

Webhooks use Bearer token (not cookies) for internal service callbacks.

```typescript
app.use('/webhooks', (req, res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

  if (!config.webhooks.secret || token !== config.webhooks.secret) {
    logger.warn(`[WEBHOOKS] Accesso non autorizzato: ${req.method} ${req.originalUrl} da ${req.ip}`);
    res.status(401).json({
      result: false,
      error: 'Non autorizzato',
      code: 'INVALID_WEBHOOK_SECRET'
    });
    return;
  }

  next();
}, createServiceProxy('webhooks', services.webhooks));
```

## Timeout Configuration

**Memory reference:** 2026-03-03 - Increased REST proxy timeout from 10s to 30s for better resilience.

```typescript
const services = {
  auth:      { timeout: 30000 }, // 30s (default)
  game:      { timeout: 30000 },
  forum:     { timeout: 30000 },
  documents: { timeout: 60000 }, // 60s (semantic search is slow)
  admin:     { timeout: 30000 },
  webhooks:  { timeout: 30000 }
};

const socketTimeout = 120000; // 120s (WebSocket)
```

### Why Longer Timeouts?

- Semantic search: ~500ms embedding + Qdrant ANN search
- Document tree queries: Multiple MongoDB lookups
- WebSocket connections: Long-lived, need high timeout

## Trust Proxy (Load Balancer)

```typescript
if (config.trustProxy) {
  app.set('trust proxy', 1); // Trust first proxy (Nginx)
}

// Enables correct IP detection in req.ip
// Required for rate limiting by IP
```

## Special Middleware

### Accept-Encoding Removal (SSE)

Semantic search uses Server-Sent Events (SSE) which breaks with gzip compression.

```typescript
app.use('/documents', (req, _res, next) => {
  if (req.url.includes('semantic-search')) {
    delete req.headers['accept-encoding']; // Prevent gzip on SSE
  }
  next();
});
```

## Error Handlers

```typescript
// 404 handler
app.use((req, res) => {
  logger.warn('Rotta non trovata', {
    url: req.originalUrl,
    method: req.method,
    origin: req.get('Origin'),
    ip: req.ip
  });

  res.status(404).json({
    success: false,
    error: 'Rotta API Gateway non trovata',
    code: 'ROUTE_NOT_FOUND',
    requested_url: req.originalUrl,
    method: req.method,
    available_prefixes: ['/auth', '/game', '/forum', '/admin', '/documents', '/cdn', '/socket.io'],
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Errore non gestito nel gateway:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  res.status(500).json({
    success: false,
    error: config.isProduction ? 'Errore interno del gateway' : error.message,
    code: 'INTERNAL_GATEWAY_ERROR',
    timestamp: new Date().toISOString()
  });
});
```

## Cross-References

- **Winston logger:** See shared-backend.md → Winston Logger
- **WebSocket handlers:** See unified-backend.md → WebSocket Handlers
- **Error responses:** See shared-backend.md → API Response Format

## Incidents & Lessons Learned

### Incident: WebSocket res.status Crash (2026-03-03)
**Problem:** WebSocket proxy error handler called `res.status(502)` but after upgrade, `res` is a TCP socket without `.status()` method.

**Root Cause:** During WebSocket upgrade, Express Response object is replaced with TCP socket. Socket doesn't have HTTP methods like `.status()`.

**Solution:** Added `typeof res.status === 'function'` check before calling.

**Pattern:** Always check if response object has HTTP methods before using them in WebSocket error handlers.

```typescript
// ✅ CORRECT
if (!res.headersSent && typeof res.status === 'function') {
  res.status(502).json({ error: 'WebSocket unavailable' });
}

// ❌ WRONG (crashes after upgrade)
res.status(502).json({ error: 'WebSocket unavailable' });
```

### Incident: console.log Cleanup (2026-03-03)
**Problem:** api-gateway mixed console.log and Winston logger. Production debugging was difficult (no timestamps, no file logging).

**Solution:** Replaced all console.log with logger.debug/info/warn/error. Standardized logging across services.

**Changed files:**
- CORS: `logger.debug()` / `logger.warn()`
- Proxy callbacks: `logger.debug()`
- HTTP access logs: morgan (standard format)
- Errors: `logger.error()` with context

**Pattern:** NEVER use console.log. Always use Winston logger with appropriate level.

### Incident: Timeout Too Short (2026-03-03)
**Problem:** 10s timeout caused legitimate requests to fail (semantic search, complex queries).

**Solution:** Increased to 30s for REST proxies, 60s for documents (semantic search), 120s for WebSocket.

**Pattern:** Set timeouts based on expected operation duration. Semantic search = ~500ms + network overhead. Allow 60s margin.

---

**Next:** See unified-backend.md for business logic patterns, embeddings-worker.md for Bull queue patterns.
