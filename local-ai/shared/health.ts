import { Request, Response } from 'express';

export interface HealthStatus {
  status: 'up' | 'down' | 'stub';
  [key: string]: unknown;
}

export function healthEndpoint(serviceName: string, checks?: () => Promise<Record<string, unknown>>) {
  return async (_req: Request, res: Response) => {
    try {
      const extra = checks ? await checks() : {};
      res.json({ status: 'up', service: serviceName, ...extra });
    } catch (error: any) {
      res.status(503).json({ status: 'down', service: serviceName, error: error.message });
    }
  };
}

export function stubHealthEndpoint(serviceName: string) {
  return (_req: Request, res: Response) => {
    res.json({ status: 'stub', service: serviceName, message: 'Not implemented yet' });
  };
}
