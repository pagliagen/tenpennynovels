import { Router } from 'express';
import { CharacterSessionController } from '../controllers/CharacterSessionController';
import { SessionManagementController } from '../controllers/SessionManagementController';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @route GET /sessions/current
 * @desc Get current character session details
 * @access Private (Character required)
 */
router.get('/current',
  AuthMiddleware.requireCharacterAuth,
  CharacterSessionController.getCurrentSession
);

/**
 * @route GET /sessions/active
 * @desc Get all active sessions for character
 * @access Private (Character required)
 */
router.get('/active',
  AuthMiddleware.requireCharacterAuth,
  CharacterSessionController.getMyActiveSessions
);

/**
 * @route GET /sessions/history
 * @desc Get character session history
 * @access Private (Character required)
 * @query page - Page number
 * @query limit - Items per page
 * @query includeActive - Include active sessions (true/false)
 */
router.get('/history',
  AuthMiddleware.requireCharacterAuth,
  CharacterSessionController.getMySessionHistory
);

/**
 * @route DELETE /sessions/:sessionId
 * @desc Invalidate specific character session
 * @access Private (Character required)
 */
router.delete('/:sessionId',
  AuthMiddleware.requireCharacterAuth,
  CharacterSessionController.invalidateSession
);

/**
 * @route DELETE /sessions/others/all
 * @desc Invalidate all other sessions (keep current)
 * @access Private (Character required)
 */
router.delete('/others/all',
  AuthMiddleware.requireCharacterAuth,
  CharacterSessionController.invalidateAllOtherSessions
);

// ========================================================================
// BOT SESSION MANAGEMENT (merged from sessionManagementRoutes.ts)
// ========================================================================

/**
 * @route GET /sessions/:sessionId
 * @desc Get session details for bot
 * @access BOT_API_KEY required
 */
router.get('/:sessionId',
  AuthMiddleware.requireBotApiKey,
  SessionManagementController.getSession
);

/**
 * @route POST /sessions/:sessionId/complete-bot-turn
 * @desc Complete bot turn in session
 * @access BOT_API_KEY required
 */
router.post('/:sessionId/complete-bot-turn',
  AuthMiddleware.requireBotApiKey,
  SessionManagementController.completeBotTurn
);

/**
 * @route PATCH /sessions/:sessionId
 * @desc Update session (bot)
 * @access BOT_API_KEY required
 */
router.patch('/:sessionId',
  AuthMiddleware.requireBotApiKey,
  SessionManagementController.updateSession
);

export default router;