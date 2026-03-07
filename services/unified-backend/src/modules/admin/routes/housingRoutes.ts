import { Router } from 'express';
import { HousingManagementController } from '../controllers/HousingManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Apply admin auth middleware to all housing routes
router.use(AdminAuthMiddleware.requireAdminAccess);

// Property CRUD operations
router.get('/properties', HousingManagementController.getAllProperties);
router.post('/properties', HousingManagementController.createProperty);
router.put('/properties/:propertyId', HousingManagementController.updateProperty);
router.delete('/properties/:propertyId', HousingManagementController.deleteProperty);

// Bulk operations
router.put('/rent-adjustments', HousingManagementController.adjustRents);
router.post('/evictions', HousingManagementController.processEvictions);

// Reports and analytics
router.get('/reports', HousingManagementController.getHousingReports);
router.get('/stats', HousingManagementController.getHousingStats);

// District information
router.get('/districts', HousingManagementController.getDistricts);

export { router as housingRoutes };