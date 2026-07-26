import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { requestIdMiddleware } from '@shared/middleware/requestId';
import { normalizeQueryParams } from '@shared/middleware/normalizeQueryParams';
import { maintenanceModeMiddleware } from '@shared/middleware/maintenanceMode';
import { responseMiddleware } from '@shared/middleware/responseMiddleware';
import { errorHandler, notFoundHandler } from '@shared/middleware/errorHandler';
import { httpLoggerStream, logger } from '@shared/utils/logger';

// Import module routes
import authRoutes from '@modules/auth/routes/auth';
import gameRoutes from '@modules/game/routes';
import characterGenConfigRoutes from '@modules/game/routes/characterGenConfig';
import adminRoutes from '@modules/admin/routes';
import documentsRoutes from '@modules/documents/routes';
import forumRoutes from '@modules/forum/routes/forum';
import { webhookRoutes } from '@modules/admin/routes/webhookRoutes';
import inboundWebhookRoutes from './routes/webhooks';

const app: Application = express();

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

// ===== Webhook Routes (before admin auth middleware) =====
app.use('/webhooks', webhookRoutes);

// ===== Inbound Webhook Routes (from internal services — auth via Bearer secret) =====
app.use('/webhooks', inboundWebhookRoutes);

// ===== Module Routes =====
app.use('/auth', authRoutes);
app.use('/documents', documentsRoutes);  // Documents module (public)
app.use('/forum', forumRoutes);
app.use('/character-gen', characterGenConfigRoutes);  // Character Gen config (PUBLIC - no auth)
app.use('/game', gameRoutes);
app.use('/admin', adminRoutes);

// ===== 404 Handler (DOPO tutte le route) =====
app.use(notFoundHandler);

// ===== Error Handler Centralizzato (ULTIMO middleware) =====
app.use(errorHandler);

export default app;
