import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { requestIdMiddleware } from '@shared/middleware/requestId';
import { normalizeQueryParams } from '@shared/middleware/normalizeQueryParams';
import { errorHandler, notFoundHandler } from '@shared/middleware/errorHandler';
import { httpLoggerStream, logger } from '@shared/utils/logger';

// Import module routes
import authRoutes from '@modules/auth/routes/auth';
import gameRoutes from '@modules/game/routes';
import adminRoutes from '@modules/admin/routes';
import documentsRoutes from '@modules/documents/routes';
import forumRoutes from '@modules/forum/routes/forum';
import { webhookRoutes } from '@modules/admin/routes/webhookRoutes';

const app: Application = express();

// ===== Security & Performance Middleware =====
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());

// ===== CORS Configuration =====
// NOTE: Unified backend is INTERNAL (behind API Gateway)
// CORS is already handled by API Gateway - this is permissive for proxied requests
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

// ===== Module Routes =====
app.use('/auth', authRoutes);
app.use('/documents', documentsRoutes);  // Documents module (public)
app.use('/forum', forumRoutes);
app.use('/game', gameRoutes);
app.use('/admin', adminRoutes);

// ===== 404 Handler (DOPO tutte le route) =====
app.use(notFoundHandler);

// ===== Error Handler Centralizzato (ULTIMO middleware) =====
app.use(errorHandler);

export default app;
