import { Router } from 'express';
import { AuthMiddleware } from '@modules/game/middleware/auth';
import { AIWebhookController } from '@modules/game/controllers/AIWebhookController';

const router = Router();

router.post('/bot-response',
  AuthMiddleware.requireAIGatewayAuth,
  AIWebhookController.handleBotResponse,
);

export default router;
