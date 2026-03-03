import { Router } from 'express';
import { SkillController } from '../controllers/SkillController';
import { AuthMiddleware } from '../middleware/auth';
import { requireGamePermission } from '../middleware/gamePermissions';

const router = Router();

/**
 * @route GET /skills
 * @desc Get character skills with calculated values
 * @access Private (Character required)
 * @query category - Filter by skill category
 * @query includePlaceholders - Include placeholder skills (true/false)
 */
router.get('/',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:skills:list'),
  SkillController.getCharacterSkills
);

/**
 * @route GET /skills/categories
 * @desc Get skill categories with statistics
 * @access Private (Character required)
 */
router.get('/categories',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:skills:categories'),
  SkillController.getSkillCategories
);

/**
 * @route GET /skills/placeholders
 * @desc Get placeholder skills (languages, arts, etc.)
 * @access Private (Character required)
 * @query placeholderType - Filter by placeholder type
 */
router.get('/placeholders',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:skills:placeholders'),
  SkillController.getPlaceholderSkills
);

/**
 * @route GET /skills/:skillId
 * @desc Get detailed skill information
 * @access Private (Character required)
 */
router.get('/:skillId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:skills:read'),
  SkillController.getSkillDetails
);

/**
 * @route GET /skills/:skillId/probabilities
 * @desc Calculate skill success probabilities
 * @access Private (Character required)
 */
router.get('/:skillId/probabilities',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:skills:probabilities'),
  SkillController.calculateSkillProbabilities
);

export default router;