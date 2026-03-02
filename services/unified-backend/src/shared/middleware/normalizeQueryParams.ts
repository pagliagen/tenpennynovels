import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to normalize query parameters from string | string[] to string
 *
 * Express allows duplicate query params which become arrays:
 * Example: GET /api?id=1&id=2 → req.query.id = ["1", "2"]
 *
 * This middleware always takes the FIRST element if array.
 *
 * Design Decision: Bulk operations should use POST body, not query params.
 * This ensures predictable behavior and type safety across all controllers.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 */
export function normalizeQueryParams(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.query && typeof req.query === 'object') {
    for (const key in req.query) {
      const value = req.query[key];
      if (Array.isArray(value)) {
        // Take first element, discard rest
        req.query[key] = value[0];
      }
    }
  }
  next();
}
