import 'module-alias/register';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { apiRoutes } from './routes';
import { httpLoggerStream } from './utils/logger';
import { ApiResponse } from './types/management';

console.log('📦 Setting up Management Backend...');
const app = express();
const PORT = process.env.PORT || 3002;
console.log(`🎯 Starting Management Backend on port ${PORT}...`);

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
    console.log(`🔄 [MANAGEMENT BACKEND CORS] Received origin: "${origin}"`);
    const allowedOrigins = [
      'http://localhost:8000', // Internal communication on OVH
      'http://127.0.0.1:8000', // Alternative localhost
      'https://api.tenpennynovels.com', // External API Gateway URL
      process.env.LANDING_URL || 'https://tenpennynovels.com',
      process.env.GAME_URL || 'https://game.tenpennynovels.com',
      process.env.DOCUMENTS_URL || 'https://documenti.tenpennynovels.com',
      process.env.FORUM_URL || 'https://forum.tenpennynovels.com',
      process.env.MANAGEMENT_URL || 'https://gestione.tenpennynovels.com',
      process.env.TICKETS_URL || 'https://supporto.tenpennynovels.com'
    ];

    console.log(`🔍 [MANAGEMENT BACKEND CORS] Allowed origins:`, allowedOrigins);

    // Allow requests with no origin (like server-to-server or curl)
    if (!origin) {
      console.log(`✅ [MANAGEMENT BACKEND CORS] No origin - allowing request`);
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.includes(origin);
    console.log(`🔍 [MANAGEMENT BACKEND CORS] Origin "${origin}" allowed: ${isAllowed}`);

    if (isAllowed) {
      console.log(`✅ [MANAGEMENT BACKEND CORS] Allowing origin ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ [MANAGEMENT BACKEND CORS] Blocking origin ${origin}`);
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
  
  console.log(`🚀 [${timestamp}] MANAGEMENT BACKEND REQUEST: ${method} ${url}`);
  console.log(`   📍 Client IP: ${clientIP}`);
  console.log(`   🌐 Origin: ${origin}`);
  console.log(`   🤖 User-Agent: ${userAgent.substring(0, 50)}...`);
  console.log(`   🍪 Has Cookies: ${req.headers.cookie ? 'Yes' : 'No'}`);
  console.log(`   🔑 Has Auth: ${req.headers.authorization ? 'Yes' : 'No'}`);
  console.log(`   📋 Headers: X-Forwarded-By=${req.get('X-Forwarded-By')}, X-Service-Route=${req.get('X-Service-Route')}`);
  
  // Log response when finished
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const statusEmoji = statusCode >= 200 && statusCode < 300 ? '✅' : 
                       statusCode >= 400 && statusCode < 500 ? '⚠️' : '❌';
    
    console.log(`   CallInfo: ${req.method} ${req.originalUrl} | Duration: ${duration}ms`);
    console.log(`   ${statusEmoji} RESPONSE: ${statusCode} | Duration: ${duration}ms`);
    console.log(`   📊 Data size: ${data ? Buffer.byteLength(data, 'utf8') : 0} bytes`);
    console.log('   ─────────────────────────────────────────────────────────────');
    
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
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
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
  const response: ApiResponse = {
    success: true,
    data: {
      status: 'healthy',
      service: 'management-backend',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    },
    timestamp: new Date().toISOString()
  };
  res.json(response);
});

// Root endpoint removed - not needed

// 404 handler
app.use((req, res) => {
  const response: ApiResponse = {
    success: false,
    error: 'Endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    timestamp: new Date().toISOString()
  };
  res.status(404).json(response);
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

  const response: ApiResponse = {
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error instanceof Error ? error.message : String(error),
    code: 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString()
  };

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