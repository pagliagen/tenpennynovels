import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/auth';
import { logger } from '../utils/logger';

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
    
    const response: ApiResponse = {
      success: false,
      error: isDevelopment ? error.message : 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString()
    };

    // Add stack trace in development
    if (isDevelopment && error.stack) {
      response.details = {
        stack: error.stack.split('\n').slice(0, 10) // Limit stack trace
      };
    }

    res.status(500).json(response);
  }

  /**
   * Handle 404 errors for unmatched routes
   */
  static notFound(req: Request, res: Response): void {
    const response: ApiResponse = {
      success: false,
      error: 'Endpoint not found',
      code: 'NOT_FOUND',
      details: {
        method: req.method,
        path: req.path,
        availableEndpoints: {
          POST: ['/auth/register', '/auth/login', '/auth/logout'],
          GET: ['/auth/session', '/auth/profile', '/auth/security/sessions'],
          PUT: ['/auth/profile'],
          DELETE: ['/auth/security/sessions/:sessionId']
        }
      },
      timestamp: new Date().toISOString()
    };

    res.status(404).json(response);
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