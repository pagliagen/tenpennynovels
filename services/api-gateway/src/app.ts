import 'module-alias/register';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
// import rateLimit from 'express-rate-limit'; // Rate limiting moved to Nginx
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

// CORS configuration for API Gateway - Enhanced with explicit origin handling
app.use(cors({
  origin: function (origin, callback) {
    console.log(`🔄 CORS: Received origin: "${origin}" (type: ${typeof origin})`);
    const allowedOrigins = [
      process.env.LANDING_URL || 'https://tenpennynovels.com',
      process.env.GAME_URL || 'https://game.tenpennynovels.com',
      process.env.DOCUMENTS_URL || 'https://documenti.tenpennynovels.com',
      process.env.FORUM_URL || 'https://forum.tenpennynovels.com',
      process.env.MANAGEMENT_URL || 'https://gestione.tenpennynovels.com',
      process.env.TICKETS_URL || 'https://supporto.tenpennynovels.com',
      // Development localhost URLs (in addition to IP-based URLs from env)
      'http://localhost:4000',
      'http://localhost:4001',
      'http://localhost:4002',
      'http://localhost:4003',
      'http://localhost:4004',
      'http://localhost:4005'
    ];
    
    console.log(`🔍 CORS: Allowed origins:`, allowedOrigins);
    console.log(`🔍 CORS: Checking if "${origin}" is in allowed list...`);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log(`✅ CORS: No origin header - allowing request`);
      return callback(null, true);
    }
    
    const isAllowed = allowedOrigins.includes(origin);
    console.log(`🔍 CORS: Origin "${origin}" allowed: ${isAllowed}`);
    
    if (isAllowed) {
      console.log(`✅ CORS: Allowing origin ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS: Blocking origin ${origin}`);
      console.log(`❌ CORS: Available origins:`, allowedOrigins);
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

// Rate limiting handled by Nginx - removed from Express
console.log('🛡️ Rate limiting handled by Nginx reverse proxy');

// Backend service configurations (moved up before body parsing)
const services = {
  auth: {
    target: process.env.AUTH_BACKEND_URL || 'http://localhost:3000'
    // No pathRewrite needed - forward as-is
  },
  game: {
    target: process.env.GAME_BACKEND_URL || 'http://localhost:3001'
    // No pathRewrite needed - forward as-is
  },
  admin: {
    target: process.env.MANAGEMENT_BACKEND_URL || 'http://localhost:3002'
    // No pathRewrite needed - forward as-is
  },
  documents: {
    target: process.env.GAME_BACKEND_URL || 'http://localhost:3001'
    // Documents handled by Game Backend
  },
  forum: {
    target: process.env.GAME_BACKEND_URL || 'http://localhost:3001'
    // Forum handled by Game Backend  
  }
};

// Create proxy middleware for each service
const createServiceProxy = (serviceName: string, config: any) => {
  return createProxyMiddleware({
    target: config.target,
    changeOrigin: true,
    timeout: 10000, // 10 second timeout
    proxyTimeout: 10000, // 10 second proxy timeout
    headers: {
      'X-Forwarded-By': 'TenpennyNovels-Gateway',
      'X-Service-Route': serviceName
    },
    onError: (err, req, res) => {
      const { logger } = require('./utils/logger');
      console.log(`❌ [PROXY ERROR] Service: ${serviceName}`);
      console.log(`   🔗 Target: ${config.target}`);
      console.log(`   📍 URL: ${req.url}`);
      console.log(`   💥 Error: ${err.message}`);
      console.log('   ─────────────────────────────────────────────────────────────');
      
      logger.error(`Proxy error for ${serviceName}:`, {
        error: err.message,
        url: req.url,
        target: config.target
      });
      
      res.status(502).json({
        success: false,
        error: `Service ${serviceName} is temporarily unavailable`,
        code: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      });
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`🔄 [PROXY REQ] Forwarding to ${serviceName}: ${req.method} ${req.url}`);
      
      // Forward cookies and auth headers
      if (req.headers.cookie) {
        proxyReq.setHeader('Cookie', req.headers.cookie);
        console.log(`   🍪 Forwarding cookies: ${req.headers.cookie.substring(0, 100)}...`);
      } else {
        console.log(`   ❌ No cookies to forward`);
      }
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
        console.log(`   🔑 Forwarding authorization header`);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`🔙 [PROXY RES] Response from ${serviceName}: ${proxyRes.statusCode}`);
      
      // Forward set-cookie headers back to client
      if (proxyRes.headers['set-cookie']) {
        res.setHeader('set-cookie', proxyRes.headers['set-cookie']);
        console.log(`   🍪 Forwarding set-cookie headers back to client`);
      }
    }
  });
};

// Route to backend services (PRIORITY: these must come before other middleware)
console.log('🌐 Setting up proxy routes...');

// Debug middleware for /auth route
app.use('/auth', (req, res, next) => {
  console.log(`🔥 AUTH ROUTE HIT: ${req.method} ${req.originalUrl}`);
  next();
});

// Debug middleware for /game route  
app.use('/game', (req, res, next) => {
  console.log(`🎮 GAME ROUTE HIT: ${req.method} ${req.originalUrl}`);
  next();
});

// Debug middleware for other routes
app.use('/forum', (req, res, next) => {
  console.log(`💬 FORUM ROUTE HIT: ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/documents', (req, res, next) => {
  console.log(`📄 DOCUMENTS ROUTE HIT: ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/docs', (req, res, next) => {
  console.log(`📝 DOCS ROUTE HIT: ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/admin', (req, res, next) => {
  console.log(`⚙️ ADMIN ROUTE HIT: ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/auth', createServiceProxy('auth', services.auth));
app.use('/game', createServiceProxy('game', services.game));
app.use('/forum', createServiceProxy('forum', services.forum));
app.use('/documents', createServiceProxy('documents', services.documents));
app.use('/docs', createServiceProxy('documents', services.documents));
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

  console.log(`🔍 [**************] ${req.method} ${req.originalUrl}`);
  
  const startTime = Date.now();
  const originalUrl = req.originalUrl;
  const method = req.method;
  const clientIP = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
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
  } else if (originalUrl.startsWith('/docs')) {
    targetService = 'Game Backend (Documents)';
    targetURL = `${process.env.GAME_BACKEND_URL || 'http://localhost:3001'}${originalUrl}`;
  } else if (originalUrl.startsWith('/admin')) {
    targetService = 'Management Backend';
    targetURL = `${process.env.MANAGEMENT_BACKEND_URL || 'http://localhost:3002'}${originalUrl}`;
  } else {
    console.log(`🔍 [API Gateway route not found] ${req.method} ${req.originalUrl}`);
    res.status(404).json({
      success: false,
      error: 'API Gateway route not found',
      code: 'ROUTE_NOT_FOUND',
      requested_url: req.originalUrl || req.url,
      method: req.method,
    });
    return;
  }
  
  console.log(`🚀 [${new Date().toISOString()}] ${method} ${originalUrl}`);
  console.log(`   📍 Client: ${clientIP} | User-Agent: ${userAgent.substring(0, 50)}...`);
  console.log(`   🎯 Target: ${targetService}`);
  console.log(`   🔗 URL: ${targetURL}`);
  
  // Log response when finished
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const statusEmoji = statusCode >= 200 && statusCode < 300 ? '✅' : 
                       statusCode >= 400 && statusCode < 500 ? '⚠️' : '❌';
    
    console.log(`   ${statusEmoji} Response: ${statusCode} | Duration: ${duration}ms`);
    console.log(`   📊 Data size: ${Buffer.byteLength(data, 'utf8')} bytes`);
    console.log('   ─────────────────────────────────────────────────────────────');
    
    return originalSend.call(this, data);
  };
  
  next();
});

// Health check endpoint for the gateway itself with backend services status
app.get('/health', async (req, res) => {
  const { logger } = require('./utils/logger');
  
  // Gateway health data
  const gatewayHealth = {
    service: 'TenpennyNovels API Gateway',
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
        headers: { 'User-Agent': 'TenpennyNovels-Gateway-Health-Check' }
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
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'TenpennyNovels API Gateway',
      version: '1.0.0',
      description: 'Central API Gateway for TenpennyNovels microservices architecture',
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
  console.log('\n❌ ===== 404 - ROUTE NOT FOUND =====');
  console.log(`🔗 URL: ${req.originalUrl || req.url}`);
  console.log(`📡 Method: ${req.method}`);
  console.log(`🌐 Origin: ${req.get('Origin') || 'No origin'}`);
  console.log(`📍 Client IP: ${req.ip || req.connection.remoteAddress || 'Unknown'}`);
  console.log(`🤖 User-Agent: ${req.get('User-Agent') || 'No user-agent'}`);
  console.log('❌ ===================================\n');
  
  res.status(404).json({
    success: false,
    error: 'API Gateway route not found',
    code: 'ROUTE_NOT_FOUND',
    requested_url: req.originalUrl || req.url,
    method: req.method,
    available_prefixes: ['/auth', '/game', '/forum', '/admin', '/docs', '/documents'],
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const { logger } = require('./utils/logger');
  
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