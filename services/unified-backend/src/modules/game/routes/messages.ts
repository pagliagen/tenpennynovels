import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { banChecks } from '@shared/middleware/banCheck';
import { MessageController } from '../controllers/MessageController';
import { OnGameMessageController } from '../controllers/OnGameMessageController';

const router = Router();

// Message routes (require character auth)
router.post('/messages/send',
  AuthMiddleware.requireCharacterAuth,
  MessageController.sendOnGameMessage
);

router.get('/messages/inbox', 
  AuthMiddleware.requireCharacterAuth, 
  MessageController.getInbox
);

router.get('/messages/sent', 
  AuthMiddleware.requireCharacterAuth, 
  MessageController.getSentMessages
);

router.get('/messages/:messageId', 
  AuthMiddleware.requireCharacterAuth, 
  MessageController.readMessage
);

router.delete('/messages/:messageId', 
  AuthMiddleware.requireUserAuth, 
  MessageController.deleteMessage
);

router.get('/messages/unread-count', 
  AuthMiddleware.requireCharacterAuth, 
  MessageController.getUnreadCount
);

// OnGame Messages routes (Victorian postal system)
router.post('/ongame-messages', 
  AuthMiddleware.requireCharacterAuth,
  banChecks.chat(), // Check if user is banned from chat (includes postal system)
  OnGameMessageController.sendMessage
);

router.get('/ongame-messages/inbox', 
  AuthMiddleware.requireCharacterAuth, 
  OnGameMessageController.getInbox
);

router.get('/ongame-messages/outbox', 
  AuthMiddleware.requireCharacterAuth, 
  OnGameMessageController.getOutbox
);

router.patch('/ongame-messages/:id/read', 
  AuthMiddleware.requireCharacterAuth, 
  OnGameMessageController.markAsRead
);

router.delete('/ongame-messages/:id', 
  AuthMiddleware.requireCharacterAuth, 
  OnGameMessageController.deleteMessage
);

router.get('/ongame-messages/types', 
  AuthMiddleware.requireCharacterAuth, 
  OnGameMessageController.getMessageTypes
);

router.get('/ongame-messages/threads', 
  AuthMiddleware.requireCharacterAuth, 
  OnGameMessageController.getThreads
);

router.get('/ongame-messages/thread/:partnerId', 
  AuthMiddleware.requireCharacterAuth, 
  OnGameMessageController.getThreadMessages
);

export default router;