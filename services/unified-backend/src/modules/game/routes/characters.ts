import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthMiddleware } from '../middleware/auth';
import { CharacterValidationMiddleware } from '../middleware/characterValidation';
import { requireGamePermission } from '../middleware/gamePermissions';
import { GamePermissions } from '@config/permissions';
import { CharacterController } from '../controllers/CharacterController';
import { CharacterGameplayController } from '../controllers/CharacterGameplayController';
import { CharacterSocialController } from '../controllers/CharacterSocialController';
import { SkillController } from '../controllers/SkillController';
import { CharacterProgressionController } from '../controllers/CharacterProgressionController';
import { CharacterAvatarController, uploadAvatar } from '../controllers/CharacterAvatarController';

const router = Router();

// Rate limiters — same style as locations.ts/economy.ts (read vs write split).
const charactersReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'CHARACTERS_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

const charactersWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'CHARACTERS_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

// Character creation and management
router.get('/characters/my',
  charactersReadLimiter,
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:list:own'),
  CharacterController.getMyCharacters
);

router.get('/characters/public-list',
  charactersReadLimiter,
  AuthMiddleware.requireUserAuth,
  requireGamePermission(GamePermissions.CHARACTER_READ_OTHERS_PUBLIC),
  CharacterController.getPublicCharactersList
);

// Character directory (Anagrafica) - Must be BEFORE :characterId route
// Note: No character context required - accessible to all authenticated users
router.get('/characters/directory',
  charactersReadLimiter,
  AuthMiddleware.requireUserAuth,
  CharacterController.getCharacterDirectory
);

// Face claims search (wizard validation) - Must be BEFORE :characterId route
router.get('/characters/face-claims/search',
  charactersReadLimiter,
  AuthMiddleware.requireUserAuth,
  CharacterController.searchFaceClaims
);

router.get('/characters/:characterId/wizard',
  charactersReadLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission(GamePermissions.CHARACTER_READ_OWN),
  CharacterController.getCharacterForWizard
);

router.get('/characters/:characterId',
  charactersReadLimiter,
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
  charactersReadLimiter,
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:skills:read'),
  SkillController.getCharacterSkillsForDice
);

router.get('/characters/public/:characterId',
  charactersReadLimiter,
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:read:others:public'),
  CharacterController.getPublicCharacter
);

router.put('/characters/:characterId',
  charactersWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:character:update'),
  CharacterValidationMiddleware.validateCharacterUpdate,
  CharacterController.updateCharacter
);

// Update prestavolto (dedicated endpoint, works for approved characters)
router.put('/characters/:characterId/prestavolto',
  charactersWriteLimiter,
  AuthMiddleware.requireUserAuth,
  CharacterController.updatePrestavolto
);

/**
 * @route POST /characters/:characterId/avatar
 * @desc Upload ritratto (avatar + profileImage) via CDN, owner o master
 * @access Private (owner o master)
 */
router.post('/characters/:characterId/avatar',
  charactersWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  uploadAvatar.single('file'),
  CharacterAvatarController.uploadAvatar
);

/**
 * @route GET /characters/:characterId/progression
 * @desc Punti esperienza/abilità disponibili e storico spese (tab Statistiche)
 * @access Private (owner o master)
 */
router.get('/characters/:characterId/progression',
  charactersReadLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission(GamePermissions.CHARACTER_PROGRESSION_READ),
  CharacterProgressionController.getProgression
);

/**
 * @route POST /characters/:characterId/progression/skills/:skillId/improve
 * @desc Spende px disponibili per aumentare una skill (bloccato per skill lockedForPlayer)
 * @access Private (owner o master)
 */
router.post('/characters/:characterId/progression/skills/:skillId/improve',
  charactersWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission(GamePermissions.CHARACTER_PROGRESSION_MODIFY),
  CharacterProgressionController.improveSkill
);

/**
 * @route POST /characters/:characterId/progression/grant
 * @desc Assegna px/punti abilità a un personaggio (solo master)
 * @access Private (master)
 */
router.post('/characters/:characterId/progression/grant',
  charactersWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission(GamePermissions.CHARACTER_PROGRESSION_MODIFY),
  CharacterProgressionController.grantPoints
);

router.post('/characters/:characterId/submit',
  charactersWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:character:submit'),
  CharacterValidationMiddleware.validateBackgroundCompletion,
  CharacterGameplayController.submitCharacter
);

// No permission check needed - this endpoint GENERATES the character_context token
// Already protected by requireUserAuth + controller validates ownership
router.post('/characters/:characterId/select',
  charactersWriteLimiter,
  AuthMiddleware.requireUserAuth,
  CharacterGameplayController.selectCharacter
);

router.delete('/characters/:characterId',
  charactersWriteLimiter,
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:delete'),
  CharacterController.deleteCharacter
);

// Character location management
router.post('/characters/set-location',
  charactersWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:enter'),
  CharacterGameplayController.setCharacterLocation
);

// Character corporations
router.get('/characters/:characterId/corporations',
  charactersReadLimiter,
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:corporations:read'),
  CharacterSocialController.getCharacterCorporations
);

// NEW CHARACTER CREATION SYSTEM: Skill points and occupation bonuses
router.get('/characters/:characterId/skill-points',
  charactersReadLimiter,
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:progression:read'),
  CharacterGameplayController.getSkillPoints
);

router.post('/characters/:characterId/apply-occupation-bonuses',
  charactersWriteLimiter,
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:progression:modify'),
  CharacterGameplayController.applyOccupationBonusesEndpoint
);

router.get('/occupations/:occupationId/check-prerequisites',
  charactersReadLimiter,
  AuthMiddleware.requireUserAuth,
  requireGamePermission('game:character:occupations:read'),
  CharacterGameplayController.checkOccupationPrerequisitesEndpoint
);

// Character creation configuration moved to /modules/game/routes/characterCreation.ts
// REMOVED DUPLICATE: router.get('/character-creation-config', ...)

// Fake PNG management (PNG Light system)
router.get('/characters/:characterId/fake-pngs',
  charactersReadLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:character:read'),
  CharacterController.listFakePngs
);

router.post('/characters/:characterId/fake-pngs',
  charactersWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:character:update'),
  CharacterController.createFakePng
);

router.patch('/characters/:characterId/fake-pngs/:fakeId',
  charactersWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:character:update'),
  CharacterController.updateFakePng
);

router.delete('/characters/:characterId/fake-pngs/:fakeId',
  charactersWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:character:update'),
  CharacterController.deleteFakePng
);

router.post('/characters/:characterId/fake-pngs/:fakeId/activate',
  charactersWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission(GamePermissions.CHAT_USE_FAKE_PNG),
  CharacterController.activateFakePng
);

router.post('/characters/:characterId/fake-pngs/deactivate',
  charactersWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:character:update'),
  CharacterController.deactivateFakePng
);

export default router;
