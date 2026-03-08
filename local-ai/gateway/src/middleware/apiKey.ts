import { Request, Response, NextFunction } from 'express';
import { resolveClient, ClientConfig } from '../clients';

declare global {
  namespace Express {
    interface Request {
      client?: ClientConfig;
    }
  }
}

/**
 * Resolves the calling client from X-API-Key + optional X-Client-Id.
 * Attaches the client config to req.client for downstream use.
 */
export function authenticateClient(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  const clientId = req.headers['x-client-id'] as string | undefined;

  if (!apiKey) {
    res.status(401).json({ success: false, error: 'Missing X-API-Key header' });
    return;
  }

  const client = resolveClient(apiKey, clientId);
  if (!client) {
    res.status(401).json({ success: false, error: 'Invalid API key or client mismatch' });
    return;
  }

  req.client = client;
  next();
}

/**
 * Checks if the authenticated client has permission for a given service prefix.
 */
export function requirePermission(servicePrefix: string) {
  const serviceName = servicePrefix.replace(/^\//, '');
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.client) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!req.client.permissions.includes(serviceName)) {
      res.status(403).json({
        success: false,
        error: `Client '${req.client.id}' does not have permission for '${serviceName}'`,
      });
      return;
    }

    next();
  };
}
