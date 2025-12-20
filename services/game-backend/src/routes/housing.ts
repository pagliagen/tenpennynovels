import { Router } from 'express';
import { HousingController } from '../controllers/HousingController';
import { requireCharacterAuth } from '../middleware/auth';

const router = Router();

// Test route to verify routing works
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Housing routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Apply character auth middleware to protected routes only
router.get('/districts', HousingController.getDistricts);
router.get('/available/:district', HousingController.getAvailableProperties);

// Apply character auth middleware to these routes
router.get('/my-properties', requireCharacterAuth, HousingController.getMyProperties);
router.get('/:propertyId', requireCharacterAuth, HousingController.getPropertyDetails);

// Property transactions (require auth)
router.post('/rent', requireCharacterAuth, HousingController.rentProperty);
router.post('/purchase', requireCharacterAuth, HousingController.purchaseProperty);
router.post('/:propertyId/pay-rent', requireCharacterAuth, HousingController.payRent);

// Property management (require auth)
router.put('/:propertyId/guests', requireCharacterAuth, HousingController.manageGuests);

export { router as housingRoutes };