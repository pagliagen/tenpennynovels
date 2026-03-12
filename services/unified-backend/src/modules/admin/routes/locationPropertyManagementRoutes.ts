import { Router } from 'express';
import { LocationPropertyManagementController } from '../controllers/LocationPropertyManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Apply admin auth middleware to all housing routes
router.use(AdminAuthMiddleware.requireAdminAccess);

// Property CRUD operations
router.get('/properties', LocationPropertyManagementController.getAllProperties);
router.post('/properties', LocationPropertyManagementController.createProperty);
router.put('/properties/:propertyId', LocationPropertyManagementController.updateProperty);
router.delete('/properties/:propertyId', LocationPropertyManagementController.deleteProperty);

// Bulk operations
router.put('/rent-adjustments', LocationPropertyManagementController.adjustRents);
router.post('/evictions', LocationPropertyManagementController.processEvictions);

// Reports and analytics
router.get('/reports', LocationPropertyManagementController.getHousingReports);
router.get('/stats', LocationPropertyManagementController.getHousingStats);

// District information
router.get('/districts', LocationPropertyManagementController.getDistricts);

export { router as locationPropertyManagementRoutes };