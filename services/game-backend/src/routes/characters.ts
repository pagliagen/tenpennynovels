import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { CharacterValidationMiddleware } from '../middleware/characterValidation';
import { CharacterController } from '../controllers/CharacterController';
import { BackgroundQuestionController } from '../controllers/BackgroundQuestionController';
import { SkillController } from '../controllers/SkillController';

const router = Router();

// Character routes (require user auth)
router.post('/characters/create', 
  AuthMiddleware.requireUserAuth,
  CharacterValidationMiddleware.validateCharacterCreation,
  CharacterValidationMiddleware.validateVictorianContent,
  CharacterValidationMiddleware.validateGuidedBackgroundCompleteness,
  CharacterController.createCharacter
);

router.get('/characters/my', 
  AuthMiddleware.requireUserAuth, 
  CharacterController.getMyCharacters
);

router.get('/characters/public-list', 
  AuthMiddleware.requireUserAuth, 
  CharacterController.getPublicCharactersList
);

router.get('/characters/:characterId', 
  AuthMiddleware.requireUserAuth, 
  CharacterController.getCharacter
);

// Character skills endpoint (for DiceCommandsModal)
router.get('/characters/:characterId/skills',
  AuthMiddleware.requireUserAuth,
  SkillController.getCharacterSkillsForDice
);

router.get('/characters/public/:characterId', 
  AuthMiddleware.requireUserAuth, 
  CharacterController.getPublicCharacter
);

router.put('/characters/:characterId', 
  AuthMiddleware.requireUserAuth,
  CharacterValidationMiddleware.validateCharacterUpdate,
  CharacterValidationMiddleware.validateVictorianContent,
  CharacterValidationMiddleware.validateGuidedBackgroundCompleteness,
  CharacterController.updateCharacter
);

router.post('/characters/:characterId/submit', 
  AuthMiddleware.requireUserAuth,
  CharacterValidationMiddleware.validateBackgroundCompletion,
  CharacterController.submitCharacter
);

router.post('/characters/:characterId/select', 
  AuthMiddleware.requireUserAuth, 
  CharacterController.selectCharacter
);

router.delete('/characters/:characterId', 
  AuthMiddleware.requireUserAuth, 
  CharacterController.deleteCharacter
);

// Background questionnaire routes
router.get('/background-questions', 
  AuthMiddleware.requireUserAuth, 
  BackgroundQuestionController.getBackgroundQuestions
);

router.get('/background-questions/category/:category', 
  AuthMiddleware.requireUserAuth, 
  BackgroundQuestionController.getQuestionsByCategory
);

router.get('/characters/:characterId/background-responses', 
  AuthMiddleware.requireUserAuth, 
  BackgroundQuestionController.getCharacterBackgroundResponses
);

router.put('/characters/:characterId/background-responses', 
  AuthMiddleware.requireUserAuth,
  CharacterValidationMiddleware.validateBackgroundResponses,
  BackgroundQuestionController.updateBackgroundResponses
);

// Character location management
router.post('/characters/set-location', 
  AuthMiddleware.requireCharacterAuth, 
  CharacterController.setCharacterLocation
);

// Character corporations
router.get('/characters/:characterId/corporations',
  AuthMiddleware.requireUserAuth,
  CharacterController.getCharacterCorporations
);

// NEW CHARACTER CREATION SYSTEM: Skill points and occupation bonuses
router.get('/characters/:characterId/skill-points',
  AuthMiddleware.requireUserAuth,
  CharacterController.getSkillPoints
);

router.post('/characters/:characterId/apply-occupation-bonuses',
  AuthMiddleware.requireUserAuth,
  CharacterController.applyOccupationBonusesEndpoint
);

router.get('/occupations/:occupationId/check-prerequisites',
  AuthMiddleware.requireUserAuth,
  CharacterController.checkOccupationPrerequisitesEndpoint
);

export default router;