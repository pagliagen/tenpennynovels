import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { AIWebhookController } from '../controllers/AIWebhookController';

const router = Router();

// Callback from local-ai when bot response is ready
// Protected by AI_GATEWAY_WEBHOOK_SECRET via requireAIGatewayAuth
router.post('/bot-response',
  AuthMiddleware.requireAIGatewayAuth,
  AIWebhookController.handleBotResponse
);

export default router;
