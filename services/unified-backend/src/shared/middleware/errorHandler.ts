import { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';
import { errorResponse } from '../utils/apiResponse';
import {
  translateMongooseError,
  translateDuplicateKeyError,
  translateCastError
} from '../utils/validation';
import { ErrorCode } from '../utils/errorCodes';
import { logger } from '../utils/logger';

/**
 * ✅ Error Handler Centralizzato
 *
 * Cattura TUTTI gli errori dai controller e li formatta in modo standard.
 * - Mongoose ValidationError → errori italiani con details
 * - Mongoose CastError (ObjectId invalido) → INVALID_FORMAT
 * - MongoDB Duplicate Key (code: 11000) → USERNAME_TAKEN / EMAIL_TAKEN
 * - JWT Errors → TOKEN_INVALID / TOKEN_EXPIRED
 * - Generic Error → fallback con status code
 *
 * IMPORTANTE: Questo middleware deve essere montato DOPO tutte le route in app.ts
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Ottieni requestId (se presente)
  const requestId = res.locals.requestId || 'unknown';

  // Log errore con requestId per tracking
  logger.error(`[${requestId}] Error: ${err.message}`, {
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params
  });

  // ===== Mongoose Validation Error =====
  if (err.name === 'ValidationError' && err instanceof MongooseError.ValidationError) {
    const { message, code, details } = translateMongooseError(err);
    return errorResponse(res, message, code, details, 400);
  }

  // ===== Mongoose Cast Error (ObjectId invalido) =====
  if (err.name === 'CastError') {
    const { message, code, details } = translateCastError(err);
    return errorResponse(res, message, code, details, 400);
  }

  // ===== MongoDB Duplicate Key Error (code: 11000) =====
  if (err.code === 11000 && err.keyPattern) {
    const { message, code, details } = translateDuplicateKeyError(err);
    return errorResponse(res, message, code, details, 409);
  }

  // ===== JWT Errors =====
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(
      res,
      'Token non valido',
      ErrorCode.TOKEN_INVALID,
      { reason: err.message },
      401
    );
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(
      res,
      'Token scaduto',
      ErrorCode.TOKEN_EXPIRED,
      { expiredAt: err.expiredAt },
      401
    );
  }

  // ===== Express Validator Errors =====
  if (err.array && typeof err.array === 'function') {
    const validationErrors = err.array();
    const details: Record<string, string> = {};

    validationErrors.forEach((error: any) => {
      details[error.param || error.path] = error.msg;
    });

    return errorResponse(
      res,
      'Errore di validazione',
      ErrorCode.VALIDATION_ERROR,
      details,
      400
    );
  }

  // ===== Custom Error with Code (già formattato) =====
  if (err.code && Object.values(ErrorCode).includes(err.code)) {
    return errorResponse(
      res,
      err.message,
      err.code,
      err.details,
      err.statusCode || 400
    );
  }

  // ===== Generic Error (fallback) =====
  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || ErrorCode.INTERNAL_SERVER_ERROR;
  const message = statusCode === 500
    ? 'Errore interno del server'
    : err.message || 'Errore sconosciuto';

  return errorResponse(res, message, code, undefined, statusCode);
}

/**
 * ✅ Not Found Handler (404)
 *
 * Cattura tutte le route non esistenti.
 * IMPORTANTE: Montare PRIMA di errorHandler in app.ts
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  errorResponse(
    res,
    `Endpoint non trovato: ${req.method} ${req.path}`,
    ErrorCode.RESOURCE_NOT_FOUND,
    {
      method: req.method,
      path: req.path
    },
    404
  );
}
