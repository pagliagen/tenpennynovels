import { Router } from 'express';
import { OccupationController } from '../controllers/OccupationController';
import { AuthMiddleware } from '@modules/game/middleware/auth';
import { requireGamePermission } from '@modules/game/middleware/gamePermissions';

const router = Router();

/**
 * @route GET /occupations
 * @desc Get available occupations for character
 * @access Private (Character required)
 * @query category - Filter by occupation category
 * @query socialClass - Filter by social class
 */
router.get('/',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:occupations:list'),
  OccupationController.getAvailableOccupations
);

/**
 * @route GET /occupations/categories
 * @desc Get occupation categories with statistics
 * @access Private (Character required)
 */
router.get('/categories',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:occupations:categories'),
  OccupationController.getOccupationCategories
);

/**
 * @route GET /occupations/:occupationId
 * @desc Get detailed occupation information
 * @access Private (Character required)
 */
router.get('/:occupationId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:occupations:read'),
  OccupationController.getOccupationDetails
);

/**
 * @route GET /occupations/:occupationId/eligibility
 * @desc Check character eligibility for occupation
 * @access Private (Character required)
 */
router.get('/:occupationId/eligibility',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:occupations:check-eligibility'),
  OccupationController.checkOccupationEligibility
);

export default router;
