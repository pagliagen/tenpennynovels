import 'module-alias/register';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { httpLoggerStream, logger } from './utils/logger';

console.log('🔧 Loading environment variables...');
// Load environment variables: first global, then service-specific overrides
console.log('📁 Loading global .env from project root...');
dotenv.config({ path: '../../.env' });
console.log('📁 Loading service-specific .env (if exists)...');
dotenv.config({ override: true }); // This will override with local .env if it exists
console.log('✅ Environment variables loaded');
console.log('🔍 Key URLs:', {
  GAME_URL: process.env.GAME_URL,
  AUTH_BACKEND_URL: process.env.AUTH_BACKEND_URL,
  GAME_BACKEND_URL: process.env.GAME_BACKEND_URL
});

console.log('📦 Setting up API Gateway...');
const app = express();
const PORT = process.env.PORT || 8000;
console.log(`🎯 Starting API Gateway on port ${PORT}...`);

// Trust proxy configuration - needed for proper IP detection behind reverse proxy
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ========== CDN STATIC FILE SERVING ==========
// Defined BEFORE global CORS to avoid credentials conflict
const CDN_ALLOWED_ORIGINS = [
  process.env.GAME_URL || 'https://game.tenpennynovels.com',
  process.env.MANAGEMENT_URL || 'https://gestione.tenpennynovels.com',
];

const isDev = process.env.NODE_ENV !== 'production';
const cdnStoragePath = process.env.CDN_STORAGE_PATH || '/cdn-storage';

app.use('/cdn', cors({
  origin: CDN_ALLOWED_ORIGINS,
  credentials: false,
  methods: ['GET', 'HEAD'],
}), express.static(cdnStoragePath, {
  maxAge: isDev ? '0' : '365d',
  immutable: !isDev,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (isDev) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));
console.log(`✅ CDN static file serving configured (/cdn → ${cdnStoragePath})`);

// CORS configuration for API Gateway - Enhanced with explicit origin handling
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.LANDING_URL || 'https://tenpennynovels.com',
      process.env.GAME_URL || 'https://game.tenpennynovels.com',
      process.env.DOCUMENTS_URL || 'https://documenti.tenpennynovels.com',
      process.env.MANAGEMENT_URL || 'https://gestione.tenpennynovels.com',
      // Development localhost URLs (in addition to IP-based URLs from env)
      'http://localhost:4000',
      'http://localhost:4001',
      'http://localhost:4002',
      'http://localhost:4003',
      'http://localhost:4004',
      'http://localhost:4005'
    ];

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      logger.debug('[CORS] No origin header - allowing request');
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.includes(origin);

    if (isAllowed) {
      logger.debug(`[CORS] Allowing origin: ${origin}`);
      callback(null, true);
    } else {
      logger.warn(`[CORS] Blocking origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
  optionsSuccessStatus: 200 // For legacy browser support
}));
 
// General middleware
app.use(compression() as any);
app.use(cookieParser() as any);

// Note: express.json() and urlencoded() are moved after proxy setup
// to avoid consuming request body before proxying

// Request logging
app.use(morgan('combined', {
  stream: httpLoggerStream
}));

// ========== RATE LIMITING CONFIGURATION ==========
// Different rate limits for authenticated vs unauthenticated users
// Applied specifically to /documents/* routes

/**
 * Rate limiter for UNAUTHENTICATED users accessing documents
 * Limit: 30 requests per minute per IP address
 */
const documentsRateLimitUnauth = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 60
  },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  skip: (req) => {
    // Skip rate limiting if user is authenticated (has auth_token cookie)
    return !!req.cookies?.auth_token;
  },
  keyGenerator: (req) => {
    // Use IP address as key for unauthenticated users
    return req.ip || req.socket?.remoteAddress || 'unknown';
  },
  handler: (req, res) => {
    logger.warn('[Rate Limit] Unauthenticated user exceeded limit', {
      ip: req.ip,
      url: req.originalUrl
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Rate limiter for AUTHENTICATED users accessing documents
 * Limit: 120 requests per minute per user
 */
const documentsRateLimitAuth = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only apply to authenticated users (has auth_token cookie)
    return !req.cookies?.auth_token;
  },
  keyGenerator: (req) => {
    // Use auth_token as key for authenticated users
    return req.cookies?.auth_token || 'unknown';
  },
  handler: (req, res) => {
    logger.warn('[Rate Limit] Authenticated user exceeded limit', {
      ip: req.ip,
      url: req.originalUrl
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    });
  }
});

console.log('🛡️ Rate limiting configured:');
console.log('   📄 /documents/* - Unauthenticated: 30 req/min per IP');
console.log('   📄 /documents/* - Authenticated: 120 req/min per user');

// ✅ SPRINT 4: API Gateway Configuration Cleanup
// Backend service configurations with validation and clear documentation

/**
 * Helper: Build proxy target URL with validation
 *
 * http-proxy-middleware v3 REQUIRES mount path in target URL:
 * - Gateway mount: /auth
 * - Backend expects: /auth prefix (app.use('/auth', routes))
 * - Target must be: http://backend:3000/auth
 *
 * Why this design?
 * - Backend routers are mounted with prefix (e.g., app.use('/auth', authRoutes))
 * - Gateway preserves prefix when proxying
 * - Target URL matches backend's expected routing structure
 */
function buildProxyTarget(
  baseUrl: string | undefined,
  fallbackUrl: string,
  mountPath: string
): string {
  const base = (baseUrl || fallbackUrl).replace(/\/$/, ''); // Remove trailing slash
  const path = mountPath.startsWith('/') ? mountPath : `/${mountPath}`;
  const target = `${base}${path}`;

  console.log(`🔧 Gateway: Configuring proxy for ${mountPath} → ${target}`);

  return target;
}

/**
 * Service Configuration Map
 *
 * ✅ UNIFIED BACKEND: All services now point to single unified backend
 * - Authentication, Game, and Management are now modules in unified-backend
 * - Single deployment, single process, single port (3001)
 * - API Gateway maintains same path prefixes for zero breaking changes
 */
const UNIFIED_BACKEND = process.env.UNIFIED_BACKEND_URL || 'http://localhost:3001';

const services = {
  auth: {
    target: buildProxyTarget(
      process.env.UNIFIED_BACKEND_URL,
      UNIFIED_BACKEND,
      '/auth'
    ),
    backend: 'unified-backend',
    port: 3001
  },
  game: {
    target: buildProxyTarget(
      process.env.UNIFIED_BACKEND_URL,
      UNIFIED_BACKEND,
      '/game'
    ),
    backend: 'unified-backend',
    port: 3001
  },
  admin: {
    target: buildProxyTarget(
      process.env.UNIFIED_BACKEND_URL,
      UNIFIED_BACKEND,
      '/admin'
    ),
    backend: 'unified-backend',
    port: 3001
  },
  documents: {
    target: buildProxyTarget(
      process.env.UNIFIED_BACKEND_URL,
      UNIFIED_BACKEND,
      '/documents'  // CHANGED: from '/game/documents' to '/documents' (new module mount)
    ),
    backend: 'unified-backend',
    port: 3001
  },
  forum: {
    target: buildProxyTarget(
      process.env.UNIFIED_BACKEND_URL,
      UNIFIED_BACKEND,
      '/forum'
    ),
    backend: 'unified-backend',
    port: 3001
  },
  // Socket.IO WebSocket proxy (no path prefix, direct passthrough)
  socketio: {
    target: UNIFIED_BACKEND, // Direct target, no path needed
    backend: 'unified-backend',
    port: 3001
  }
};

// Validate configuration at startup
console.log('\n🔍 Gateway Configuration Validation:');
Object.entries(services).forEach(([key, config]) => {
  console.log(`  ✅ /${key} → ${config.target} (${config.backend}:${config.port})`);
});
console.log('');

// Create proxy middleware for each service
// http-proxy-middleware v3 syntax with 'on' event handlers
const createServiceProxy = (serviceName: string, config: any) => {
  return createProxyMiddleware({
    target: config.target,
    changeOrigin: true,
    timeout: 30000, // 30 second timeout (increased for resilience)
    on: {
      proxyReq: (proxyReq: any, req: any, _res: any) => {
        logger.debug(`[PROXY REQ] Forwarding to ${serviceName}: ${req.method} ${req.url}`);

        // Add gateway headers
        proxyReq.setHeader('X-Forwarded-By', 'TenPennyNovels-Gateway');
        proxyReq.setHeader('X-Service-Route', serviceName);

        // Forward cookies and auth headers
        if (req.headers.cookie) {
          proxyReq.setHeader('Cookie', req.headers.cookie);
          logger.debug(`[PROXY REQ] Forwarding cookies (${req.headers.cookie.substring(0, 50)}...)`);
        }
        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization);
          logger.debug(`[PROXY REQ] Forwarding authorization header`);
        }
      },
      proxyRes: (proxyRes: any, _req: any, res: any) => {
        logger.debug(`[PROXY RES] Response from ${serviceName}: ${proxyRes.statusCode}`);

        // Forward set-cookie headers back to client
        if (proxyRes.headers['set-cookie']) {
          res.setHeader('set-cookie', proxyRes.headers['set-cookie']);
          logger.debug(`[PROXY RES] Forwarding set-cookie headers back to client`);
        }
      },
      error: (err: any, req: any, res: any) => {
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
  });
};

// ========== HEALTH CHECK ENDPOINT ==========
// Must be defined BEFORE proxy routes to avoid routing conflicts
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Route to backend services (PRIORITY: these must come before other middleware)
console.log('🌐 Setting up proxy routes...');

// ========== SOCKET.IO WEBSOCKET PROXY (MUST BE FIRST) ==========
// Socket.IO requires special handling for WebSocket upgrade and polling
// CRITICAL: Use middleware without mount path to preserve /socket.io/ prefix
// http-proxy-middleware v3 syntax with 'on' event handlers
const socketioProxy = createProxyMiddleware({
  target: services.socketio.target,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
  timeout: 60000, // 60 seconds for long polling
  // Path filter: only proxy requests starting with /socket.io
  pathFilter: '/socket.io/**',
  on: {
    proxyReq: (proxyReq: any, req: any, _res: any) => {
      logger.debug(`[SOCKET.IO] Proxying: ${req.method} ${req.url}`);

      // Forward cookies for authentication
      if (req.headers.cookie) {
        proxyReq.setHeader('Cookie', req.headers.cookie);
      }

      // Add gateway headers
      proxyReq.setHeader('X-Forwarded-By', 'TenPennyNovels-Gateway');
      proxyReq.setHeader('X-Service-Route', 'socketio');
    },
    proxyRes: (proxyRes: any, _req: any, _res: any) => {
      logger.debug(`[SOCKET.IO] Response: ${proxyRes.statusCode}`);
    },
    error: (err: any, req: any, res: any) => {
      logger.error(`Socket.IO proxy error:`, {
        error: err.message,
        url: req.url,
        target: services.socketio.target
      });

      // Only send HTTP response if still in HTTP phase (before WebSocket upgrade)
      // After upgrade, res is a socket and doesn't have .status() method
      if (!res.headersSent && typeof res.status === 'function') {
        res.status(502).json({
          success: false,
          error: 'WebSocket service temporarily unavailable',
          code: 'WEBSOCKET_UNAVAILABLE'
        });
      }
    }
  }
});

// Apply proxy globally (not mounted at /socket.io to preserve path)
app.use(socketioProxy);
console.log('✅ Socket.IO WebSocket proxy configured');

// Debug middleware for /auth route
app.use('/auth', (req, _res, next) => {
  logger.debug(`[AUTH] ${req.method} ${req.originalUrl}`);
  next();
});

// Debug middleware for /game route
app.use('/game', (req, _res, next) => {
  logger.debug(`[GAME] ${req.method} ${req.originalUrl}`);
  next();
});

// Debug middleware for other routes
app.use('/forum', (req, _res, next) => {
  logger.debug(`[FORUM] ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/documents', (req, _res, next) => {
  logger.debug(`[DOCUMENTS] ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/admin', (req, _res, next) => {
  logger.debug(`[ADMIN] ${req.method} ${req.originalUrl}`);
  next();
});

// Apply rate limiting middleware to /documents routes
app.use('/documents', documentsRateLimitUnauth, documentsRateLimitAuth);

app.use('/auth', createServiceProxy('auth', services.auth));
app.use('/game', createServiceProxy('game', services.game));
app.use('/forum', createServiceProxy('forum', services.forum));
app.use('/documents', createServiceProxy('documents', services.documents));
app.use('/admin', createServiceProxy('admin', services.admin));


console.log('✅ All proxy routes configured');

// Body parsing middleware (only for non-proxied routes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Custom logging middleware for non-proxied routes only
app.use((req, res, next) => {
  // Skip logging for preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return next();
  }

  const startTime = Date.now();
  const originalUrl = req.originalUrl;
  const method = req.method;
  const clientIP = req.ip || req.socket?.remoteAddress;

  // Determine target backend based on route
  let targetService = 'Unknown';
  let targetURL = 'Unknown';

  if (originalUrl.startsWith('/auth')) {
    targetService = 'Authentication Backend';
    targetURL = `${process.env.AUTH_BACKEND_URL || 'http://localhost:3000'}${originalUrl}`;
  } else if (originalUrl.startsWith('/game')) {
    targetService = 'Game Backend';
    targetURL = `${process.env.GAME_BACKEND_URL || 'http://localhost:3001'}${originalUrl}`;
  } else if (originalUrl.startsWith('/forum')) {
    targetService = 'Game Backend (Forum)';
    targetURL = `${process.env.GAME_BACKEND_URL || 'http://localhost:3001'}${originalUrl}`;
  } else if (originalUrl.startsWith('/admin')) {
    targetService = 'Management Backend';
    targetURL = `${process.env.MANAGEMENT_BACKEND_URL || 'http://localhost:3002'}${originalUrl}`;
  } else {
    logger.info(`Route not found: ${method} ${originalUrl}`);
    res.status(404).json({
      success: false,
      error: 'API Gateway route not found',
      code: 'ROUTE_NOT_FOUND',
      requested_url: req.originalUrl || req.url,
      method: req.method,
    });
    return;
  }

  logger.info(`${method} ${originalUrl}`, {
    clientIP,
    targetService,
    targetURL
  });

  // Log response when finished
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    logger.info(`Response ${statusCode} | ${duration}ms | ${Buffer.byteLength(data, 'utf8')} bytes`);

    return originalSend.call(this, data);
  };

  next();
});

// Health check endpoint for the gateway itself with backend services status
app.get('/health', async (_req, res) => {
  
  // Gateway health data
  const gatewayHealth = {
    service: 'TenPennyNovels API Gateway',
    version: '1.0.0',
    description: 'API Gateway routing requests to backend microservices',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  };

  // Check backend services health
  const serviceHealthChecks = {
    auth: `${services.auth.target}/auth/health`,
    game: `${services.game.target}/game/health`,
    admin: `${services.admin.target}/admin/health`, 
  };

  const servicesStatus = {};

  // Check each service health
  for (const [serviceName, healthUrl] of Object.entries(serviceHealthChecks)) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(healthUrl, { 
        signal: controller.signal,
        headers: { 'User-Agent': 'TenPennyNovels-Gateway-Health-Check' }
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const healthData = await response.json();
        (servicesStatus as any)[serviceName] = {
          status: 'healthy',
          url: healthUrl,
          data: (healthData as any).data || healthData
        };
      } else {
        (servicesStatus as any)[serviceName] = {
          status: 'unhealthy',
          url: healthUrl,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error: any) {
      (servicesStatus as any)[serviceName] = {
        status: 'unreachable',
        url: healthUrl,
        error: (error as Error).message
      };
      logger.warn(`Service ${serviceName} health check failed:`, { error: (error as Error).message });
    }
  }

  // Determine overall gateway status
  const unhealthyServices = Object.values(servicesStatus).filter((s: any) => s.status !== 'healthy');
  const overallStatus = unhealthyServices.length === 0 ? 'healthy' : 
                       unhealthyServices.length < Object.keys(services).length ? 'degraded' : 'unhealthy';

  res.json({
    success: true,
    data: {
      gateway: {
        ...gatewayHealth,
        status: overallStatus
      },
      services: servicesStatus,
      summary: {
        total_services: 4,
        healthy_services: Object.values(servicesStatus).filter((s: any) => s.status === 'healthy').length,
        unhealthy_services: unhealthyServices.length,
        overall_status: overallStatus
      }
    }
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      service: 'TenPennyNovels API Gateway',
      version: '1.0.0',
      description: 'Central API Gateway for TenPennyNovels microservices architecture',
      routes: {
        authentication: '/auth/*',
        game_backend: '/game/*',
        forum: '/forum/*',
        management: '/admin/*',
        ai_services: '/ai/*'
      },
      endpoints: {
        health: '/health',
        gateway_info: '/'
      },
      backend_services: Object.keys(services).map(key => ({
        service: key,
        prefix: `/${key}`,
        target: (services as any)[key].target
      }))
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler with detailed logging
app.use((req, res) => {
  logger.warn('Route not found', {
    url: req.originalUrl || req.url,
    method: req.method,
    origin: req.get('Origin'),
    clientIP: req.ip || req.socket?.remoteAddress,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    error: 'API Gateway route not found',
    code: 'ROUTE_NOT_FOUND',
    requested_url: req.originalUrl || req.url,
    method: req.method,
    available_prefixes: ['/auth', '/game', '/forum', '/admin', '/documents'],
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error in API Gateway:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal gateway error' : error.message,
    code: 'INTERNAL_GATEWAY_ERROR',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  const { logger } = require('./utils/logger');
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  const { logger } = require('./utils/logger');
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;