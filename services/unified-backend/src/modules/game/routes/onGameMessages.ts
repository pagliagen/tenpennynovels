import { Router } from 'express';
import { OnGameMessageController } from '../controllers/OnGameMessageController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

/**
 * On-Game Messages Routes (Victorian postal system - IN-CHARACTER)
 *
 * Endpoints:
 * - POST /game/messages - Send message (multi-recipient support)
 * - GET /game/messages/inbox - List received messages (paginated)
 * - GET /game/messages/sent - List sent messages (paginated)
 * - GET /game/ongame-threads - List all threads (paginated)
 * - GET /game/ongame-threads/:id - Get thread with messages
 * - DELETE /game/messages/:id - Soft delete message
 */

// All routes require user auth + character context
router.use(AuthMiddleware.requireUserAuth);
router.use(AuthMiddleware.requireCharacterContext);

// Send on-game message (multi-recipient support)
// BLOCKED for DRAFT characters (only APPROVED can send)
router.post('/messages',
  AuthMiddleware.requireGameplayRoles(['player']),
  OnGameMessageController.sendMessage
);

// Get inbox (received messages)
router.get('/messages/inbox',
  OnGameMessageController.getInbox
);

// Get sent messages
router.get('/messages/sent',
  OnGameMessageController.getSent
);

// List all threads (paginated)
router.get('/ongame-threads',
  OnGameMessageController.getThreads
);

// Get thread with messages
router.get('/ongame-threads/:id',
  OnGameMessageController.getThread
);

// Delete message (soft delete)
// Sender: 5-minute time limit (unless master)
// Recipient: always allowed
router.delete('/messages/:id',
  OnGameMessageController.deleteMessage
);

export default router;
