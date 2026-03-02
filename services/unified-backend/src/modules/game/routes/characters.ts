import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { CharacterValidationMiddleware } from '../middleware/characterValidation';
import { CharacterController } from '../controllers/CharacterController';
import { CharacterGameplayController } from '../controllers/CharacterGameplayController';
import { CharacterSocialController } from '../controllers/CharacterSocialController';
import { BackgroundQuestionController } from '../controllers/BackgroundQuestionController';
import { SkillController } from '../controllers/SkillController';

const router = Router();

// Character routes (require user auth)
router.post('/characters/create',
  AuthMiddleware.requireUserAuth,
  CharacterValidationMiddleware.validateCharacterCreation,
  CharacterValidationMiddleware.validateVictorianContent,
  CharacterValidationMiddleware.validateNewBackgroundFormat,
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
  (req, res, next) => {
    // Route to getCharacterSheet if ?view=sheet query param present
    if (req.query.view === 'sheet') {
      return CharacterController.getCharacterSheet(req, res);
    }
    next();
  },
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
  CharacterValidationMiddleware.validateNewBackgroundFormat,
  CharacterController.updateCharacter
);

router.post('/characters/:characterId/submit',
  AuthMiddleware.requireUserAuth,
  CharacterValidationMiddleware.validateBackgroundCompletion,
  CharacterGameplayController.submitCharacter
);

router.post('/characters/:characterId/select',
  AuthMiddleware.requireUserAuth,
  CharacterGameplayController.selectCharacter
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
  CharacterGameplayController.setCharacterLocation
);

// Character corporations
router.get('/characters/:characterId/corporations',
  AuthMiddleware.requireUserAuth,
  CharacterSocialController.getCharacterCorporations
);

// NEW CHARACTER CREATION SYSTEM: Skill points and occupation bonuses
router.get('/characters/:characterId/skill-points',
  AuthMiddleware.requireUserAuth,
  CharacterGameplayController.getSkillPoints
);

router.post('/characters/:characterId/apply-occupation-bonuses',
  AuthMiddleware.requireUserAuth,
  CharacterGameplayController.applyOccupationBonusesEndpoint
);

router.get('/occupations/:occupationId/check-prerequisites',
  AuthMiddleware.requireUserAuth,
  CharacterGameplayController.checkOccupationPrerequisitesEndpoint
);

// Bot-only endpoint (API key auth, no JWT)
router.post('/characters/bot',
  AuthMiddleware.requireBotApiKey,
  CharacterController.createBotCharacter
);

// Complete bot character creation endpoint (API key auth, no JWT)
router.post('/characters/bot/complete',
  AuthMiddleware.requireBotApiKey,
  CharacterController.createCompleteBotCharacter
);

export default router;