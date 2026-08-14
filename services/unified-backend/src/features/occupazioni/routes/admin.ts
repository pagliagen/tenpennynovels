import { Router } from 'express';
import { OccupationManagementController } from '../controllers/OccupationManagementController';
import { AdminAuthMiddleware } from '@modules/admin/middleware/adminAuth';

const router = Router();

// Apply admin auth middleware to all occupation management routes
router.use(AdminAuthMiddleware.requireAdminAccess);

// Occupation CRUD operations
router.get('/', OccupationManagementController.getOccupations);
router.get('/stats', OccupationManagementController.getOccupationStats);
router.post('/', OccupationManagementController.createOccupation);
router.get('/:occupationId', OccupationManagementController.getOccupationDetails);
router.put('/:occupationId', OccupationManagementController.updateOccupation);
router.delete('/:occupationId', OccupationManagementController.deleteOccupation);

// Bulk operations
router.post('/bulk', OccupationManagementController.bulkOccupationOperations);
router.post('/bulk-update-skills', OccupationManagementController.bulkUpdateSkillValues);

export default router;
