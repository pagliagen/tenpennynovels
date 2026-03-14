import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/auth';
import { logger } from '../utils/logger';
import { errorResponse, getRequestId } from '../utils/apiResponse';

export class ErrorHandler {
  /**
   * Global error handling middleware
   */
  static handle(error: Error, req: Request, res: Response, next: NextFunction): void {
    logger.error('Unhandled error:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Don't expose internal errors in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(500).json(errorResponse(
      isDevelopment ? error.message : 'Errore interno del server',
      'INTERNAL_SERVER_ERROR',
      isDevelopment && error.stack ? {
        stack: error.stack.split('\n').slice(0, 10) // Limit stack trace
      } : undefined,
      500,
      getRequestId(req)
    ));
  }

  /**
   * Handle 404 errors for unmatched routes
   */
  static notFound(req: Request, res: Response): void {
    res.status(404).json(errorResponse(
      'Endpoint not found',
      'NOT_FOUND',
      {
        method: req.method,
        path: req.path,
        availableEndpoints: {
          POST: ['/auth/register', '/auth/login', '/auth/logout'],
          GET: ['/auth/session', '/auth/profile', '/auth/security/sessions'],
          PUT: ['/auth/profile'],
          DELETE: ['/auth/security/sessions/:sessionId']
        }
      },
      404,
      getRequestId(req)
    ));
  }

  /**
   * Async error wrapper for route handlers
   */
  static asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}