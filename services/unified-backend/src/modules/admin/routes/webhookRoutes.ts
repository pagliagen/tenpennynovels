import { Router } from 'express';
import { AuthMiddleware } from '@modules/game/middleware/auth';
import { ImageGenerationController } from '../controllers/ImageGenerationController';

const router = Router();

// AI Gateway webhooks (authenticated via AI_GATEWAY_WEBHOOK_SECRET)
const aiGateway = Router();
aiGateway.use(AuthMiddleware.requireAIGatewayAuth);
aiGateway.post('/image-gen/callback', ImageGenerationController.handleCallback);

router.use('/ai', aiGateway);

export { router as webhookRoutes };
