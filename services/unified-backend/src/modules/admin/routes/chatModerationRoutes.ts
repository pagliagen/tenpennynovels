import { Router } from 'express';
import { ChatModerationController } from '../controllers/ChatModerationController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Apply admin auth middleware to all routes
router.use(AdminAuthMiddleware.requireAdminAccess);

// Chat moderation overview and statistics
router.get('/chat/overview',
  ChatModerationController.getChatModerationOverview
);

// Message report management
router.get('/chat/reports',
  ChatModerationController.getReports
);

// Take moderation actions
router.post('/chat/moderation-action',
  ChatModerationController.takeModerationAction
);

// View moderation actions
router.get('/chat/moderation-actions',
  ChatModerationController.getModerationActions
);

// Message search across all systems
router.get('/chat/search-messages',
  ChatModerationController.searchMessages
);

// Appeal resolution
router.put('/chat/moderation-actions/:actionId/resolve-appeal',
  ChatModerationController.resolveAppeal
);

export default router;