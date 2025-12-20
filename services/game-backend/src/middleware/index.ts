import { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { logger, httpLoggerStream } from '../utils/logger';
import morgan from 'morgan';

/**
 * Setup all middleware for the application
 */
export function setupMiddleware(app: Express): void {
  // HTTP request logging
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('combined', { stream: httpLoggerStream }));
  } else {
    app.use(morgan('common', { stream: httpLoggerStream }));
  }
  
  // Rate limiting
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for admin users
      return req.user?.role === 'admin';
    }
  });
  
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 auth requests per windowMs
    message: {
      success: false,
      error: 'Too many authentication attempts, please try again later.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  
  // Apply rate limiting
  app.use('/api/', generalLimiter);
  app.use('/api/auth/', authLimiter);
  
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