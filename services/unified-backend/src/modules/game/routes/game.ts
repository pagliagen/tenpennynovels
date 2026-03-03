import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { GameController } from '../controllers/GameController';
import { TestController } from '../controllers/TestController';
import { EnvironmentController } from '../controllers/EnvironmentController';
import { requireMaster } from '../middleware/requireMaster';
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

// Time advancement (Master only)
router.post('/time/advance',
  AuthMiddleware.requireCharacterAuth,
  requireMaster,
  requireGamePermission('game:admin:time:advance'),
  GameController.advanceTime
);

// ========================================
// TEST ENDPOINTS (Development Only)
// ========================================
if (process.env.NODE_ENV !== 'production') {
  // Custom test event emission
  router.post('/test/emit-event',
    AuthMiddleware.optionalAuth,
    TestController.emitTestEvent
  );

  // Quick predefined test events
  router.post('/test/emit-quick/:type',
    AuthMiddleware.optionalAuth,
    TestController.emitQuickEvent
  );
}

export default router;