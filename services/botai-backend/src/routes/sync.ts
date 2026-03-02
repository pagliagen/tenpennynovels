import { Router } from 'express';
import { SyncController } from '../controllers/SyncController';
import { requireBotApiKey } from '../middleware/auth';

const router = Router();

// Sync endpoints - receive webhooks from game-backend

router.post('/sync/action', requireBotApiKey, SyncController.receiveAction);
router.post('/sync/character', requireBotApiKey, SyncController.receiveCharacterUpdate);
router.get('/sync/status', requireBotApiKey, SyncController.getStatus);

export default router;
