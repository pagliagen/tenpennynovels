import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { GameController } from '../controllers/GameController';

const router = Router();

// Game initialization and validation routes (require character auth)
router.post('/init', 
  AuthMiddleware.requireCharacterAuth, 
  GameController.initGame
);

router.get('/ping', 
  AuthMiddleware.requireCharacterAuth, 
  GameController.ping
);

router.get('/presence', 
  AuthMiddleware.requireCharacterAuth, 
  GameController.getGlobalPresence
); 

export default router;