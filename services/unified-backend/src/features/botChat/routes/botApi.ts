import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { BotChatController } from '../controllers/BotChatController';
import { botTokenAuth, botTokenScope } from '../utils/botTokenAuth';

/**
 * API a cui il servizio AI risponde (`/bot-api/*`, inoltrata dall'api-gateway). Si autentica con un token per evento
 * (vedi `utils/botToken.ts`): niente chiave permanente fuori dal server.
 */

const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});

router.post('/messages', limiter, botTokenAuth, botTokenScope, BotChatController.postMessage);
router.get('/environment', limiter, botTokenAuth, BotChatController.getEnvironment);
router.get('/knowledge/tags', limiter, botTokenAuth, BotChatController.getKnowledgeTags);
router.post('/knowledge', limiter, botTokenAuth, BotChatController.getKnowledge);
router.get('/characters/:id', limiter, botTokenAuth, BotChatController.getCharacterAppearance);

export default router;
