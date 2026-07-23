import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { OnGameMessageController } from '../controllers/OnGameMessageController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

/**
 * On-Game Messages Routes (Victorian postal system - IN-CHARACTER)
 *
 * Rate Limiting Strategy:
 * - POST /game/messages: 20 req/min (writing data)
 * - DELETE /game/messages/:id: 30 req/min (data modification)
 * - GET endpoints: Managed by API Gateway (read-only, lower risk)
 *
 * Endpoints:
 * - POST /game/messages - Send message (multi-recipient support)
 * - GET /game/messages/inbox - List received messages (paginated)
 * - GET /game/messages/sent - List sent messages (paginated)
 * - GET /game/ongame-threads - List all threads (paginated)
 * - GET /game/ongame-threads/:id - Get thread with messages
 * - DELETE /game/messages/:id - Soft delete message
 */

// ✅ SECURITY: Rate limiting for write operations (POST/DELETE)
const sendMessageLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 20,              // 20 messages per minute
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req.ip ?? '') || 'unknown',
  skip: (req) => !req.user,  // Skip if not authenticated
  handler: (_req, res) => {
    res.status(429).json({
      result: false,
      error: 'Troppe richieste. Aspetta un momento prima di inviare altri messaggi.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60
    });
  }
});

const deleteMessageLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 30,              // 30 deletions per minute
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req.ip ?? '') || 'unknown',
  skip: (req) => !req.user,
  handler: (_req, res) => {
    res.status(429).json({
      result: false,
      error: 'Troppe richieste. Aspetta un momento prima di eliminare altri messaggi.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60
    });
  }
});

// All routes require user auth + character context
router.use(AuthMiddleware.requireUserAuth);
router.use(AuthMiddleware.requireCharacterContext);

// Send on-game message (multi-recipient support)
// BLOCKED for DRAFT characters (only APPROVED can send)
// ✅ SECURITY: Rate limited (20 req/min)
router.post('/messages',
  sendMessageLimiter,
  AuthMiddleware.requireGameplayRoles(['player']),
  OnGameMessageController.sendMessage
);

// Get inbox (received messages)
// ℹ️ Rate limited by API Gateway
router.get('/messages/inbox',
  OnGameMessageController.getInbox
);

// Get sent messages
// ℹ️ Rate limited by API Gateway
router.get('/messages/sent',
  OnGameMessageController.getSent
);

// List all threads (paginated)
// ℹ️ Rate limited by API Gateway
router.get('/ongame-threads',
  OnGameMessageController.getThreads
);

// Get thread with messages
// ℹ️ Rate limited by API Gateway
router.get('/ongame-threads/:id',
  OnGameMessageController.getThread
);

// Delete message (soft delete)
// Sender: 5-minute time limit (unless master)
// Recipient: always allowed
// ✅ SECURITY: Rate limited (30 req/min)
router.delete('/messages/:id',
  deleteMessageLimiter,
  OnGameMessageController.deleteMessage
);

export default router;
