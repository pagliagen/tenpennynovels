import { Router } from 'express';
import { LocationPropertyController } from '../controllers/LocationPropertyController';
import { AuthMiddleware } from '../middleware/auth';
import { requireGamePermission } from '../middleware/gamePermissions';

const router = Router();

// Housing routes (public - no auth, no permission check)
router.get('/districts',
  LocationPropertyController.getDistricts
);

router.get('/available/:district',
  LocationPropertyController.getAvailableProperties
);

// Character-specific routes (require character auth)
router.get('/my-properties',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:housing:my-properties'),
  LocationPropertyController.getMyProperties
);

router.get('/:propertyId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:housing:read'),
  LocationPropertyController.getPropertyDetails
);

// Property transactions (require auth)
router.post('/rent',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:housing:rent'),
  LocationPropertyController.rentProperty
);

router.post('/purchase',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:housing:purchase'),
  LocationPropertyController.purchaseProperty
);

router.post('/:propertyId/pay-rent',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:housing:pay-rent'),
  LocationPropertyController.payRent
);

// Property management (require auth)
router.put('/:propertyId/guests',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:housing:manage-guests'),
  LocationPropertyController.manageGuests
);

export { router as locationPropertyRoutes };