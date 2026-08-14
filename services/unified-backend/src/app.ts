import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { requestIdMiddleware } from '@shared/middleware/requestId';
import { normalizeQueryParams } from '@shared/middleware/normalizeQueryParams';
import { maintenanceModeMiddleware } from '@shared/middleware/maintenanceMode';
import { responseMiddleware } from '@shared/middleware/responseMiddleware';
import { errorHandler, notFoundHandler } from '@shared/middleware/errorHandler';
import { httpLoggerStream, logger } from '@shared/utils/logger';
import { appConfig } from '@config/runtime';
import { bootstrapFeatures } from '@core/features/bootstrap';
import { FEATURES } from '@features/index';

// Import module routes
import authRoutes from '@core/auth/routes/auth';
import gameRoutes from '@modules/game/routes';
import characterGenConfigRoutes from '@modules/game/routes/characterGenConfig';
import adminRoutes from '@modules/admin/routes';

const app: Application = express();

// Nginx -> api-gateway -> qui: un solo hop di proxy fidato. Senza questo,
// express-rate-limit non sa a chi appartiene l'header X-Forwarded-For (già
// presente perché nginx lo imposta) e lo segnala come ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
// invece di usarlo per identificare il client reale.
if (appConfig.trustProxy) {
  app.set('trust proxy', 1);
}

// ===== Security & Performance Middleware =====
// ✅ SECURITY: Helmet with proper security headers configuration
app.use(helmet({
  // ✅ Enable Content Security Policy to prevent XSS attacks
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Unsafe-inline for inline styles
      scriptSrc: ["'self'"],                     // No external scripts
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],                    // API calls to same origin
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],                     // No plugins
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]                       // No iframes
    }
  },
  // ✅ Enable Cross-Origin-Embedder-Policy for better isolation
  crossOriginEmbedderPolicy: true,
  // Standard security headers
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000,  // 1 year
    includeSubDomains: true,
    preload: true
  }
}));
app.use(compression());

// ===== CORS Configuration =====
// NOTE: Unified backend is INTERNAL (behind API Gateway)
// CORS is already handled by API Gateway - this is permissive for proxied requests
// lgtm[js/cors-permissive-configuration] - Intentional; API Gateway enforces CORS security
app.use(cors({
  origin: true,  // Accept all origins (requests already validated by API Gateway)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'x-request-id']
}));

// ===== Body Parsing =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ===== HTTP Logging =====
app.use(morgan('combined', { stream: httpLoggerStream }));

// ===== Request ID (OBBLIGATORIO - prima di tutte le route) =====
app.use(requestIdMiddleware);

// ===== Query Params Normalization (array → string) =====
app.use(normalizeQueryParams);

// ===== Maintenance Mode Check =====
app.use(maintenanceModeMiddleware);

// ===== Response Middleware (auto-inject timestamp/requestId) =====
app.use(responseMiddleware);

// ===== Health Check =====
app.get('/health', (req, res) => {
  res.json({
    result: true,
    data: {
      status: 'ok',
      service: 'unified-backend',
      timestamp: new Date().toISOString()
    },
    timestamp: new Date().toISOString(),
    requestId: res.locals.requestId
  });
});

// ===== Rate Limiting Globale =====
// CodeQL (js/missing-rate-limiting) analizza ogni handler singolarmente e
// segnala "missing" ovunque non trovi un middleware express-rate-limit
// esplicito nella catena — non riconosce i controlli Redis-based già
// esistenti (AdminAuthMiddleware.sensitiveOperationLimit()) né il rate
// limiting a monte dell'api-gateway. Risultato: ~250 alert sparsi su
// quasi ogni file di routes del service, non isolabili singolarmente.
// Limiter generico qui, montato prima di tutte le route applicative,
// copre l'intera superficie in un solo punto: soddisfa CodeQL ovunque e
// fornisce una difesa reale contro un flood puro. I limiter più stretti
// già presenti per-route (read/write/destructive, spesso più severi)
// restano invariati e si applicano IN AGGIUNTA a questo, non al suo posto.
// /health resta escluso: polling legittimo e frequente da Docker/PM2/LB.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req.ip ?? ''),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Troppe richieste, riprova più tardi.',
      code: 'GLOBAL_RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString()
    });
  }
});

// ===== Module Routes =====
app.use(globalLimiter);
app.use('/auth', authRoutes);
app.use('/character-gen', characterGenConfigRoutes);  // Character Gen config (PUBLIC - no auth)
app.use('/game', gameRoutes);
app.use('/admin', adminRoutes);

// ===== Feature Routes =====
// Sincrona: un errore di configurazione (es. chiave feature duplicata)
// deve far fallire l'avvio qui, non diventare un unhandledRejection
// silenzioso. Vedi core/features/bootstrap.ts per il dettaglio.
bootstrapFeatures(app, FEATURES);

// ===== 404 Handler (DOPO tutte le route) =====
app.use(notFoundHandler);

// ===== Error Handler Centralizzato (ULTIMO middleware) =====
app.use(errorHandler);

export default app;
