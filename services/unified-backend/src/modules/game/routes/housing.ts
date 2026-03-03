import { Router } from 'express';
import { HousingController } from '../controllers/HousingController';
import { AuthMiddleware } from '../middleware/auth';
import { requireGamePermission } from '../middleware/gamePermissions';

const router = Router();

// Housing routes (public - no auth, no permission check)
router.get('/districts',
  HousingController.getDistricts
);

router.get('/available/:district',
  HousingController.getAvailableProperties
);

// Character-specific routes (require character auth)
router.get('/my-properties',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:housing:my-properties'),
  HousingController.getMyProperties
);

router.get('/:propertyId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:housing:read'),
  HousingController.getPropertyDetails
);

// Property transactions (require auth)
router.post('/rent',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:housing:rent'),
  HousingController.rentProperty
);

router.post('/purchase',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:housing:purchase'),
  HousingController.purchaseProperty
);

router.post('/:propertyId/pay-rent',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:housing:pay-rent'),
  HousingController.payRent
);

// Property management (require auth)
router.put('/:propertyId/guests',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:housing:manage-guests'),
  HousingController.manageGuests
);

export { router as housingRoutes };