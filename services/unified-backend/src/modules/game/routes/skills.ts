import { Router } from 'express';
import { SkillController } from '../controllers/SkillController';

const router = Router();

/**
 * @route GET /skills
 * @desc Get character skills with calculated values
 * @access Private (Character required)
 * @query category - Filter by skill category
 * @query includePlaceholders - Include placeholder skills (true/false)
 */
router.get('/', SkillController.getCharacterSkills);

/**
 * @route GET /skills/categories
 * @desc Get skill categories with statistics
 * @access Private (Character required)
 */
router.get('/categories', SkillController.getSkillCategories);

/**
 * @route GET /skills/placeholders
 * @desc Get placeholder skills (languages, arts, etc.)
 * @access Private (Character required)
 * @query placeholderType - Filter by placeholder type
 */
router.get('/placeholders', SkillController.getPlaceholderSkills);

/**
 * @route GET /skills/:skillId
 * @desc Get detailed skill information
 * @access Private (Character required)
 */
router.get('/:skillId', SkillController.getSkillDetails);

/**
 * @route GET /skills/:skillId/probabilities
 * @desc Calculate skill success probabilities
 * @access Private (Character required)
 */
router.get('/:skillId/probabilities', SkillController.calculateSkillProbabilities);

export default router;