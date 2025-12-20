import { Router } from 'express';
import { SessionManagementController } from '../controllers/SessionManagementController';
import { CharacterAuthMiddleware } from '../middleware/characterAuth';

const router = Router();

// Apply character auth middleware to all routes
router.use(CharacterAuthMiddleware.requireCharacterAccess);

// Session management routes

// Master session management
router.post('/sessions', 
  CharacterAuthMiddleware.requireCharacterRole('master'),
  SessionManagementController.createSession
);

router.get('/sessions', 
  CharacterAuthMiddleware.requireCharacterRole('master'),
  SessionManagementController.getMasterSessions
);

router.post('/sessions/:sessionId/start',
  CharacterAuthMiddleware.requireCharacterRole('master'),
  SessionManagementController.startSession
);

router.post('/sessions/:sessionId/end',
  CharacterAuthMiddleware.requireCharacterRole('master'),
  SessionManagementController.endSession
);

// Player session participation
router.get('/sessions/public',
  SessionManagementController.getPublicSessions
);

router.post('/sessions/:sessionId/join',
  SessionManagementController.joinSession
);

// Session templates
router.get('/session-templates',
  CharacterAuthMiddleware.requireCharacterRole('master'),
  SessionManagementController.getSessionTemplates
);

export default router;