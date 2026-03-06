# API Gateway

**Navigation**: [Home](../INDEX.md) > [Backend](./README.md) > API Gateway

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-01

Documentazione completa dell'API Gateway di TenPennyNovels - single entry point per tutti i backend services.

---

## Overview

L'API Gateway è il **punto di ingresso unico** per tutte le richieste HTTP/WebSocket al backend di TenPennyNovels. Implementa proxy routing, CORS handling, rate limiting e WebSocket upgrade.

**Key Features**:
- ✅ **Single Entry Point**: Un solo endpoint pubblico (port 8000)
- ✅ **Service Routing**: Proxy intelligente verso unified-backend
- ✅ **CORS Management**: Whitelist frontend origins
- ✅ **Rate Limiting**: Tiered limits (auth vs unauth)
- ✅ **WebSocket Upgrade**: Socket.IO proxy con ws: true
- ✅ **Health Aggregation**: Status check di tutti backend services
- ✅ **Error Handling**: 502 response se backend unavailable
- ✅ **Request Logging**: Detailed logging per debugging

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Internet (HTTPS)                       │
│                           ↓                                 │
│              Nginx Reverse Proxy (SSL/TLS)                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   API Gateway (Port 8000)                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ CORS Middleware - Validate origin                     │  │
│  │ Rate Limiting - 30/120 req/min                        │  │
│  │ Request Logging - Morgan + Winston                    │  │
│  │ Body Parsing - JSON/URL-encoded (non-proxied only)    │  │
│  └───────────────────────────────────────────────────────┘  │
│                           ↓                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          Proxy Routes (http-proxy-middleware)         │  │
│  │  /socket.io/** → ws: true (WebSocket upgrade)         │  │
│  │  /auth/*      → http://unified-backend:3001/auth/*    │  │
│  │  /game/*      → http://unified-backend:3001/game/*    │  │
│  │  /admin/*     → http://unified-backend:3001/admin/*   │  │
│  │  /forum/*     → http://unified-backend:3001/forum/*   │  │
│  │  /documents/* → http://unified-backend:3001/game/...  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│             Unified Backend (Port 3001)                     │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐  │
│  │   auth   │   game   │  admin   │  forum   │documents │  │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Service Configuration

### Backend Services Map

```typescript
const UNIFIED_BACKEND = process.env.UNIFIED_BACKEND_URL || 'http://localhost:3001';

const services = {
  auth: {
    target: 'http://unified-backend:3001/auth',
    backend: 'unified-backend',
    port: 3001
  },
  game: {
    target: 'http://unified-backend:3001/game',
    backend: 'unified-backend',
    port: 3001
  },
  admin: {
    target: 'http://unified-backend:3001/admin',
    backend: 'unified-backend',
    port: 3001
  },
  documents: {
    target: 'http://unified-backend:3001/game/documents',
    backend: 'unified-backend',
    port: 3001
  },
  forum: {
    target: 'http://unified-backend:3001/forum',
    backend: 'unified-backend',
    port: 3001
  },
  socketio: {
    target: 'http://unified-backend:3001',  // No path prefix for WebSocket
    backend: 'unified-backend',
    port: 3001
  }
};
```

**Why Target Includes Mount Path?**

http-proxy-middleware v3 RICHIEDE mount path in target URL:

```typescript
// ❌ WRONG - Backend won't match routes
app.use('/auth', createProxyMiddleware({
  target: 'http://unified-backend:3001',  // Backend expects /auth prefix!
  changeOrigin: true
}));

// ✅ CORRECT - Mount path in target
app.use('/auth', createProxyMiddleware({
  target: 'http://unified-backend:3001/auth',  // Matches backend router
  changeOrigin: true
}));
```

**Backend Routing**:
```typescript
// Unified backend expects prefix
app.use('/auth', authRoutes);      // app.use('/auth', ...) in unified-backend
app.use('/game', gameRoutes);      // app.use('/game', ...) in unified-backend
app.use('/admin', adminRoutes);    // app.use('/admin', ...) in unified-backend
```

**Gateway preserva prefix** quando proxying → target deve matchare.

---

## Proxy Routes

### Authentication Routes

**Mount**: `/auth/*`
**Target**: `http://unified-backend:3001/auth/*`

**Endpoints**:
```
POST   /auth/register           - User registration
POST   /auth/login              - User login
POST   /auth/logout             - User logout
POST   /auth/refresh-token      - Refresh JWT
POST   /auth/forgot-password    - Request password reset
POST   /auth/reset-password/:token - Reset password
GET    /auth/verify-email/:token - Verify email (landing link: /?token=xxx)
DELETE /auth/delete-account/:token - Delete account
POST   /auth/character-select   - Character context token
```

---

### Game Routes

**Mount**: `/game/*`
**Target**: `http://unified-backend:3001/game/*`

**Endpoints**:
```
# Characters
GET    /game/characters              - List characters
POST   /game/characters              - Create character
GET    /game/characters/:id          - Get character
PATCH  /game/characters/:id          - Update character
DELETE /game/characters/:id          - Delete character
POST   /game/characters/:id/avatar   - Upload avatar

# Locations
GET    /game/locations/accessible    - Get accessible locations
POST   /game/locations/join          - Join location
POST   /game/locations/leave         - Leave location

# Housing
GET    /game/housing/available       - List available properties
POST   /game/housing/rent            - Rent property
POST   /game/housing/purchase        - Purchase property
POST   /game/housing/pay-rent        - Pay rent

# Messaging
GET    /game/messages                - List messages
POST   /game/messages                - Send message
GET    /game/messages/:threadId      - Get thread

# Documents (via /documents/* also)
GET    /game/documents               - List documents
GET    /game/documents/:slug         - Get document
POST   /game/documents/search        - Semantic search
```

---

### Admin Routes

**Mount**: `/admin/*`
**Target**: `http://unified-backend:3001/admin/*`

**Endpoints**:
```
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
```

---

### Forum Routes

**Mount**: `/forum/*`
**Target**: `http://unified-backend:3001/forum/*`

**Endpoints**:
```
GET    /forum/posts                  - List forum posts
POST   /forum/posts                  - Create post
GET    /forum/posts/:id              - Get post
PATCH  /forum/posts/:id              - Update post
DELETE /forum/posts/:id              - Delete post
```

---

### Documents Routes (Dual Mount)

**Mount 1**: `/documents/*` → `http://unified-backend:3001/game/documents/*`
**Mount 2**: `/docs/*` → `http://unified-backend:3001/game/documents/*`

**Why Two Mounts?**
- `/documents/*` - Semantic clarity
- `/docs/*` - Brevity convenience

**Endpoints**:
```
GET    /documents                    - List documents
GET    /documents/:slug              - Get document by slug
POST   /documents/search             - Semantic search (Qdrant)
GET    /documents/favorites          - User favorites
POST   /documents/:slug/favorite     - Toggle favorite
```

---

### WebSocket Routes (Socket.IO)

**Mount**: `/socket.io/**` (global middleware, NO app.use mount)
**Target**: `http://unified-backend:3001`
**WebSocket**: `ws: true` enabled

**Configuration**:
```typescript
const socketioProxy = createProxyMiddleware({
  target: 'http://unified-backend:3001',
  changeOrigin: true,
  ws: true,  // ✅ CRITICAL - Enable WebSocket upgrade
  timeout: 60000,  // 60s for long polling
  pathFilter: '/socket.io/**',  // Only proxy /socket.io paths
  on: {
    proxyReq: (proxyReq, req, res) => {
      // Forward cookies for Socket.IO authentication
      if (req.headers.cookie) {
        proxyReq.setHeader('Cookie', req.headers.cookie);
      }
    }
  }
});

// Apply globally (not mounted to preserve /socket.io prefix)
app.use(socketioProxy);
```

**Why No Mount Path?**
- Socket.IO handshake expects `/socket.io/` prefix
- Mounting at `/socket.io` would create `/socket.io/socket.io/` double prefix
- Global middleware with `pathFilter` preserves correct path

**Details**: [WebSocket Patterns](../05-frontend/websocket-patterns.md)

---

## CORS Configuration

### Origin Whitelist

```typescript
const allowedOrigins = [
  // Production
  process.env.LANDING_URL || 'https://tenpennynovels.com',
  process.env.GAME_URL || 'https://game.tenpennynovels.com',
  process.env.DOCUMENTS_URL || 'https://documenti.tenpennynovels.com',
  process.env.MANAGEMENT_URL || 'https://gestione.tenpennynovels.com',

  // Development localhost
  'http://localhost:4000',
  'http://localhost:4001',
  'http://localhost:4002',
  'http://localhost:4003',
  'http://localhost:4004',
  'http://localhost:4005'
];
```

---

### Dynamic Origin Validation

```typescript
app.use(cors({
  origin: function (origin, callback) {
    console.log(`🔄 CORS: Received origin: "${origin}"`);

    // Allow requests with no origin (mobile apps, curl)
    if (!origin) {
      console.log(`✅ CORS: No origin header - allowing request`);
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.includes(origin);
    console.log(`🔍 CORS: Origin "${origin}" allowed: ${isAllowed}`);

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`❌ CORS: Blocking origin ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,  // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With']
}));
```

---

### CORS Troubleshooting

**Symptom**: `CORS policy: No 'Access-Control-Allow-Origin' header`

**Debug**:
```bash
# Check logs
docker compose logs api-gateway | grep CORS

# Example output
🔄 CORS: Received origin: "http://localhost:4001"
🔍 CORS: Origin "http://localhost:4001" allowed: true
✅ CORS: Allowing origin http://localhost:4001
```

**Solution**: Add origin to `allowedOrigins` array

---

## Rate Limiting

### Tiered Limits

**Unauthenticated Users**:
- **Limit**: 30 requests per minute per IP
- **Key**: IP address
- **Applied to**: `/documents/*`, `/docs/*`

**Authenticated Users**:
- **Limit**: 120 requests per minute per user
- **Key**: `auth_token` cookie
- **Applied to**: `/documents/*`, `/docs/*`

---

### Implementation

```typescript
// Unauthenticated rate limiter
const documentsRateLimitUnauth = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 30,
  skip: (req) => !!req.cookies?.auth_token,  // Skip if authenticated
  keyGenerator: (req) => req.ip || 'unknown',
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60
    });
  }
});

// Authenticated rate limiter
const documentsRateLimitAuth = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  skip: (req) => !req.cookies?.auth_token,  // Only for authenticated
  keyGenerator: (req) => req.cookies?.auth_token || 'unknown'
});

// Apply to routes
app.use('/documents', documentsRateLimitUnauth, documentsRateLimitAuth);
app.use('/docs', documentsRateLimitUnauth, documentsRateLimitAuth);
```

---

### Rate Limit Headers

```http
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 30
RateLimit-Remaining: 0
RateLimit-Reset: 1234567890
Retry-After: 60

{
  "success": false,
  "error": "Too many requests. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

---

## Request Logging

### Morgan HTTP Logging

```typescript
app.use(morgan('combined', {
  stream: httpLoggerStream  // Winston logger stream
}));
```

**Format**: Apache Combined Log Format
```
:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"
```

**Example**:
```
192.168.1.1 - - [01/Mar/2026:10:00:00 +0000] "GET /game/characters HTTP/1.1" 200 1234 "http://localhost:4001" "Mozilla/5.0..."
```

---

### Custom Proxy Logging

```typescript
createProxyMiddleware({
  target: config.target,
  on: {
    proxyReq: (proxyReq, req, res) => {
      console.log(`🔄 [PROXY REQ] Forwarding to ${serviceName}: ${req.method} ${req.url}`);

      if (req.headers.cookie) {
        console.log(`   🍪 Forwarding cookies: ${req.headers.cookie.substring(0, 100)}...`);
      }
      if (req.headers.authorization) {
        console.log(`   🔑 Forwarding authorization header`);
      }
    },
    proxyRes: (proxyRes, req, res) => {
      console.log(`🔙 [PROXY RES] Response from ${serviceName}: ${proxyRes.statusCode}`);

      if (proxyRes.headers['set-cookie']) {
        console.log(`   🍪 Forwarding set-cookie headers back to client`);
      }
    },
    error: (err, req, res) => {
      console.log(`❌ [PROXY ERROR] Service: ${serviceName}`);
      console.log(`   🔗 Target: ${config.target}`);
      console.log(`   📍 URL: ${req.url}`);
      console.log(`   💥 Error: ${err.message}`);
    }
  }
});
```

---

## Health Checks

### Gateway Health

```http
GET /health
```

**Response**:
```json
{
  "success": true,
  "data": {
    "gateway": {
      "service": "TenPennyNovels API Gateway",
      "version": "1.0.0",
      "status": "healthy",
      "timestamp": "2026-03-01T10:00:00.000Z",
      "uptime": 12345.67,
      "memory": {
        "rss": 50000000,
        "heapTotal": 30000000,
        "heapUsed": 20000000
      },
      "environment": "production"
    },
    "services": {
      "auth": {
        "status": "healthy",
        "url": "http://unified-backend:3001/auth/health",
        "data": { ... }
      },
      "game": {
        "status": "healthy",
        "url": "http://unified-backend:3001/game/health",
        "data": { ... }
      },
      "admin": {
        "status": "healthy",
        "url": "http://unified-backend:3001/admin/health",
        "data": { ... }
      }
    },
    "summary": {
      "total_services": 4,
      "healthy_services": 4,
      "unhealthy_services": 0,
      "overall_status": "healthy"
    }
  }
}
```

---

### Service Status

**Possible Statuses**:
- `healthy` - Service responding with 200 OK
- `unhealthy` - Service responding with non-200
- `unreachable` - Service timeout or connection refused

**Overall Status**:
- `healthy` - All services healthy
- `degraded` - Some services unhealthy
- `unhealthy` - All services unhealthy

---

## Error Handling

### Service Unavailable (502)

```typescript
on: {
  error: (err, req, res) => {
    logger.error(`Proxy error for ${serviceName}:`, {
      error: err.message,
      url: req.url,
      target: config.target
    });

    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        error: `Service ${serviceName} is temporarily unavailable`,
        code: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    }
  }
}
```

---

### Route Not Found (404)

```typescript
app.use((req, res) => {
  console.log('\n❌ ===== 404 - ROUTE NOT FOUND =====');
  console.log(`🔗 URL: ${req.originalUrl}`);
  console.log(`📡 Method: ${req.method}`);
  console.log(`🌐 Origin: ${req.get('Origin') || 'No origin'}`);

  res.status(404).json({
    success: false,
    error: 'API Gateway route not found',
    code: 'ROUTE_NOT_FOUND',
    requested_url: req.originalUrl,
    method: req.method,
    available_prefixes: ['/auth', '/game', '/forum', '/admin', '/docs', '/documents'],
    timestamp: new Date().toISOString()
  });
});
```

---

### Internal Gateway Error (500)

```typescript
app.use((error, req, res, next) => {
  logger.error('Unhandled error in API Gateway:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Internal gateway error'
      : error.message,
    code: 'INTERNAL_GATEWAY_ERROR',
    timestamp: new Date().toISOString()
  });
});
```

---

## Cookie & Auth Forwarding

### Request Cookies

```typescript
on: {
  proxyReq: (proxyReq, req, res) => {
    // Forward cookies to backend
    if (req.headers.cookie) {
      proxyReq.setHeader('Cookie', req.headers.cookie);
    }

    // Forward authorization header
    if (req.headers.authorization) {
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }

    // Add gateway headers
    proxyReq.setHeader('X-Forwarded-By', 'TenPennyNovels-Gateway');
    proxyReq.setHeader('X-Service-Route', serviceName);
  }
}
```

---

### Response Cookies

```typescript
on: {
  proxyRes: (proxyRes, req, res) => {
    // Forward set-cookie headers back to client
    if (proxyRes.headers['set-cookie']) {
      res.setHeader('set-cookie', proxyRes.headers['set-cookie']);
    }
  }
}
```

**Why Needed?**
- Backend sets JWT tokens in cookies (`auth_token`, `refresh_token`, `character_context`)
- Gateway must forward Set-Cookie headers to client
- Client must send Cookie header in subsequent requests

---

## Security Middleware

### Helmet.js

```typescript
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
```

**Headers Added**:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000` (production)

---

### Compression

```typescript
app.use(compression());
```

**Compression**: gzip/deflate for responses > 1KB

---

### Trust Proxy

```typescript
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}
```

**Why?** Nginx reverse proxy → API Gateway needs to trust X-Forwarded-* headers for real IP.

---

## Deployment

### Docker Configuration

```yaml
# docker-compose.yml
api-gateway:
  build:
    context: ./services/api-gateway
    dockerfile: Dockerfile
  container_name: tenpennynovels-api-gateway
  restart: unless-stopped
  environment:
    NODE_ENV: production
    PORT: 8000
    UNIFIED_BACKEND_URL: http://unified-backend:3001
    GAME_URL: ${GAME_URL}
    LANDING_URL: ${LANDING_URL}
    TRUST_PROXY: "true"
  ports:
    - "8000:8000"
  networks:
    - tenpennynovels-network
  depends_on:
    unified-backend:
      condition: service_healthy
```

---

### Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/api.tenpennynovels.com

upstream api_backend {
  server localhost:8000;
}

server {
  listen 80;
  server_name api.tenpennynovels.com;

  # Redirect HTTP to HTTPS
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name api.tenpennynovels.com;

  # SSL certificates
  ssl_certificate /etc/letsencrypt/live/api.tenpennynovels.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.tenpennynovels.com/privkey.pem;

  # Proxy to API Gateway
  location / {
    proxy_pass http://api_backend;
    proxy_http_version 1.1;

    # WebSocket support
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }
}
```

---

## Troubleshooting

### CORS Error

**Symptom**: `No 'Access-Control-Allow-Origin' header`

**Check**:
```bash
# View CORS logs
docker compose logs api-gateway | grep CORS
```

**Solution**: Add origin to whitelist in `app.ts`

---

### 502 Bad Gateway

**Symptom**: `Service temporarily unavailable`

**Check**:
```bash
# Check backend health
curl http://localhost:3001/health

# View gateway logs
docker compose logs api-gateway
```

**Common Causes**:
- Backend service down
- Backend port mismatch
- Network connectivity issue

---

### WebSocket Connection Failed

**Symptom**: `WebSocket connection to 'ws://localhost:8000/socket.io/' failed`

**Check**:
```bash
# Test WebSocket upgrade
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:8000/socket.io/
```

**Expected**: `HTTP/1.1 101 Switching Protocols`

**Solution**: Verify `ws: true` in Socket.IO proxy config

---

## Related Documentation

- [Unified Backend](./unified-backend-architecture.md) - Backend modules
- [WebSocket Patterns](../05-frontend/websocket-patterns.md) - Socket.IO usage
- [Docker Compose](../01-infrastructure/docker-compose.md) - Service configuration
- [Environment Variables](../01-infrastructure/environment-variables.md) - Configuration
- [Deployment Guide](../06-operations/deployment-guide.md) - Production setup

---

## Quick Reference

**Entry Point**: `http://localhost:8000` (development) | `https://api.tenpennynovels.com` (production)
**Health Check**: `GET /health`
**CORS**: Whitelist in `allowedOrigins` array
**Rate Limits**: 30 req/min (unauth), 120 req/min (auth)
**WebSocket**: `/socket.io/**` with `ws: true`
**Logging**: Morgan + Winston
