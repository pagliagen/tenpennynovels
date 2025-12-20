import { Router } from 'express';
import { CharacterSessionController } from '../controllers/CharacterSessionController';

const router = Router();

/**
 * @route GET /sessions/current
 * @desc Get current character session details
 * @access Private (Character required)
 */
router.get('/current', CharacterSessionController.getCurrentSession);

/**
 * @route GET /sessions/active
 * @desc Get all active sessions for character
 * @access Private (Character required)
 */
router.get('/active', CharacterSessionController.getMyActiveSessions);

/**
 * @route GET /sessions/history
 * @desc Get character session history
 * @access Private (Character required)
 * @query page - Page number
 * @query limit - Items per page
 * @query includeActive - Include active sessions (true/false)
 */
router.get('/history', CharacterSessionController.getMySessionHistory);

/**
 * @route DELETE /sessions/:sessionId
 * @desc Invalidate specific character session
 * @access Private (Character required)
 */
router.delete('/:sessionId', CharacterSessionController.invalidateSession);

/**
 * @route DELETE /sessions/others/all
 * @desc Invalidate all other sessions (keep current)
 * @access Private (Character required)
 */
router.delete('/others/all', CharacterSessionController.invalidateAllOtherSessions);

export default router;