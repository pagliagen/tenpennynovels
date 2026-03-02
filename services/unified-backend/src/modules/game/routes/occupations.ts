import { Router } from 'express';
import { OccupationController } from '../controllers/OccupationController';

const router = Router();

/**
 * @route GET /occupations
 * @desc Get available occupations for character
 * @access Private (Character required)
 * @query category - Filter by occupation category
 * @query socialClass - Filter by social class
 */
router.get('/', OccupationController.getAvailableOccupations);

/**
 * @route GET /occupations/categories
 * @desc Get occupation categories with statistics
 * @access Private (Character required)
 */
router.get('/categories', OccupationController.getOccupationCategories);

/**
 * @route GET /occupations/:occupationId
 * @desc Get detailed occupation information
 * @access Private (Character required)
 */
router.get('/:occupationId', OccupationController.getOccupationDetails);

/**
 * @route GET /occupations/:occupationId/eligibility
 * @desc Check character eligibility for occupation
 * @access Private (Character required)
 */
router.get('/:occupationId/eligibility', OccupationController.checkOccupationEligibility);

export default router;