import { Router } from 'express';
import { BotController } from '../controllers/BotController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Tutte le route richiedono auth admin
router.use(AdminAuthMiddleware.requireAdminAccess);

// Step 1: avvia generazione bot (sincrono, aspetta local-ai)
router.post('/generate', BotController.generate);

// Step 2: raffinamento iterativo (sincrono)
router.put('/:localAiBotId/refine', BotController.refine);

// Step 3: conferma location + genera character (sincrono, aspetta character-gen)
router.post('/:localAiBotId/confirm', BotController.confirm);

// Cancella bot da local-ai
router.delete('/:localAiBotId', BotController.remove);

// Sync botConfig → local-ai
router.put('/:characterId/sync', BotController.syncToLocalAi);

export { router as botRoutes };
