import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { GameController } from '../controllers/GameController';
import { EnvironmentController } from '../controllers/EnvironmentController';
import { requireGamePermission } from '../middleware/gamePermissions';

const router = Router();

// Game initialization and validation routes (require character auth)
router.post('/init',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:session:init'),
  GameController.initGame
);

router.get('/presence',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:presence:read'),
  GameController.getGlobalPresence
);

// Environment data (public - no auth required, no permission check)
router.get('/environment',
  EnvironmentController.getEnvironment
);

export default router;