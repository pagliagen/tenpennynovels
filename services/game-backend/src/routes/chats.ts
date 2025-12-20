import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { banChecks } from '../../../../packages/shared/src/middleware/banCheck';
import { OffGameChatController } from '../controllers/OffGameChatController';

const router = Router();

// OffGame Chat routes (require character auth, but allow DRAFT/PENDING for info sharing)
router.post('/offgame-chats', 
  AuthMiddleware.requireCharacterAuth, 
  OffGameChatController.createChat
);

router.get('/offgame-chats', 
  AuthMiddleware.requireCharacterAuth, 
  OffGameChatController.getChats
);

router.get('/offgame-chats/:id/messages', 
  AuthMiddleware.requireCharacterAuth, 
  OffGameChatController.getChatMessages
);

router.post('/offgame-chats/:id/messages', 
  AuthMiddleware.requireCharacterAuth,
  banChecks.chat(), // Check if user is banned from chat
  OffGameChatController.sendMessage
);

router.patch('/offgame-chats/:id/name', 
  AuthMiddleware.requireCharacterAuth, 
  OffGameChatController.updateChatName
);

router.post('/offgame-chats/:id/leave', 
  AuthMiddleware.requireCharacterAuth, 
  OffGameChatController.leaveChat
);

export default router;