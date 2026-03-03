import { Router } from 'express';
import { ChatModerationController } from '../controllers/ChatModerationController';
import { AuthMiddleware } from '../middleware/auth';
import { requireGamePermission } from '../middleware/gamePermissions';

const router = Router();

// Apply character auth middleware to all routes
router.use(AuthMiddleware.requireCharacterAuth);

// Player reporting functionality
router.post('/chat/report-message',
  requireGamePermission('game:moderation:report:send'),
  ChatModerationController.reportMessage
);

// Player report management
router.get('/chat/my-reports',
  requireGamePermission('game:moderation:report:read:own'),
  ChatModerationController.getMyReports
);

// Player moderation action visibility
router.get('/chat/moderation-actions',
  requireGamePermission('game:moderation:actions:read:own'),
  ChatModerationController.getMyModerationActions
);

// Appeal system
router.post('/chat/moderation-actions/:actionId/appeal',
  requireGamePermission('game:moderation:appeal:send'),
  ChatModerationController.appealModerationAction
);

// Chat permissions check
router.get('/chat/can-chat',
  requireGamePermission('game:moderation:check:chat-status'),
  ChatModerationController.canChat
);

export default router;