import { Router } from 'express';
import { CharacterSessionController } from '../controllers/CharacterSessionController';
import { SessionManagementController } from '../controllers/SessionManagementController';
import { AuthMiddleware } from '../middleware/auth';
import { requireGamePermission } from '../middleware/gamePermissions';

const router = Router();

/**
 * @route GET /sessions/current
 * @desc Get current character session details
 * @access Private (Character required)
 */
router.get('/current',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:session:current'),
  CharacterSessionController.getCurrentSession
);

/**
 * @route GET /sessions/active
 * @desc Get all active sessions for character
 * @access Private (Character required)
 */
router.get('/active',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:session:active'),
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
  requireGamePermission('game:session:history'),
  CharacterSessionController.getMySessionHistory
);

/**
 * @route DELETE /sessions/:sessionId
 * @desc Invalidate specific character session
 * @access Private (Character required)
 */
router.delete('/:sessionId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:session:invalidate'),
  CharacterSessionController.invalidateSession
);

/**
 * @route DELETE /sessions/others/all
 * @desc Invalidate all other sessions (keep current)
 * @access Private (Character required)
 */
router.delete('/others/all',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:session:invalidate-others'),
  CharacterSessionController.invalidateAllOtherSessions
);

// ========================================================================
// BOT SESSION MANAGEMENT (merged from sessionManagementRoutes.ts)
// ========================================================================

/**
 * @route GET /sessions/:sessionId
 * @desc Get session details for AI gateway
 * @access AI_GATEWAY_WEBHOOK_SECRET required
 */
router.get('/:sessionId',
  AuthMiddleware.requireAIGatewayAuth,
  SessionManagementController.getSession
);

/**
 * @route POST /sessions/:sessionId/complete-bot-turn
 * @desc Complete bot turn in session
 * @access AI_GATEWAY_WEBHOOK_SECRET required
 */
router.post('/:sessionId/complete-bot-turn',
  AuthMiddleware.requireAIGatewayAuth,
  SessionManagementController.completeBotTurn
);

/**
 * @route PATCH /sessions/:sessionId
 * @desc Update session (AI gateway callback)
 * @access AI_GATEWAY_WEBHOOK_SECRET required
 */
router.patch('/:sessionId',
  AuthMiddleware.requireAIGatewayAuth,
  SessionManagementController.updateSession
);

export default router;