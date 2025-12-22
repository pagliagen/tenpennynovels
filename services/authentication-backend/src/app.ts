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
import { httpLoggerStream } from './utils/logger';
import { AnalyticsMiddleware } from '../../../packages/shared/src/middleware/analyticsMiddleware';

console.log('🔧 Loading environment variables...');
// Load environment variables: first global, then service-specific overrides
console.log('📁 Loading global .env from project root...');
dotenv.config({ path: '../../.env' });
console.log('📁 Loading service-specific .env (if exists)...');
dotenv.config({ override: true }); // This will override with local .env if it exists
console.log('✅ Environment variables loaded');
console.log('🔍 JWT_SECRET (AUTH):', process.env.JWT_SECRET || 'MISSING');
console.log('🔍 Key URLs:', {
  LANDING_URL: process.env.LANDING_URL,
  GAME_URL: process.env.GAME_URL,
  MANAGEMENT_URL: process.env.MANAGEMENT_URL
});
console.log('🔍 MongoDB:', process.env.MONGODB_URI ? `${process.env.MONGODB_URI.substring(0, 30)}...` : 'MISSING');
console.log('🔍 EMAIL_MOCK:', process.env.EMAIL_MOCK);

console.log('📦 Setting up Authentication Backend...');
const app = express();
const PORT = process.env.PORT || 3000;
console.log(`🎯 Starting Authentication Backend on port ${PORT}...`);

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
    console.log(`🔄 [AUTHENTICATION BACKEND CORS] Received origin: "${origin}"`);
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

    console.log(`🔍 [AUTHENTICATION BACKEND CORS] Allowed origins:`, allowedOrigins);

    // Allow requests with no origin (like server-to-server or curl)
    if (!origin) {
      console.log(`✅ [AUTHENTICATION BACKEND CORS] No origin - allowing request`);
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.includes(origin);
    console.log(`🔍 [AUTHENTICATION BACKEND CORS] Origin "${origin}" allowed: ${isAllowed}`);

    if (isAllowed) {
      console.log(`✅ [AUTHENTICATION BACKEND CORS] Allowing origin ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ [AUTHENTICATION BACKEND CORS] Blocking origin ${origin}`);
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
  message: {
    success: false,
    error: 'Troppe richieste da questo indirizzo IP, riprova più tardi.',
    code: 'RATE_LIMITED',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/auth', limiter);

// API routes
app.use('/auth', authRoutes);

// Health check endpoint
app.get('/auth/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      service: 'authentication-backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Root endpoint removed - not needed

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const { httpLoggerStream } = require('./utils/logger');
  const { logger } = require('./utils/logger');
  
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    code: 'INTERNAL_SERVER_ERROR',
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