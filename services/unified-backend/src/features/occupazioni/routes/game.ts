import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { OccupationController } from '../controllers/OccupationController';
import { AuthMiddleware } from '@modules/game/middleware/auth';
import { requireGamePermission } from '@modules/game/middleware/gamePermissions';

const router = Router();

// CodeQL (js/missing-rate-limiting): limiter generico prima ancora
// dell'auth check, per proteggere anche quest'ultimo da un flood.
const routeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});
router.use(routeLimiter);

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
