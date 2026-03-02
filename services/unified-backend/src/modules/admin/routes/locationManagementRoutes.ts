import { Router } from 'express';
import { LocationManagementController } from '../controllers/LocationManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Apply admin auth middleware to all location management routes
router.use(AdminAuthMiddleware.requireAdminAccess);

// Location CRUD operations
router.get('/', LocationManagementController.getLocations);
router.get('/hierarchy', LocationManagementController.getLocationHierarchy);
router.get('/stats', LocationManagementController.getLocationStats);
router.post('/', LocationManagementController.createLocation);
router.put('/:locationId', LocationManagementController.updateLocation);
router.delete('/:locationId', LocationManagementController.deleteLocation);

// Access control management
router.put('/:locationId/access', LocationManagementController.manageLocationAccess);

// Bulk operations
router.post('/bulk', LocationManagementController.bulkLocationOperations);

export default router;