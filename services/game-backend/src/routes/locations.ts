import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { banChecks } from '../../../../packages/shared/src/middleware/banCheck';
import { LocationController } from '../controllers/LocationController';
import { LocationActionsController } from '../controllers/LocationActionsController';

const router = Router();

// Location routes (require character auth)
router.get('/locations', 
  AuthMiddleware.requireCharacterAuth, 
  LocationController.getAccessibleLocations
);

router.get('/locations/:locationId', 
  AuthMiddleware.requireCharacterAuth, 
  LocationController.getLocation
);

router.post('/locations/:locationId/enter', 
  AuthMiddleware.requireCharacterAuth,
  banChecks.game(), // Check if user is banned from game
  LocationController.enterLocation
);

router.get('/locations/:locationId/access', 
  AuthMiddleware.requireCharacterAuth, 
  LocationController.checkAccess
);

router.post('/locations/:locationId/grant-access', 
  AuthMiddleware.requireCharacterAuth, 
  LocationController.grantAccess
);

// Location actions routes (HTTP-based for security)
router.post('/locations/actions', 
  AuthMiddleware.requireCharacterAuth,
  banChecks.chat(), // Check if user is banned from chat (covers location messages)
  LocationActionsController.createAction
);

router.get('/locations/actions/:locationId', 
  AuthMiddleware.requireCharacterAuth, 
  LocationActionsController.getLocationActions
);

export default router;