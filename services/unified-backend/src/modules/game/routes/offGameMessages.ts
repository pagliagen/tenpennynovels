import { Router } from 'express';
import { OffGameMessageController } from '../controllers/OffGameMessageController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

/**
 * Off-Game Messages Routes (OOC chat - OUT-OF-CHARACTER)
 *
 * Endpoints:
 * - POST /game/offgame-messages - Send message
 * - GET /game/offgame-threads - List threads (paginated)
 * - GET /game/offgame-threads/:id/messages - Get thread messages (paginated)
 * - PUT /game/offgame-messages/:id/read - Mark message as read
 * - POST /game/offgame-threads/:id/typing - Send typing indicator
 * - DELETE /game/offgame-messages/:id - Delete message (soft delete)
 */

// All routes require user auth + character context
router.use(AuthMiddleware.requireUserAuth);
router.use(AuthMiddleware.requireCharacterContext);

// Send off-game message
// All character states allowed (draft, pending, approved)
router.post('/offgame-messages',
  AuthMiddleware.requireGameplayRoles(['player']),
  OffGameMessageController.sendMessage
);

// List threads
router.get('/offgame-threads',
  OffGameMessageController.listThreads
);

// Get thread messages (paginated)
// Auto-marks messages as read
router.get('/offgame-threads/:id/messages',
  OffGameMessageController.getThreadMessages
);

// Mark message as read (explicit)
router.put('/offgame-messages/:id/read',
  OffGameMessageController.markAsRead
);

// Send typing indicator
// Throttle: Client should throttle to max 1 emit per 2 seconds
router.post('/offgame-threads/:id/typing',
  OffGameMessageController.sendTypingIndicator
);

// Delete message (soft delete)
// Sender only, 5-minute time limit
router.delete('/offgame-messages/:id',
  OffGameMessageController.deleteMessage
);

export default router;
