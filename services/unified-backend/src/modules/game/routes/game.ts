import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { GameController } from '../controllers/GameController';
import { TestController } from '../controllers/TestController';
import { EnvironmentController } from '../controllers/EnvironmentController';
import { requireMaster } from '../middleware/requireMaster';

const router = Router();

// Game initialization and validation routes (require character auth)
router.post('/init',
  AuthMiddleware.requireCharacterAuth,
  GameController.initGame
);

router.get('/presence',
  AuthMiddleware.requireCharacterAuth,
  GameController.getGlobalPresence
);

// Environment data (public - no auth required)
router.get('/environment',
  EnvironmentController.getEnvironment
);

// Time advancement (Master only)
router.post('/time/advance',
  AuthMiddleware.requireCharacterAuth,
  requireMaster,
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