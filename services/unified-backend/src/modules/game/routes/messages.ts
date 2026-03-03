import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { banChecks } from '@shared/middleware/banCheck';
import { requireGamePermission } from '../middleware/gamePermissions';
import { MessageController } from '../controllers/MessageController';
import { OnGameMessageController } from '../controllers/OnGameMessageController';

const router = Router();

// Direct Messages routes (OOC - Out of Character)
router.post('/messages/send',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:messages:send'),
  MessageController.sendOnGameMessage
);

router.get('/messages/inbox',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:messages:read'),
  MessageController.getInbox
);

router.get('/messages/sent',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:messages:read'),
  MessageController.getSentMessages
);

router.get('/messages/:messageId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:messages:read'),
  MessageController.readMessage
);

router.delete('/messages/:messageId',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:messages:delete'),
  MessageController.deleteMessage
);

router.get('/messages/unread-count',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:messages:read'),
  MessageController.getUnreadCount
);

// OnGame Messages routes (Victorian postal system - IN-CHARACTER)
router.post('/ongame-messages',
  AuthMiddleware.requireCharacterAuth,
  banChecks.chat(), // Check if user is banned from chat (includes postal system)
  requireGamePermission('game:postal:send'), // BLOCKED for DRAFT
  OnGameMessageController.sendMessage
);

router.get('/ongame-messages/inbox',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:postal:read'),
  OnGameMessageController.getInbox
);

router.get('/ongame-messages/outbox',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:postal:read'),
  OnGameMessageController.getOutbox
);

router.patch('/ongame-messages/:id/read',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:postal:read'),
  OnGameMessageController.markAsRead
);

router.delete('/ongame-messages/:id',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:postal:delete'),
  OnGameMessageController.deleteMessage
);

router.get('/ongame-messages/types',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:postal:types'),
  OnGameMessageController.getMessageTypes
);

router.get('/ongame-messages/threads',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:postal:threads'),
  OnGameMessageController.getThreads
);

router.get('/ongame-messages/thread/:partnerId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:postal:threads'),
  OnGameMessageController.getThreadMessages
);

export default router;