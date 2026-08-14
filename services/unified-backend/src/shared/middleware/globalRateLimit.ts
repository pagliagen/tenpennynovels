import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { RequestHandler } from 'express';

/**
 * Factory, non singleton: app.ts e core/features/bootstrap.ts montano
 * ognuno la propria istanza (contatori indipendenti) perché CodeQL
 * (js/missing-rate-limiting) non riesce a tracciare un middleware
 * applicato in app.ts fino alle route registrate dinamicamente da
 * bootstrapFeatures() in un altro file — serve un'istanza applicata
 * localmente, nello stesso punto di mount di ciascun router.
 */
export function createGlobalRateLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req.ip ?? ''),
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: 'Troppe richieste, riprova più tardi.',
        code: 'GLOBAL_RATE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString()
      });
    }
  });
}
