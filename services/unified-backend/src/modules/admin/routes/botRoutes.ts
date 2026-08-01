import { Router, Request, Response, NextFunction } from 'express';
import { BotController } from '../controllers/BotController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { ConfigurationService } from '@shared/services/ConfigurationService';
import { redis } from '@config/runtime/redis';
import { logger } from '../utils/logger';
import { errorResponse, getRequestId } from '@shared/utils/apiResponse';

const router = Router();

// Tutte le route richiedono auth admin
router.use(AdminAuthMiddleware.requireAdminAccess);

/**
 * Gate: la Gestione Bot è legata al servizio AI, non gestito dal server al momento.
 * Config bot_management_enabled (sezione ai_features), default OFF.
 */
async function requireBotManagementEnabled(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const configService = new ConfigurationService(redis.getClient(), logger);
    const enabled = await configService.getConfig('bot_management_enabled');

    if (!enabled) {
      res.status(403).json(errorResponse(
        'Gestione Bot non disponibile: funzionalità disattivata',
        'BOT_MANAGEMENT_DISABLED',
        undefined,
        403,
        getRequestId(req)
      ));
      return;
    }

    next();
  } catch (error: unknown) {
    logger.error('[botRoutes] Failed to check bot_management_enabled', { error });
    res.status(403).json(errorResponse(
      'Gestione Bot non disponibile: funzionalità disattivata',
      'BOT_MANAGEMENT_DISABLED',
      undefined,
      403,
      getRequestId(req)
    ));
  }
}

router.use(requireBotManagementEnabled);

// Lista e dettaglio bot
router.get('/list', BotController.list);
router.get('/:localAiBotId/detail', BotController.detail);
router.get('/:localAiBotId/memories/:characterId', BotController.characterMemories);

// Aggiorna bot (personalità, etc.)
router.put('/:localAiBotId/update', BotController.update);

// Cambia location del bot
router.put('/:localAiBotId/location', BotController.changeLocation);

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
