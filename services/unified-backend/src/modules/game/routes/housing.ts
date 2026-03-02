import { Router } from 'express';
import { HousingController } from '../controllers/HousingController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

// Housing routes
router.get('/districts', HousingController.getDistricts);
router.get('/available/:district', HousingController.getAvailableProperties);

// Apply character auth middleware to these routes
router.get('/my-properties', AuthMiddleware.requireCharacterAuth, HousingController.getMyProperties);
router.get('/:propertyId', AuthMiddleware.requireCharacterAuth, HousingController.getPropertyDetails);

// Property transactions (require auth)
router.post('/rent', AuthMiddleware.requireCharacterAuth, HousingController.rentProperty);
router.post('/purchase', AuthMiddleware.requireCharacterAuth, HousingController.purchaseProperty);
router.post('/:propertyId/pay-rent', AuthMiddleware.requireCharacterAuth, HousingController.payRent);

// Property management (require auth)
router.put('/:propertyId/guests', AuthMiddleware.requireCharacterAuth, HousingController.manageGuests);

export { router as housingRoutes };