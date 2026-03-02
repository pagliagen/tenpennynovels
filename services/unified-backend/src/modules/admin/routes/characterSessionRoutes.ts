import { Router } from 'express';
import { CharacterSessionManagementController } from '../controllers/CharacterSessionManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Apply admin auth middleware to all routes
router.use(AdminAuthMiddleware.requireAdminAccess);

/**
 * @route GET /character-sessions
 * @desc Get active character sessions
 * @access Admin
 * @query page - Page number
 * @query limit - Items per page 
 * @query characterId - Filter by character ID
 * @query userId - Filter by user ID
 * @query deviceType - Filter by device type
 */
router.get('/', CharacterSessionManagementController.getActiveSessions);

/**
 * @route GET /character-sessions/statistics
 * @desc Get session statistics
 * @access Admin
 * @query timeRange - Time range (1h, 24h, 7d, 30d)
 */
router.get('/statistics', CharacterSessionManagementController.getSessionStatistics);

/**
 * @route GET /character-sessions/character/:characterId
 * @desc Get session history for specific character
 * @access Admin
 * @query page - Page number
 * @query limit - Items per page
 * @query includeActive - Include active sessions (true/false)
 */
router.get('/character/:characterId', CharacterSessionManagementController.getCharacterSessionHistory);

/**
 * @route PUT /character-sessions/:sessionId/invalidate
 * @desc Invalidate specific character session
 * @access Admin
 */
router.put('/:sessionId/invalidate', CharacterSessionManagementController.invalidateSession);

/**
 * @route PUT /character-sessions/character/:characterId/invalidate-all
 * @desc Invalidate all sessions for a character
 * @access Admin
 */
router.put('/character/:characterId/invalidate-all', CharacterSessionManagementController.invalidateAllCharacterSessions);

/**
 * @route POST /character-sessions/cleanup
 * @desc Clean expired sessions (maintenance)
 * @access Admin
 */
router.post('/cleanup', CharacterSessionManagementController.cleanExpiredSessions);

export default router;