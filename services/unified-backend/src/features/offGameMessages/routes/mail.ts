import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { OffGameMailController } from '../controllers/OffGameMailController';
import { AdminAuthMiddleware } from '@modules/admin/middleware/adminAuth';

const router = Router();

// CodeQL "Missing rate limiting": queste route non hanno auth (vedi
// manifest.ts, debito accettato pre-esistente, task dedicato separato
// da fare — non affrontato qui). Il rate limiting IP-based sotto è
// un fix mirato solo al finding CodeQL, non sostituisce l'auth mancante.
const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
  handler: (_req, res) => {
    res.status(429).json({
      result: false,
      error: 'Troppe richieste, riprova più tardi.',
      code: 'MAIL_RATE_LIMIT_EXCEEDED'
    });
  }
});

// Le 3 route distruttive avevano già AdminAuthMiddleware.sensitiveOperationLimit()
// (Redis, 10/ora) ma CodeQL non lo riconosce come rate limiting — la sua analisi
// statica cerca specificamente il pattern express-rate-limit. Questo limiter si
// aggiunge, non sostituisce: prima linea di difesa economica riconosciuta da
// CodeQL, il controllo Redis più severo resta a valle.
const destructiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
  handler: (_req, res) => {
    res.status(429).json({
      result: false,
      error: 'Troppe richieste, riprova più tardi.',
      code: 'MAIL_RATE_LIMIT_EXCEEDED'
    });
  }
});

// ==============================
// OffGame Mail Routes
// ==============================

// List OffGame messages with filters
router.get('/offgame', readLimiter, OffGameMailController.getMessages);

// Get OffGame statistics
router.get('/offgame/stats', readLimiter, OffGameMailController.getStats);

// Get single OffGame message
router.get('/offgame/:id', readLimiter, OffGameMailController.getMessage);

// Hard delete OffGame message (permanent)
router.delete('/offgame/:id/hard', destructiveLimiter, AdminAuthMiddleware.sensitiveOperationLimit(), OffGameMailController.hardDelete);

// Soft delete OffGame message
router.post('/offgame/:id/soft-delete', destructiveLimiter, AdminAuthMiddleware.sensitiveOperationLimit(), OffGameMailController.softDelete);

// Bulk delete OffGame messages
router.post('/offgame/bulk-delete', destructiveLimiter, AdminAuthMiddleware.sensitiveOperationLimit(), OffGameMailController.bulkDelete);

export default router;
