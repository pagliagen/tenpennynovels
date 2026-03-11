import { Router, Request, Response } from 'express';
import { ImageGenerationController } from '../controllers/ImageGenerationController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';
import { aiGatewayClient } from '@modules/game/services/AIGatewayClient';

const router = Router();

router.get(
  '/health',
  AdminAuthMiddleware.requireAdminAccess,
  async (_req: Request, res: Response) => {
    const available = await aiGatewayClient.isHealthy();
    res.json({ result: true, data: { available } });
  }
);

router.post(
  '/generate/:entityType/:entityId',
  AdminAuthMiddleware.requireAdminAccess,
  requireViewPermission('image_generation.access'),
  AdminAuthMiddleware.logAdminAction('generate_image', 'image_generation'),
  ImageGenerationController.startGeneration
);

router.get(
  '/active',
  AdminAuthMiddleware.requireAdminAccess,
  requireViewPermission('image_generation.access'),
  ImageGenerationController.getActiveJobs
);

export default router;
