import { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';
import type { ErrorResponse } from '@shared/types/responses';
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
    res.status(400).json({ success: false, error: message, code, details });
    return;
  }

  // ===== Mongoose Cast Error (ObjectId invalido) =====
  if (err.name === 'CastError') {
    const { message, code, details } = translateCastError(err);
    res.status(400).json({ success: false, error: message, code, details });
    return;
  }

  // ===== MongoDB Duplicate Key Error (code: 11000) =====
  if (err.code === 11000 && err.keyPattern) {
    const { message, code, details } = translateDuplicateKeyError(err);
    res.status(409).json({ success: false, error: message, code, details });
    return;
  }

  // ===== JWT Errors =====
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: 'Token non valido',
      code: ErrorCode.TOKEN_INVALID,
      details: { reason: err.message }
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: 'Token scaduto',
      code: ErrorCode.TOKEN_EXPIRED,
      details: { expiredAt: err.expiredAt }
    });
    return;
  }

  // ===== Express Validator Errors =====
  if (err.array && typeof err.array === 'function') {
    const validationErrors = err.array();
    const details: Record<string, string> = {};

    validationErrors.forEach((error: any) => {
      details[error.param || error.path] = error.msg;
    });

    res.status(400).json({
      success: false,
      error: 'Errore di validazione',
      code: ErrorCode.VALIDATION_ERROR,
      details
    });
    return;
  }

  // ===== Custom Error with Code (già formattato) =====
  if (err.code && Object.values(ErrorCode).includes(err.code)) {
    res.status(err.statusCode || 400).json({
      success: false,
      error: err.message,
      code: err.code,
      details: err.details
    });
    return;
  }

  // ===== Generic Error (fallback) =====
  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || ErrorCode.INTERNAL_SERVER_ERROR;
  const message = statusCode === 500
    ? 'Errore interno del server'
    : err.message || 'Errore sconosciuto';

  res.status(statusCode).json({ success: false, error: message, code });
}

/**
 * ✅ Not Found Handler (404)
 *
 * Cattura tutte le route non esistenti.
 * IMPORTANTE: Montare PRIMA di errorHandler in app.ts
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  res.status(404).json({
    success: false,
    error: `Endpoint non trovato: ${req.method} ${req.path}`,
    code: ErrorCode.RESOURCE_NOT_FOUND,
    details: {
      method: req.method,
      path: req.path
    }
  });
}
