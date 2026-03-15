/**
 * Response Middleware - Auto-inject metadata
 *
 * Automatically adds timestamp and requestId to ALL JSON responses.
 * Controllers can focus on business logic, middleware handles cross-cutting concerns.
 *
 * @module shared/middleware/responseMiddleware
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Response middleware that auto-injects timestamp and requestId
 *
 * Usage:
 * ```typescript
 * app.use(responseMiddleware);
 *
 * // In controller:
 * return res.status(200).json({
 *   success: true,
 *   data: user
 * });
 * // Middleware auto-adds: timestamp, requestId
 * ```
 */
export function responseMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = function (body: any): Response {
    // Auto-inject metadata if not already present
    const enhanced = {
      ...body,
      timestamp: body.timestamp || new Date().toISOString(),
      requestId: body.requestId || res.locals.requestId || req.headers['x-request-id']
    };

    return originalJson(enhanced);
  };

  next();
}
