import { Router } from 'express';
import { ChatController } from '../controllers/ChatController';
import { AuthMiddleware } from '../middleware/auth';
import { requireGamePermission } from '../middleware/gamePermissions';

const router = Router();

// Semantic search in chat messages
router.get('/search',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:chat:read'),
  ChatController.searchChat
);

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

// TiroContrapposto (confrontation-attack/-reaction/force-confrontation-outcome):
// spostate in features/confronti/routes/game.ts, montate su questo stesso
// prefisso da bootstrapFeatures(). /social-conflict (meccanica "Raggirare"
// legacy) eliminata: nessun chiamante frontend, sostituita dal sistema
// TiroContrapposto attuale.

// Admin operations
router.delete('/:locationId/clear',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:moderation:chat:clear'),
  ChatController.clearChat
);

export default router;
