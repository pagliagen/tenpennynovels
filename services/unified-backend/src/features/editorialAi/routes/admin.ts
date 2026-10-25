import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AdminAuthMiddleware } from '@modules/admin/middleware/adminAuth';
import { requireViewPermission } from '@modules/admin/utils/permissions';
import { EditorialController } from '../controllers/EditorialController';

const router = express.Router();

// Le chiamate al modello sono lente e costose: limite per IP più basso delle altre rotte admin.
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
}));
router.use(AdminAuthMiddleware.requireAdminAccess);

// Revisione di canone: legge sia location sia documenti, servono entrambi i permessi di lettura.
router.get(
  '/canon-check',
  requireViewPermission('locations.read'),
  requireViewPermission('documents.read'),
  AdminAuthMiddleware.logAdminAction('view_canon_check', 'editorial'),
  EditorialController.getCanonCheck
);

export default router;
