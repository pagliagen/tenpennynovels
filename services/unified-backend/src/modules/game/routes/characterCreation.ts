import { Router } from 'express';
import { CharacterCreationController } from '../controllers/CharacterCreationController';
import { AuthMiddleware } from '../middleware/auth';
import { requireGamePermission } from '../middleware/gamePermissions';

const router = Router();

/**
 * @route GET /character-creation-config
 * @desc Get complete character creation configuration
 * @access Private (User auth required, NO character required)
 */
router.get('/',
  AuthMiddleware.requireUserAuth,
  CharacterCreationController.getConfig
);

/**
 * @route GET /character-creation-config/occupations
 * @desc Get all available occupations
 * @access Private (User auth required, NO character required)
 */
router.get('/occupations',
  AuthMiddleware.requireUserAuth,
  CharacterCreationController.getOccupations
);

/**
 * @route GET /character-creation-config/skills
 * @desc Get all available skills
 * @access Private (User auth required, NO character required)
 */
router.get('/skills',
  AuthMiddleware.requireUserAuth,
  CharacterCreationController.getSkills
);

export default router;
