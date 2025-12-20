import express from 'express';
import { CorporationManagementController } from '../controllers/CorporationManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = express.Router();

// Apply admin authentication middleware to all routes
router.use(AdminAuthMiddleware.requireAdminAccess);

/**
 * Corporation Management Routes
 */

// Get all corporations with pagination and filtering
router.get('/', CorporationManagementController.getAllCorporations);

// Create new corporation
router.post('/', CorporationManagementController.createCorporation);

// Get corporation statistics
router.get('/stats', CorporationManagementController.getCorporationStats);

// Get all membership requests across all corporations
router.get('/membership-requests', CorporationManagementController.getAllMembershipRequests);

// Review membership request (approve/reject)
router.post('/membership-requests/:requestId/review', CorporationManagementController.reviewMembershipRequest);

// Bulk operations
router.post('/bulk', CorporationManagementController.bulkOperations);

// Get specific corporation details
router.get('/:corporationId', CorporationManagementController.getCorporationDetails);

// Update corporation
router.put('/:corporationId', CorporationManagementController.updateCorporation);

// Delete corporation
router.delete('/:corporationId', CorporationManagementController.deleteCorporation);

// Get corporation membership requests
router.get('/:corporationId/membership-requests', CorporationManagementController.getCorporationMembershipRequests);

// Handle specific membership request
router.post('/:corporationId/membership-requests/:requestId', CorporationManagementController.handleMembershipRequest);

// Manage corporation treasury
router.put('/:corporationId/treasury', CorporationManagementController.manageTreasury);

// Update corporation status (activate/deactivate/disband)
router.patch('/:corporationId/status', CorporationManagementController.updateCorporationStatus);

export default router;