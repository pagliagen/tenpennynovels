import { Router } from 'express';
import { ChatModerationController } from '../controllers/ChatModerationController';
import { CharacterAuthMiddleware } from '../middleware/characterAuth';

const router = Router();

// Apply character auth middleware to all routes
router.use(CharacterAuthMiddleware.requireCharacterAccess);

// Player reporting functionality
router.post('/chat/report-message',
  ChatModerationController.reportMessage
);

// Player report management
router.get('/chat/my-reports',
  ChatModerationController.getMyReports
);

// Player moderation action visibility
router.get('/chat/moderation-actions',
  ChatModerationController.getMyModerationActions
);

// Appeal system
router.post('/chat/moderation-actions/:actionId/appeal',
  ChatModerationController.appealModerationAction
);

// Chat permissions check
router.get('/chat/can-chat',
  ChatModerationController.canChat
);

export default router;