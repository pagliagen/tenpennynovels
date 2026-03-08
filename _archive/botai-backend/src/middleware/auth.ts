import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/apiResponse';
import { logger } from '../utils/logger';

/**
 * Middleware: Validates internal API key for admin operations
 * Used for bot CRUD operations
 */
export function requireAdminApiKey(req: Request, res: Response, next: NextFunction): void {
  try {
    const apiKey = req.headers['x-admin-api-key'];
    const expectedKey = process.env.ADMIN_BACKEND_BOT_API_KEY;

    if (!expectedKey) {
      throw new Error('ADMIN_BACKEND_BOT_API_KEY not configured');
    }

    if (!apiKey || apiKey !== expectedKey) {
      res.status(401).json(errorResponse(
        'Invalid admin API key',
        'INVALID_ADMIN_BACKEND_BOT_API_KEY'
      ));
      return;
    }

    next();

  } catch (error: any) {
    logger.error('Admin API key validation failed:', error);
    res.status(500).json(errorResponse(
      'Authentication failed',
      'AUTH_ERROR'
    ));
  }
}

/**
 * Middleware: Validates bot API key for sync/webhook operations
 * Used for game-backend webhooks (no auth required for now - trusted network)
 */
export function requireBotApiKey(req: Request, res: Response, next: NextFunction): void {
  // For now, no authentication required for sync endpoints
  // Game-backend is on trusted local network
  // TODO: Add shared secret or IP whitelist if deploying to production
  next();
}

/**
 * Optional: Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });

  next();
}
