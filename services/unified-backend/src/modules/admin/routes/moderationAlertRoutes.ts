import { Router } from 'express';
import { ModerationAlertController } from '../controllers/ModerationAlertController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

router.use(AdminAuthMiddleware.requireAdminAccess);

router.get('/alerts/stats', ModerationAlertController.getStats);
router.get('/alerts', ModerationAlertController.getAlerts);
router.get('/alerts/:id', ModerationAlertController.getAlertById);
router.patch('/alerts/:id/review', ModerationAlertController.reviewAlert);

export default router;
