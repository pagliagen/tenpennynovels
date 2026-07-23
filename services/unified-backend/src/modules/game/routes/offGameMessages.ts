import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { OffGameMessageController } from '../controllers/OffGameMessageController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

/**
 * Off-Game Messages Routes (OOC chat - OUT-OF-CHARACTER)
 *
 * Rate Limiting Strategy:
 * - POST /game/offgame-messages: 30 req/min (writing data)
 * - PUT /game/offgame-messages/:id/read: 60 req/min (read marking)
 * - POST /game/offgame-threads/:id/typing: 120 req/min (typing indicators - high frequency)
 * - DELETE /game/offgame-messages/:id: 30 req/min (data modification)
 * - GET endpoints: Managed by API Gateway (read-only)
 *
 * Endpoints:
 * - POST /game/offgame-messages - Send message
 * - GET /game/offgame-threads - List threads (paginated)
 * - GET /game/offgame-threads/:id/messages - Get thread messages (paginated)
 * - PUT /game/offgame-messages/:id/read - Mark message as read
 * - POST /game/offgame-threads/:id/typing - Send typing indicator
 * - DELETE /game/offgame-messages/:id - Delete message (soft delete)
 */

// ✅ SECURITY: Rate limiting for write operations
const sendMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req.ip ?? '') || 'unknown',
  skip: (req) => !req.user,
  handler: (_req, res) => {
    res.status(429).json({
      result: false,
      error: 'Troppe richieste. Aspetta un momento prima di inviare altri messaggi.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60
    });
  }
});

const readMarkerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req.ip ?? '') || 'unknown',
  skip: (req) => !req.user
});

const typingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req.ip ?? '') || 'unknown',
  skip: (req) => !req.user
});

const deleteMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req.ip ?? '') || 'unknown',
  skip: (req) => !req.user
});

// All routes require user auth + character context
router.use(AuthMiddleware.requireUserAuth);
router.use(AuthMiddleware.requireCharacterContext);

// Send off-game message
// All character states allowed (draft, pending, approved)
// ✅ SECURITY: Rate limited (30 req/min)
router.post('/offgame-messages',
  sendMessageLimiter,
  AuthMiddleware.requireGameplayRoles(['player']),
  OffGameMessageController.sendMessage
);

// List threads
// ℹ️ Rate limited by API Gateway
router.get('/offgame-threads',
  OffGameMessageController.listThreads
);

// Get thread messages (paginated)
// Auto-marks messages as read
// ℹ️ Rate limited by API Gateway
router.get('/offgame-threads/:id/messages',
  OffGameMessageController.getThreadMessages
);

// Mark message as read (explicit)
// ✅ SECURITY: Rate limited (60 req/min)
router.put('/offgame-messages/:id/read',
  readMarkerLimiter,
  OffGameMessageController.markAsRead
);

// Send typing indicator
// Throttle: Client should throttle to max 1 emit per 2 seconds
// ✅ SECURITY: Rate limited (120 req/min for high-frequency updates)
router.post('/offgame-threads/:id/typing',
  typingLimiter,
  OffGameMessageController.sendTypingIndicator
);

// Delete message (soft delete)
// Sender only, 5-minute time limit
// ✅ SECURITY: Rate limited (30 req/min)
router.delete('/offgame-messages/:id',
  deleteMessageLimiter,
  OffGameMessageController.deleteMessage
);

export default router;
