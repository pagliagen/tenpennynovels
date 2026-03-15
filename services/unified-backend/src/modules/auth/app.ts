import 'module-alias/register';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import { httpLoggerStream, logger } from './logger';
import { AnalyticsMiddleware } from '@shared/middleware/analyticsMiddleware';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { appConfig } from '@config/runtime';

import path from 'path';
logger.info('Loading environment variables...');
const projectRoot = path.resolve(__dirname, '../../../');
const rootEnvPath = path.join(projectRoot, '.env');
logger.info('Loading global .env from project root:', rootEnvPath);
dotenv.config({ path: rootEnvPath });
logger.info('Loading service-specific .env (if exists)...');
dotenv.config({ override: true });
logger.info('Environment variables loaded');
logger.info('JWT_SECRET (AUTH):', appConfig.jwt.secret ? 'SET' : 'MISSING');
logger.info('MongoDB:', appConfig.db.mongodbUri ? 'SET' : 'MISSING');

logger.info('Setting up Authentication Backend...');
const app = express();
logger.info(`Starting Authentication Backend on port ${appConfig.port}...`);

if (appConfig.trustProxy) {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const isAllowed = appConfig.cors.allowedOrigins.includes(origin);
    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn(`[AUTH CORS] Blocked origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'X-Forwarded-By', 'X-Service-Route']
}));

// General middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Analytics tracking (must be before morgan)
app.use(AnalyticsMiddleware.initializeTracking());
app.use(AnalyticsMiddleware.trackPageView());
app.use(AnalyticsMiddleware.trackUserAction());

// Request logging
app.use(morgan('combined', {
  stream: httpLoggerStream
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: errorResponse(
    'Troppe richieste da questo indirizzo IP, riprova più tardi.',
    'RATE_LIMITED',
    undefined,
    429,
    undefined
  ),
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/auth', limiter);

// API routes
app.use('/auth', authRoutes);

// Health check endpoint
app.get('/auth/health', (req, res) => {
  res.json(successResponse(
    {
      status: 'healthy',
      service: 'authentication-backend',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: appConfig.isProduction ? 'production' : 'development'
    },
    undefined,
    getRequestId(req)
  ));
});

// Root endpoint removed - not needed

// 404 handler
app.use((req, res) => {
  res.status(404).json(errorResponse(
    'Endpoint not found',
    'ENDPOINT_NOT_FOUND',
    undefined,
    404,
    getRequestId(req)
  ));
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const { httpLoggerStream } = require('./logger');
  const { logger } = require('./logger');
  
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(500).json(errorResponse(
    appConfig.isProduction ? 'Errore interno del server' : error.message,
    'INTERNAL_SERVER_ERROR',
    undefined,
    500,
    getRequestId(req)
  ));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  const { logger } = require('./logger');
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  const { logger } = require('./logger');
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;