import { Router } from 'express';
import { ChatController } from '../controllers/ChatController';
import { AuthMiddleware } from '../middleware/auth';
import { requireGamePermission } from '../middleware/gamePermissions';

const router = Router();

// Chat messages in locations
router.post('/',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:send'), // BLOCKED for DRAFT
  ChatController.createMessage
);

router.get('/:locationId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:read'),
  ChatController.getMessages
);

router.patch('/:actionId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:edit'),
  ChatController.updateMessage
);

router.delete('/:actionId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:delete'),
  ChatController.deleteMessage
);

// Social conflicts (skill-based interactions)
router.post('/social-conflict',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:social-conflicts'),
  ChatController.createSocialConflict
);

// TiroContrapposto - Confrontation system (Phase 1)
router.post('/confrontation-attack',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:social-conflicts'), // Reuse same permission
  ChatController.createConfrontationAttack
);

router.post('/confrontation-reaction',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:social-conflicts'),
  ChatController.handleConfrontationReaction
);

// Master controls
router.post('/force-confrontation-outcome',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:master-action'), // Master-only permission
  ChatController.forceConfrontationOutcome
);

// Admin operations
router.delete('/:locationId/clear',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:moderation:chat:clear'),
  ChatController.clearChat
);

// Bot integration (requires AI_GATEWAY_WEBHOOK_SECRET)
router.post('/bot', ChatController.createBotMessage);

export default router;
