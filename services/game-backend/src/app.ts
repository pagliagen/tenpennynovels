import 'module-alias/register';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
// import morgan from 'morgan';
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
// import { logger, httpLoggerStream } from './utils/logger';
// import { errorHandler } from './middleware/errorHandler';
import characterRoutes from './routes/characters';
import locationRoutes from './routes/locations';
import gameRoutes from './routes/game';
import economyRoutes from './routes/economy';
import messageRoutes from './routes/messages';
import chatRoutes from './routes/chats';
import corporationRoutes from './routes/corporations';
import forumRoutes from './routes/forum';
import documentsRoutes from './routes/documents';
import ticketRoutes from './routes/tickets';
import experienceRoutes from './routes/experienceRoutes';
import { housingRoutes } from './routes/housing-simple';
import { AnalyticsMiddleware } from '../../../packages/shared/src/middleware/analyticsMiddleware';

// Import daily experience cron jobs (runs automatically when imported)
import './cron/dailyExperience';

const app = express();

// Trust proxy - IMPORTANT: Configure this for production behind proxy/load balancer
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
  // Trust the first proxy (typical for reverse proxy setups)
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration - Accept from API Gateway (both internal and external URLs)
app.use(cors({
  origin: function (origin, callback) {
    console.log(`🔄 [GAME BACKEND CORS] Received origin: "${origin}"`);
    const allowedOrigins = [
      'http://localhost:8000', // Internal communication (LAN)
      'http://127.0.0.1:8000', // Alternative localhost
      'https://api.tenpennynovels.com', // External API Gateway URL
      process.env.LANDING_URL || 'https://tenpennynovels.com',
      process.env.GAME_URL || 'https://game.tenpennynovels.com',
      process.env.DOCUMENTS_URL || 'https://documenti.tenpennynovels.com',
      process.env.FORUM_URL || 'https://forum.tenpennynovels.com',
      process.env.MANAGEMENT_URL || 'https://gestione.tenpennynovels.com',
      process.env.TICKETS_URL || 'https://supporto.tenpennynovels.com'
    ];

    console.log(`🔍 [GAME BACKEND CORS] Allowed origins:`, allowedOrigins);

    // Allow requests with no origin (like server-to-server or curl)
    if (!origin) {
      console.log(`✅ [GAME BACKEND CORS] No origin - allowing request`);
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.includes(origin);
    console.log(`🔍 [GAME BACKEND CORS] Origin "${origin}" allowed: ${isAllowed}`);

    if (isAllowed) {
      console.log(`✅ [GAME BACKEND CORS] Allowing origin ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ [GAME BACKEND CORS] Blocking origin ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cookie', 'X-Forwarded-By', 'X-Service-Route'],
  optionsSuccessStatus: 200
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
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

  console.log(`🚀 [${timestamp}] GAME BACKEND REQUEST: ${method} ${url}`);
  console.log(`   📍 Client IP: ${clientIP}`);
  console.log(`   🌐 Origin: ${origin}`);
  console.log(`   🤖 User-Agent: ${userAgent.substring(0, 50)}...`);
  console.log(`   🍪 Has Cookies: ${req.headers.cookie ? 'Yes' : 'No'}`);
  console.log(`   🔑 Has Auth: ${req.headers.authorization ? 'Yes' : 'No'}`);
  console.log(`   📋 Headers: X-Forwarded-By=${req.get('X-Forwarded-By')}, X-Service-Route=${req.get('X-Service-Route')}`);

  // Log response when finished
  const originalSend = res.send;
  res.send = function (data) {
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

// Analytics tracking (after logging middleware)
app.use(AnalyticsMiddleware.initializeTracking());
app.use(AnalyticsMiddleware.trackPageView());
app.use(AnalyticsMiddleware.trackUserAction());

// HTTP request logging
// app.use(morgan('combined', { stream: httpLoggerStream }));

// Rate limiting - NOW INITIALIZED DYNAMICALLY IN initializeRateLimiters()
// See initializeRateLimiters() function below for dynamic rate limiter setup
// Rate limiters are applied after database connection is established

// Game routes under /game prefix  
app.use('/game', characterRoutes);
app.use('/game', locationRoutes);
app.use('/game', gameRoutes);
app.use('/game', economyRoutes);
app.use('/game', messageRoutes);
app.use('/game', chatRoutes);
app.use('/game', corporationRoutes);
app.use('/game', ticketRoutes);
app.use('/game', experienceRoutes);
app.use('/game', housingRoutes);

// Forum routes under /forum prefix
app.use('/forum', forumRoutes);

// Documents routes under /docs prefix
console.log('📚 Registering documents routes under /documents');
app.use('/documents', documentsRoutes);

// Game health check
app.get('/game/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'game-backend',
    timestamp: new Date().toISOString()
  });
});

// 404 handler for unknown routes
app.use((req, res) => {
  console.warn('404 - Route not found', req.method, req.originalUrl);

  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString()
  });
});

// Global error handler (must be last)
// app.use(errorHandler);

// Database connection setup (will be used by index.ts)
export const setupDatabaseConnections = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();
    console.log('✅ MongoDB connected');

    // Connect to Redis
    await connectRedis();
    console.log('✅ Redis connected');

    console.log('✅ Database connections setup completed');

  } catch (error: any) {
    console.error('❌ Failed to setup database connections:', error);
    throw error;
  }
};

// Rate limiter initialization (will be used by index.ts)
export const initializeRateLimiters = async () => {
  try {
    const { ConfigurationService } = await import('../../../packages/shared/src/services/ConfigurationService');
    const { getRedisClient } = await import('./config/redis');
    const { logger } = await import('./utils/logger');
    const redis = getRedisClient();
    const configService = new ConfigurationService(redis, logger);

    // Fetch rate limit configurations from database
    const apiWindowMs = await configService.getConfig('rate_limit_api_window') || 900000; // 15 min
    const apiMax = await configService.getConfig('rate_limit_api_max') || 1000;
    const strictWindowMs = await configService.getConfig('rate_limit_strict_window') || 300000; // 5 min
    const strictMax = await configService.getConfig('rate_limit_strict_max') || 50;

    console.log(`✅ Initializing Rate Limiters:`);
    console.log(`   API: ${apiMax} requests per ${apiWindowMs / 60000} minutes`);
    console.log(`   Strict: ${strictMax} requests per ${strictWindowMs / 60000} minutes`);

    // General API rate limiter
    const apiLimiter = rateLimit({
      windowMs: apiWindowMs,
      max: apiMax,
      message: {
        success: false,
        error: 'Troppe richieste da questo indirizzo IP, riprova più tardi.',
        code: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString()
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Strict rate limiter for expensive operations
    const strictLimiter = rateLimit({
      windowMs: strictWindowMs,
      max: strictMax,
      message: {
        success: false,
        error: 'Troppe richieste per questa operazione, riprova più tardi.',
        code: 'STRICT_RATE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString()
      }
    });

    // Apply rate limiting to all routes
    app.use('/', apiLimiter);

    // Apply strict rate limiting to resource-intensive endpoints
    app.use('/game/characters/create', strictLimiter);
    app.use('/game/messages/send', strictLimiter);
    app.use('/game/economy/purchase', strictLimiter);
    app.use('/game/locations/actions', strictLimiter);

    console.log('✅ Rate limiters initialized successfully');

  } catch (error: any) {
    console.error('❌ Failed to initialize rate limiters:', error);
    throw error;
  }
};

// Process handlers (will be used by index.ts)
export const setupProcessHandlers = (server: any) => {
  // Graceful shutdown handling
  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(() => {
      console.log('HTTP server closed');

      // Close database connections
      // MongoDB will close automatically when process exits

      // Close Redis connection
      // Redis connection will close automatically when process exits

      console.log('Graceful shutdown completed');
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  // Handle graceful shutdown
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at Promise:', reason, promise);
    process.exit(1);
  });
};

// Don't start server here - just export the app
console.log('🔧 App setup complete, exporting...');

export default app;