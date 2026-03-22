import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

const DEFAULT_MAX_PER_MINUTE = 30;

export const clientRateLimit = rateLimit({
  windowMs: 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.client?.id || req.ip || 'unknown',
  max: (req: Request) => req.client?.rateLimit?.maxPerMinute ?? DEFAULT_MAX_PER_MINUTE,
  message: (_req: Request, res: Response) => {
    const client = res.req?.client;
    return {
      success: false,
      error: `Rate limit exceeded for client '${client?.id || 'unknown'}' (${client?.rateLimit?.maxPerMinute || DEFAULT_MAX_PER_MINUTE}/min)`,
    };
  },
});
