import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { CharacterValidationMiddleware } from '../middleware/characterValidation';
import { requireGamePermission } from '../middleware/gamePermissions';
import { GamePermissions } from '@config/permissions';
import { CharacterController } from '../controllers/CharacterController';
import { CharacterGameplayController } from '../controllers/CharacterGameplayController';
import { CharacterSocialController } from '../controllers/CharacterSocialController';
import { SkillController } from '../controllers/SkillController';

const router = Router();

// Character creation and management
// Check name availability (must be before /create for route matching)
router.post('/characters/check-name',
  AuthMiddleware.requireUserAuth,
  CharacterController.checkNameAvailability
);

router.get('/characters/my',
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:list:own'),
  CharacterController.getMyCharacters
);

router.get('/characters/public-list',
  AuthMiddleware.requireUserAuth,
  requireGamePermission(GamePermissions.CHARACTER_READ_OTHERS_PUBLIC),
  CharacterController.getPublicCharactersList
);

// Character directory (Anagrafica) - Must be BEFORE :characterId route
// Note: No character context required - accessible to all authenticated users
router.get('/characters/directory',
  AuthMiddleware.requireUserAuth,
  CharacterController.getCharacterDirectory
);

// Face claims search (wizard validation) - Must be BEFORE :characterId route
router.get('/characters/face-claims/search',
  AuthMiddleware.requireUserAuth,
  CharacterController.searchFaceClaims
);

router.get('/characters/:characterId/wizard',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission(GamePermissions.CHARACTER_READ_OWN),
  CharacterController.getCharacterForWizard
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
  requireGamePermission('game:character:read:others:public'),
  CharacterController.getPublicCharacter
);

router.put('/characters/:characterId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:character:update'),
  CharacterValidationMiddleware.validateCharacterUpdate,
  CharacterController.updateCharacter
);

// Update prestavolto (dedicated endpoint, works for approved characters)
router.put('/characters/:characterId/prestavolto',
  AuthMiddleware.requireUserAuth,
  CharacterController.updatePrestavolto
);

router.post('/characters/:characterId/submit',
  AuthMiddleware.requireCharacterAuth,
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

// Character creation configuration moved to /modules/game/routes/characterCreation.ts
// REMOVED DUPLICATE: router.get('/character-creation-config', ...)

// AI gateway callback endpoints
router.post('/characters/bot',
  AuthMiddleware.requireAIGatewayAuth,
  CharacterController.createBotCharacter
);

router.post('/characters/bot/complete',
  AuthMiddleware.requireAIGatewayAuth,
  CharacterController.createCompleteBotCharacter
);

// Fake PNG management (PNG Light system)
router.get('/characters/:characterId/fake-pngs',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:character:read'),
  CharacterController.listFakePngs
);

router.post('/characters/:characterId/fake-pngs',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:character:update'),
  CharacterController.createFakePng
);

router.patch('/characters/:characterId/fake-pngs/:fakeId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:character:update'),
  CharacterController.updateFakePng
);

router.delete('/characters/:characterId/fake-pngs/:fakeId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:character:update'),
  CharacterController.deleteFakePng
);

router.post('/characters/:characterId/fake-pngs/:fakeId/activate',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission(GamePermissions.CHAT_USE_FAKE_PNG),
  CharacterController.activateFakePng
);

router.post('/characters/:characterId/fake-pngs/deactivate',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:character:update'),
  CharacterController.deactivateFakePng
);

export default router;