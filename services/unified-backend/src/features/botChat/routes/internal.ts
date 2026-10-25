import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { appConfig } from '@config/runtime';
import { BotChatController } from '../controllers/BotChatController';

const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});

/** Senza BOT_SERVICE_SECRET l'endpoint non esiste (404), non è "aperto". */
function botServiceAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = appConfig.services.botService.secret;
  if (!expected) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  const provided = req.header('x-bot-service-secret') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  next();
}

router.post('/messages', limiter, botServiceAuth, BotChatController.postMessage);
router.get('/environment', limiter, botServiceAuth, BotChatController.getEnvironment);
router.get('/knowledge/tags', limiter, botServiceAuth, BotChatController.getKnowledgeTags);
router.post('/knowledge', limiter, botServiceAuth, BotChatController.getKnowledge);
router.get('/characters/:id', limiter, botServiceAuth, BotChatController.getCharacterAppearance);

export default router;
