import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { CharacterValidationMiddleware } from '../middleware/characterValidation';
import { requireGamePermission } from '../middleware/gamePermissions';
import { CharacterController } from '../controllers/CharacterController';
import { CharacterGameplayController } from '../controllers/CharacterGameplayController';
import { CharacterSocialController } from '../controllers/CharacterSocialController';
import { BackgroundQuestionController } from '../controllers/BackgroundQuestionController';
import { SkillController } from '../controllers/SkillController';

const router = Router();

// Character creation and management
router.post('/characters/create',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:create'),
  CharacterValidationMiddleware.validateCharacterCreation,
  CharacterValidationMiddleware.validateVictorianContent,
  CharacterValidationMiddleware.validateNewBackgroundFormat,
  CharacterController.createCharacter
);

router.get('/characters/my',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:list:own'),
  CharacterController.getMyCharacters
);

router.get('/characters/public-list',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:list:public'),
  CharacterController.getPublicCharactersList
);

router.get('/characters/:characterId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:character:read'),
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
  requireGamePermission('game:character:skills:read'),
  SkillController.getCharacterSkillsForDice
);

router.get('/characters/public/:characterId',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:read:public'),
  CharacterController.getPublicCharacter
);

router.put('/characters/:characterId',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:update'),
  CharacterValidationMiddleware.validateCharacterUpdate,
  CharacterValidationMiddleware.validateVictorianContent,
  CharacterValidationMiddleware.validateNewBackgroundFormat,
  CharacterController.updateCharacter
);

router.post('/characters/:characterId/submit',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:submit'),
  CharacterValidationMiddleware.validateBackgroundCompletion,
  CharacterGameplayController.submitCharacter
);

// No permission check needed - this endpoint GENERATES the character_context token
// Already protected by requireUserAuth + controller validates ownership
router.post('/characters/:characterId/select',
  AuthMiddleware.requireUserAuth,
  CharacterGameplayController.selectCharacter
);

router.delete('/characters/:characterId',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:delete'),
  CharacterController.deleteCharacter
);

// Background questionnaire routes
router.get('/background-questions',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:background:read'),
  BackgroundQuestionController.getBackgroundQuestions
);

router.get('/background-questions/category/:category',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:background:read'),
  BackgroundQuestionController.getQuestionsByCategory
);

router.get('/characters/:characterId/background-responses',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:background:read'),
  BackgroundQuestionController.getCharacterBackgroundResponses
);

router.put('/characters/:characterId/background-responses',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:background:write'),
  CharacterValidationMiddleware.validateBackgroundResponses,
  BackgroundQuestionController.updateBackgroundResponses
);

// Character location management
router.post('/characters/set-location',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:enter'),
  CharacterGameplayController.setCharacterLocation
);

// Character corporations
router.get('/characters/:characterId/corporations',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:corporations:read'),
  CharacterSocialController.getCharacterCorporations
);

// NEW CHARACTER CREATION SYSTEM: Skill points and occupation bonuses
router.get('/characters/:characterId/skill-points',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:progression:read'),
  CharacterGameplayController.getSkillPoints
);

router.post('/characters/:characterId/apply-occupation-bonuses',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:progression:modify'),
  CharacterGameplayController.applyOccupationBonusesEndpoint
);

router.get('/occupations/:occupationId/check-prerequisites',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:occupations:read'),
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