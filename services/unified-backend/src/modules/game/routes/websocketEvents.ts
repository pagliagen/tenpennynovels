import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { WebSocketEventController } from '../controllers/WebSocketEventController';

/**
 * WebSocket Event Routes
 *
 * ✅ SPRINT 4 - WebSocket Event Replay
 *
 * Endpoints for retrieving missed WebSocket events after reconnection.
 */

const router = Router();

// Get events since a specific eventId (for replay after reconnection)
router.get('/events/since/:lastEventId',
  AuthMiddleware.requireCharacterAuth,
  WebSocketEventController.getEventsSince
);

// Get latest eventId (for initialization)
router.get('/events/latest',
  AuthMiddleware.requireCharacterAuth,
  WebSocketEventController.getLatestEventId
);

export default router;
