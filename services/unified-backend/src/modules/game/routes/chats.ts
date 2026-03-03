import { Router } from 'express';
import { LocationChatsController } from '../controllers/LocationChatsController';
import { AuthMiddleware } from '../middleware/auth';
import { requireGamePermission } from '../middleware/gamePermissions';

const router = Router();

// Chat messages in locations
router.post('/',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:send'), // BLOCKED for DRAFT
  LocationChatsController.createMessage
);

router.get('/:locationId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:read'),
  LocationChatsController.getMessages
);

router.patch('/:messageId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:edit'),
  LocationChatsController.updateMessage
);

router.delete('/:messageId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:delete'),
  LocationChatsController.deleteMessage
);

// Social conflicts (skill-based interactions)
router.post('/social-conflict',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:social-conflicts'),
  LocationChatsController.createSocialConflict
);

// Admin operations
router.delete('/:locationId/clear',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:moderation:chat:clear'),
  LocationChatsController.clearChat
);

// Bot integration (requires BOT_API_KEY)
router.post('/bot', LocationChatsController.createBotMessage);

export default router;
