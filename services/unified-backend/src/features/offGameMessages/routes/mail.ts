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
router.delete('/offgame/:id/hard', AdminAuthMiddleware.sensitiveOperationLimit(), OffGameMailController.hardDelete);

// Soft delete OffGame message
router.post('/offgame/:id/soft-delete', AdminAuthMiddleware.sensitiveOperationLimit(), OffGameMailController.softDelete);

// Bulk delete OffGame messages
router.post('/offgame/bulk-delete', AdminAuthMiddleware.sensitiveOperationLimit(), OffGameMailController.bulkDelete);

export default router;
