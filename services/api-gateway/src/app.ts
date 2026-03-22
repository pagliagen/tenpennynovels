import express, { type Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { httpLoggerStream, logger } from './utils/logger';
import { config } from './config';

const app = express();

// ---------------------------------------------------------------------------
// Trust proxy (necessario per IP detection dietro reverse proxy)
// ---------------------------------------------------------------------------
if (config.trustProxy) {
  app.set('trust proxy', 1);
}

// ---------------------------------------------------------------------------
// Sicurezza
// ---------------------------------------------------------------------------
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ---------------------------------------------------------------------------
// CDN — file statici (PRIMA del CORS globale per evitare conflitto credentials)
// ---------------------------------------------------------------------------
app.use('/cdn', cors({
  origin: config.cdn.allowedOrigins,
  credentials: false,
  methods: ['GET', 'HEAD'],
}), express.static(config.cdn.storagePath, {
  maxAge: config.cdn.maxAge,
  immutable: config.cdn.immutable,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!config.isProduction) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// ---------------------------------------------------------------------------
// CORS globale
// ---------------------------------------------------------------------------
app.use(cors({
  origin(origin, callback) {
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
    'X-Tenpenny-Documents-Build',
  ],
  optionsSuccessStatus: 200,
}));

// ---------------------------------------------------------------------------
// Middleware generali
// ---------------------------------------------------------------------------
app.use(compression({
  filter: (req, res) => {
    const ct = res.getHeader('content-type');
    if (ct && String(ct).includes('text/event-stream')) return false;
    return compression.filter(req, res);
  },
}));
app.use(cookieParser());
app.use(morgan('combined', { stream: httpLoggerStream }));

// ---------------------------------------------------------------------------
// Rate limiting — solo /documents
// ---------------------------------------------------------------------------
const { unauthenticated, authenticated, buildBypassSecret, disabled: documentsRateLimitDisabled } =
  config.rateLimit.documents;

/** Evita 429 durante next build / ISR (molte richieste parallele). */
function shouldSkipDocumentsRateLimit(req: Request): boolean {
  if (documentsRateLimitDisabled) return true;
  if (!config.isProduction) return true;
  if (!buildBypassSecret) return false;
  return req.get('x-tenpenny-documents-build') === buildBypassSecret;
}

const documentsRateLimitUnauth = rateLimit({
  windowMs: unauthenticated.windowMs,
  max: unauthenticated.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !!req.cookies?.auth_token || shouldSkipDocumentsRateLimit(req),
  // Rimosso keyGenerator custom - usa default (normalizza IPv6 automaticamente)
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Troppe richieste. Riprova più tardi.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: unauthenticated.windowMs / 1000,
      timestamp: new Date().toISOString(),
    });
  },
});

const documentsRateLimitAuth = rateLimit({
  windowMs: authenticated.windowMs,
  max: authenticated.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.cookies?.auth_token || shouldSkipDocumentsRateLimit(req),
  keyGenerator: (req) => req.cookies?.auth_token || 'unknown',
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Troppe richieste. Riprova più tardi.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: authenticated.windowMs / 1000,
      timestamp: new Date().toISOString(),
    });
  },
});

// ---------------------------------------------------------------------------
// Configurazione servizi proxy
// ---------------------------------------------------------------------------
interface ServiceConfig {
  target: string;
  timeout: number;
}

const BACKEND = config.backend.url;

const services: Record<string, ServiceConfig> = {
  auth:      { target: `${BACKEND}/auth`,      timeout: config.proxy.defaultTimeout },
  game:      { target: `${BACKEND}/game`,      timeout: config.proxy.defaultTimeout },
  forum:     { target: `${BACKEND}/forum`,      timeout: config.proxy.defaultTimeout },
  documents: { target: `${BACKEND}/documents`,  timeout: config.proxy.documentsTimeout },
  admin:     { target: `${BACKEND}/admin`,      timeout: config.proxy.defaultTimeout },
};

function createServiceProxy(name: string, svc: ServiceConfig) {
  return createProxyMiddleware({
    target: svc.target,
    changeOrigin: true,
    timeout: svc.timeout,
    on: {
      proxyReq: (proxyReq: any, req: any) => {
        proxyReq.setHeader('X-Forwarded-By', 'TenPennyNovels-Gateway');
        proxyReq.setHeader('X-Service-Route', name);

        if (req.headers.cookie) {
          proxyReq.setHeader('Cookie', req.headers.cookie);
        }
        if (req.headers.authorization) {
          proxyReq.setHeader('Authorization', req.headers.authorization);
        }
      },
      proxyRes: (proxyRes: any, _req: any, res: any) => {
        if (proxyRes.headers['set-cookie']) {
          res.setHeader('set-cookie', proxyRes.headers['set-cookie']);
        }
      },
      error: (err: any, _req: any, res: any) => {
        logger.error(`Errore proxy ${name}:`, { error: err.message, target: svc.target });
        if (!res.headersSent && typeof res.status === 'function') {
          res.status(502).json({
            success: false,
            error: `Servizio ${name} temporaneamente non disponibile`,
            code: 'SERVICE_UNAVAILABLE',
            timestamp: new Date().toISOString(),
          });
        }
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Health check (PRIMA delle route proxy)
// ---------------------------------------------------------------------------
app.get('/health', async (_req, res) => {
  const healthChecks: Record<string, string> = {
    auth: `${services.auth.target}/health`,
    game: `${services.game.target}/health`,
    admin: `${services.admin.target}/health`,
  };

  interface ServiceStatus {
    status: 'healthy' | 'unhealthy' | 'unreachable';
    url: string;
    data?: unknown;
    error?: string;
  }

  const servicesStatus: Record<string, ServiceStatus> = {};

  for (const [name, url] of Object.entries(healthChecks)) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'TenPennyNovels-Gateway-Health-Check' },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json() as Record<string, unknown>;
        servicesStatus[name] = { status: 'healthy', url, data: json.data ?? json };
      } else {
        servicesStatus[name] = { status: 'unhealthy', url, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      servicesStatus[name] = {
        status: 'unreachable',
        url,
        error: (error as Error).message,
      };
      logger.warn(`Health check ${name} fallito:`, { error: (error as Error).message });
    }
  }

  const statuses = Object.values(servicesStatus);
  const unhealthy = statuses.filter((s) => s.status !== 'healthy').length;
  const overallStatus = unhealthy === 0 ? 'healthy' : unhealthy < statuses.length ? 'degraded' : 'unhealthy';

  res.json({
    success: true,
    data: {
      gateway: {
        service: 'TenPennyNovels API Gateway',
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
      services: servicesStatus,
      summary: {
        total: statuses.length,
        healthy: statuses.length - unhealthy,
        unhealthy,
        overallStatus,
      },
    },
  });
});

// ---------------------------------------------------------------------------
// Socket.IO WebSocket proxy (DEVE essere prima delle route HTTP)
// ---------------------------------------------------------------------------
app.use(createProxyMiddleware({
  target: BACKEND,
  changeOrigin: true,
  ws: true,
  timeout: config.proxy.socketTimeout,
  pathFilter: '/socket.io/**',
  on: {
    proxyReq: (proxyReq: any, req: any) => {
      if (req.headers.cookie) proxyReq.setHeader('Cookie', req.headers.cookie);
      proxyReq.setHeader('X-Forwarded-By', 'TenPennyNovels-Gateway');
      proxyReq.setHeader('X-Service-Route', 'socketio');
    },
    error: (err: any, _req: any, res: any) => {
      logger.error('Errore proxy Socket.IO:', { error: err.message });
      if (!res.headersSent && typeof res.status === 'function') {
        res.status(502).json({
          success: false,
          error: 'Servizio WebSocket temporaneamente non disponibile',
          code: 'WEBSOCKET_UNAVAILABLE',
        });
      }
    },
  },
}));

// ---------------------------------------------------------------------------
// Debug middleware unificato (solo in dev)
// ---------------------------------------------------------------------------
if (!config.isProduction) {
  const debugRoutes = ['/auth', '/game', '/forum', '/documents', '/admin'];
  for (const route of debugRoutes) {
    app.use(route, (req, _res, next) => {
      logger.debug(`[${route.slice(1).toUpperCase()}] ${req.method} ${req.originalUrl}`);
      next();
    });
  }
}

// Rimuovi accept-encoding per semantic-search (SSE)
app.use('/documents', (req, _res, next) => {
  if (req.url.includes('semantic-search')) {
    delete req.headers['accept-encoding'];
  }
  next();
});

// Rate limiting su /documents
app.use('/documents', documentsRateLimitUnauth, documentsRateLimitAuth);

// Route proxy verso il backend
for (const [name, svc] of Object.entries(services)) {
  app.use(`/${name}`, createServiceProxy(name, svc));
}

// Body parsing (solo per rotte NON proxied, come /, /health)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------------------------------------------------------------------------
// Root endpoint
// ---------------------------------------------------------------------------
app.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      service: 'TenPennyNovels API Gateway',
      version: '1.0.0',
      routes: ['/auth', '/game', '/forum', '/documents', '/admin', '/cdn', '/socket.io'],
      endpoints: { health: '/health', info: '/' },
    },
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------
app.use((req, res) => {
  logger.warn('Rotta non trovata', {
    url: req.originalUrl,
    method: req.method,
    origin: req.get('Origin'),
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    error: 'Rotta API Gateway non trovata',
    code: 'ROUTE_NOT_FOUND',
    requested_url: req.originalUrl,
    method: req.method,
    available_prefixes: ['/auth', '/game', '/forum', '/admin', '/documents', '/cdn', '/socket.io'],
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Error handler globale
// ---------------------------------------------------------------------------
app.use((error: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Errore non gestito nel gateway:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  res.status(500).json({
    success: false,
    error: config.isProduction ? 'Errore interno del gateway' : error.message,
    code: 'INTERNAL_GATEWAY_ERROR',
    timestamp: new Date().toISOString(),
  });
});

export default app;
