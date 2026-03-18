import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { appConfig } from '@config/runtime';
import { errorResponse, getRequestId } from '@shared/utils/apiResponse';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error details
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    code: err.code,
    url: req.originalUrl,
    method: req.method,
    userId: req.user?.userId,
    characterId: req.character?.characterId
  });
  
  // Default error response
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_ERROR';
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    // MongoDB validation error
    if (err.message.includes('validation failed')) {
      message = 'Invalid input data';
    }
  }
  
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = 'Invalid ID format';
  }
  
  if (err.name === 'MongoServerError' && 'code' in err && (err as unknown as Record<string, unknown>).code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    message = 'Resource already exists';
  }
  
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Token di autenticazione non valido';
  }
  
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token expired';
  }
  
  // Don't expose internal errors in production
  if (statusCode === 500 && appConfig.isProduction) {
    message = 'Internal Server Error';
    code = 'INTERNAL_ERROR';
  }
  
  // Send error response
  res.status(statusCode).json(errorResponse(
    message,
    code,
    !appConfig.isProduction ? { stack: err.stack } : undefined,
    statusCode,
    getRequestId(req)
  ));
}

/**
 * Async error wrapper to catch async route errors
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler
 */
export function notFound(req: Request, res: Response, next: NextFunction) {
  const error = new Error(`Not Found - ${req.originalUrl}`) as AppError;
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  next(error);
}

/**
 * Create operational error
 */
export function createError(message: string, statusCode: number = 500, code?: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = true;
  return error;
}