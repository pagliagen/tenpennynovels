import { Router } from 'express';
import { LocationActionManagementController } from '../controllers/LocationActionManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Apply admin auth middleware to all routes
router.use(AdminAuthMiddleware.requireAdminAccess);

/**
 * @route GET /location-actions
 * @desc Get location actions with filtering
 * @access Admin
 * @query locationId - Filter by location ID
 * @query actionType - Filter by action type
 * @query characterId - Filter by character ID
 * @query visibility - Filter by visibility (public, whisper, master_only)
 * @query startDate - Filter by start date
 * @query endDate - Filter by end date
 * @query page - Page number
 * @query limit - Items per page
 * @query sortBy - Sort field (timestamp, actionType, etc.)
 * @query sortOrder - Sort order (asc, desc)
 */
router.get('/', LocationActionManagementController.getLocationActions);

/**
 * @route GET /location-actions/statistics
 * @desc Get location action statistics
 * @access Admin
 * @query timeRange - Time range (1h, 24h, 7d, 30d)
 * @query locationId - Filter by location ID
 */
router.get('/statistics', LocationActionManagementController.getLocationActionStatistics);

/**
 * @route GET /location-actions/action-types
 * @desc Get available action types with counts
 * @access Admin
 */
router.get('/action-types', LocationActionManagementController.getLocationActionTypes);

/**
 * @route GET /location-actions/export
 * @desc Export location actions
 * @access Admin
 * @query locationId - Filter by location ID
 * @query startDate - Start date for export
 * @query endDate - End date for export
 * @query actionType - Filter by action type
 * @query format - Export format (json, csv)
 */
router.get('/export', LocationActionManagementController.exportLocationActions);

/**
 * @route DELETE /location-actions/:actionId
 * @desc Delete specific location action
 * @access Admin
 */
router.delete('/:actionId', LocationActionManagementController.deleteLocationAction);

/**
 * @route POST /location-actions/bulk-delete
 * @desc Bulk delete location actions
 * @access Admin
 */
router.post('/bulk-delete', LocationActionManagementController.bulkDeleteLocationActions);

export default router;