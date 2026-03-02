import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * ✅ Request ID Middleware - OBBLIGATORIO
 *
 * Ogni richiesta DEVE avere un requestId per il tracking.
 * - Se il client invia x-request-id header, lo usa
 * - Altrimenti genera un nuovo UUID
 * - Salva in res.locals.requestId (usato da apiResponse.ts)
 * - Aggiunge header x-request-id alla risposta
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Usa x-request-id se fornito, altrimenti genera nuovo UUID
  const requestId = (req.headers['x-request-id'] as string) || randomUUID();

  // Salva in res.locals per successResponse/errorResponse
  res.locals.requestId = requestId;

  // Aggiungi header alla risposta per client tracking
  res.setHeader('x-request-id', requestId);

  next();
}
