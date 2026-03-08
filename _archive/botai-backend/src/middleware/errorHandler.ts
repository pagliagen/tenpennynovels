import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/apiResponse';
import { logger } from '../utils/logger';

/**
 * Global error handler middleware
 * Catches all unhandled errors and returns standardized error response
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Unhandled error:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method
  });

  // Mongoose validation errors
  if (error.name === 'ValidationError') {
    res.status(400).json(errorResponse(
      'Validation failed',
      'VALIDATION_ERROR',
      { details: error.message }
    ));
    return;
  }

  // Mongoose cast errors (invalid ObjectId)
  if (error.name === 'CastError') {
    res.status(400).json(errorResponse(
      'Invalid ID format',
      'INVALID_ID',
      { details: error.message }
    ));
    return;
  }

  // Duplicate key errors
  if (error.name === 'MongoServerError' && (error as any).code === 11000) {
    res.status(409).json(errorResponse(
      'Resource already exists',
      'DUPLICATE_ERROR',
      { details: error.message }
    ));
    return;
  }

  // Default error
  res.status(500).json(errorResponse(
    'Internal server error',
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'development' ? { details: error.message } : undefined
  ));
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(errorResponse(
    `Route ${req.method} ${req.path} not found`,
    'NOT_FOUND'
  ));
}
