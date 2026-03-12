import { Router } from 'express';
import { ChatManagementController } from '../controllers/ChatManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Apply admin auth middleware to all routes
router.use(AdminAuthMiddleware.requireAdminAccess);

/**
 * @route GET /chats
 * @desc Get chats with filtering
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
router.get('/', ChatManagementController.getChats);

/**
 * @route GET /chats/statistics
 * @desc Get chat statistics
 * @access Admin
 * @query timeRange - Time range (1h, 24h, 7d, 30d)
 * @query locationId - Filter by location ID
 */
router.get('/statistics', ChatManagementController.getChatStatistics);

/**
 * @route GET /chats/action-types
 * @desc Get available chat types with counts
 * @access Admin
 */
router.get('/action-types', ChatManagementController.getChatTypes);

/**
 * @route GET /chats/export
 * @desc Export chats
 * @access Admin
 * @query locationId - Filter by location ID
 * @query startDate - Start date for export
 * @query endDate - End date for export
 * @query actionType - Filter by action type
 * @query format - Export format (json, csv)
 */
router.get('/export', ChatManagementController.exportChats);

/**
 * @route DELETE /chats/:chatId
 * @desc Delete specific chat
 * @access Admin
 */
router.delete('/:actionId', ChatManagementController.deleteChat);

/**
 * @route POST /chats/bulk-delete
 * @desc Bulk delete chats
 * @access Admin
 */
router.post('/bulk-delete', ChatManagementController.bulkDeleteChats);

export default router;