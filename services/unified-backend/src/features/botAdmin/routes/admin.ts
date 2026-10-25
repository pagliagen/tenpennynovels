import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AdminAuthMiddleware } from '@modules/admin/middleware/adminAuth';
import { BotAdminController } from '../controllers/BotAdminController';

const router = express.Router();

// Le generazioni sono lente: limite per IP più basso delle altre rotte admin.
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
}));
router.use(AdminAuthMiddleware.requireAdminAccess);

router.get('/',
  AdminAuthMiddleware.requireGranularPermission('characters.detail.read'),
  BotAdminController.list
);

// Genera una bozza (SSE). Non salva nulla.
router.post('/design',
  AdminAuthMiddleware.requireGranularPermission('characters.detail.edit'),
  AdminAuthMiddleware.logAdminAction('design_bot', 'bot_admin'),
  BotAdminController.design
);

// Crea un personaggio approvato: serve il permesso di approvare, non solo di modificare.
router.post('/',
  AdminAuthMiddleware.requireGranularPermission('characters.detail.approve'),
  AdminAuthMiddleware.logAdminAction('create_bot', 'bot_admin'),
  BotAdminController.create
);

export default router;
