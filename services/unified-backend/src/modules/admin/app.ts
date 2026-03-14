import 'module-alias/register';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { apiRoutes } from './routes';
import { httpLoggerStream, logger } from './utils/logger';
import { ApiResponse } from './types/management';
import { successResponse, errorResponse } from './utils/apiResponse';

logger.info('Setting up Management Backend...');
const app = express();
const PORT = process.env.PORT || 3002;
logger.info(`Starting Management Backend on port ${PORT}...`);

// Trust proxy configuration - needed for proper IP detection behind reverse proxy
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration - Accept from API Gateway (both internal and external URLs)
app.use(cors({
  origin: function (origin, callback) {
    logger.info(`[MANAGEMENT BACKEND CORS] Received origin: "${origin}"`);
    const allowedOrigins = [
      'http://localhost:8000', // Internal communication on OVH
      'http://127.0.0.1:8000', // Alternative localhost
      'https://api.tenpennynovels.com', // External API Gateway URL
      process.env.LANDING_URL || 'https://tenpennynovels.com',
      process.env.GAME_URL || 'https://game.tenpennynovels.com',
      process.env.DOCUMENTS_URL || 'https://documenti.tenpennynovels.com',
      process.env.MANAGEMENT_URL || 'https://gestione.tenpennynovels.com',
    ];

    // Allow requests with no origin (like server-to-server or curl)
    if (!origin) {
      logger.info('[MANAGEMENT BACKEND CORS] No origin - allowing request');
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.includes(origin);
    logger.info(`[MANAGEMENT BACKEND CORS] Origin "${origin}" allowed: ${isAllowed}`);

    if (isAllowed) {
      logger.info(`[MANAGEMENT BACKEND CORS] Allowing origin ${origin}`);
      callback(null, true);
    } else {
      logger.info(`[MANAGEMENT BACKEND CORS] Blocking origin ${origin}`);
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

// Custom request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  const origin = req.get('Origin') || 'No origin';
  
  logger.info(`[${timestamp}] MANAGEMENT BACKEND REQUEST: ${method} ${url}`);
 
  // Log response when finished
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    logger.info(`CallInfo: ${req.method} ${req.originalUrl} | Duration: ${duration}ms`);
    logger.info(`RESPONSE: ${statusCode} | Duration: ${duration}ms`);

    // Calculate data size - handle objects by stringifying them first
    let dataSize = 0;
    if (data) {
      try {
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
        dataSize = Buffer.byteLength(dataStr, 'utf8');
      } catch (e) {
        dataSize = 0;
      }
    }
    logger.info(`Data size: ${dataSize} bytes`);
    logger.info('─────────────────────────────────────────────────────────────');

    return originalSend.call(this, data);
  };
  
  next();
});

// Request logging (additional)
app.use(morgan('combined', {
  stream: httpLoggerStream
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 10000 : 1000, // Higher limit for development
  message: {
    result: false,
    error: 'Troppe richieste da questo indirizzo IP, riprova più tardi.',
    code: 'RATE_LIMITED',
    timestamp: new Date().toISOString()
  } as ApiResponse,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/admin', limiter);

// Admin routes
app.use('/admin', apiRoutes);

// Health check endpoint
app.get('/admin/health', (req, res) => {
  res.json(successResponse({
    status: 'healthy',
    service: 'management-backend',
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  }));
});

// Root endpoint removed - not needed

// 404 handler
app.use((req, res) => {
  res.status(404).json(errorResponse(
    'Endpoint not found',
    'ENDPOINT_NOT_FOUND',
    undefined,
    404
  ));
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const { logger } = require('./utils/logger');
  
  logger.error('Unhandled error:', {
    error: error instanceof Error ? error.message : String(error),
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const response = errorResponse(
    process.env.NODE_ENV === 'production' ? 'Errore interno del server' : error instanceof Error ? error.message : String(error),
    'INTERNAL_SERVER_ERROR',
    undefined,
    500
  );

  res.status(500).json(response);
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