import { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { logger, httpLoggerStream } from '../utils/logger';
import morgan from 'morgan';

/**
 * Setup all middleware for the application
 */
export async function setupMiddleware(app: Express): Promise<void> {
  // HTTP request logging
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('combined', { stream: httpLoggerStream }));
  } else {
    app.use(morgan('common', { stream: httpLoggerStream }));
  }

  // Fetch rate limit configurations from database
  const { ConfigurationService } = await import('../../../../packages/shared/src/services/ConfigurationService');
  const { getRedisClient } = await import('../config/redis');
  const redis = getRedisClient();
  const configService = new ConfigurationService(redis, logger);

  const authWindowMs = await configService.getConfig('rate_limit_auth_window') || 900000; // 15 min
  const authMax = await configService.getConfig('rate_limit_auth_max') || 100;
  const loginWindowMs = await configService.getConfig('rate_limit_login_window') || 900000; // 15 min
  const loginMax = await configService.getConfig('rate_limit_login_max') || 10;

  logger.info(`✅ Initializing Auth/Login Rate Limiters:`);
  logger.info(`   Auth: ${authMax} requests per ${authWindowMs / 60000} minutes`);
  logger.info(`   Login: ${loginMax} requests per ${loginWindowMs / 60000} minutes`);

  // Rate limiting - Auth endpoints (general API protection)
  const authLimiter = rateLimit({
    windowMs: authWindowMs,
    max: authMax,
    message: {
      success: false,
      error: 'Troppe richieste da questo indirizzo IP, riprova più tardi.',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for admin users
      return req.user?.role === 'admin';
    }
  });

  // Rate limiting - Login attempts (strict brute force protection)
  const loginLimiter = rateLimit({
    windowMs: loginWindowMs,
    max: loginMax,
    message: {
      success: false,
      error: 'Too many authentication attempts, please try again later.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  // Apply rate limiting
  app.use('/api/', authLimiter);
  app.use('/api/auth/', loginLimiter);
  
  // Security headers middleware
  app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    next();
  });
  
  // Request ID middleware for tracing
  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] as string || 
                     Math.random().toString(36).substring(2, 15);
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });
  
  // Request logging middleware
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`, {
      requestId: req.headers['x-request-id'],
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: req.user?.userId,
      characterId: req.character?.characterId
    });
    next();
  });
  
  logger.info('Middleware setup completed');
}