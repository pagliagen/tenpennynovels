import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthMiddleware } from '../middleware/auth';
import { banChecks } from '@shared/middleware/banCheck';
import { requireGamePermission } from '../middleware/gamePermissions';
import { LocationController } from '../controllers/LocationController';
// ChatsController - location actions moved to chats (see chats.ts)
import { CharacterNotesController } from '../controllers/CharacterNotesController';
import { QuestController } from '../controllers/QuestController';

const router = Router();

// Rate limiters — mirrors the convention in modules/forum/routes/forum.ts.
// The api-gateway also applies a 300 req/min fallback across all of /game,
// but unified-backend's own routes should each state per-route intent
// rather than relying solely on that upstream default.
const locationsReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'LOCATIONS_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

const locationsWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'LOCATIONS_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

// Location routes (require character auth)
router.get('/locations',
  locationsReadLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:list'),
  LocationController.getAccessibleLocations
);

// NOTE: must be registered before '/locations/:locationId' — otherwise Express
// matches "root" as a :locationId value and Location.findById('root') throws.
router.get('/locations/root',
  locationsReadLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:list'),
  LocationController.getRootLocation
);

router.get('/locations/:locationId',
  locationsReadLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:read'),
  LocationController.getLocation
);

router.post('/locations/:locationId/enter',
  locationsWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  banChecks.game(), // Check if user is banned from game
  requireGamePermission('game:locations:enter'),
  LocationController.enterLocation
);

router.post('/locations/leave',
  locationsWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  banChecks.game(), // Check if user is banned from game
  requireGamePermission('game:locations:leave'),
  LocationController.leaveLocation
);

router.get('/locations/:locationId/access',
  locationsReadLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:check-access'),
  LocationController.checkAccess
);

router.post('/locations/:locationId/grant-access',
  locationsWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:grant-access'),
  LocationController.grantAccess
);

router.get('/locations/:locationId/occupants',
  locationsReadLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:list-occupants'),
  LocationController.getLocationOccupants
);

router.patch('/locations/:locationId/occupant-tag',
  locationsWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:tag-occupant'),
  LocationController.updateOccupantTag
);

// Location-scoped PNG personas (master or location owner only — controller enforces)
router.get('/locations/:locationId/pngs',
  locationsReadLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:pngs:read'),
  LocationController.listLocationPngs
);

router.post('/locations/:locationId/pngs',
  locationsWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:pngs:manage'),
  LocationController.createLocationPng
);

router.delete('/locations/:locationId/pngs/:pngId',
  locationsWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:pngs:manage'),
  LocationController.deleteLocationPng
);

// Chat routes REMOVED - moved to /chats route (see chats.ts)
// Old routes:
//   POST   /locations/chats
//   GET    /locations/chats/:locationId
//   PATCH  /locations/chats/:chatId
//   DELETE /locations/chats/:chatId
//   DELETE /locations/:locationId/chats
//   POST   /locations/chats/social-conflict
// New routes: /chats/* (see routes/chats.ts)

// Block notes routes (Personal location notes)
router.get('/block-notes',
  locationsReadLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:block-notes:read'),
  CharacterNotesController.getNotes
);

router.post('/block-notes',
  locationsWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:block-notes:write'),
  CharacterNotesController.saveNotes
);

router.delete('/block-notes/:notesId',
  locationsWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:block-notes:delete'),
  CharacterNotesController.deleteNotes
);

// Quest routes (using GamingSession)
router.post('/quests',
  locationsWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:quests:create'),
  QuestController.createQuest
);

router.get('/quests/:questId',
  locationsReadLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:quests:read'),
  QuestController.getQuestStatus
);

router.post('/quests/:questId/start',
  locationsWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:quests:start'),
  QuestController.startQuest
);

router.post('/quests/:questId/end',
  locationsWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:quests:end'),
  QuestController.endQuest
);

router.post('/quests/:questId/action-mode',
  locationsWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:quests:action-mode'),
  QuestController.activateActionMode
);

router.post('/quests/:questId/reveal-actions',
  locationsWriteLimiter,
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:quests:reveal-actions'),
  QuestController.revealActions
);

// Bot-only endpoints (API key auth, no JWT)
// Bot action endpoint REMOVED - moved to /chats/bot (see routes/chats.ts)

router.get('/locations/:locationId/bot-details',
  locationsReadLimiter,
  AuthMiddleware.requireAIGatewayAuth,
  LocationController.getBotLocationDetails
);

router.patch('/locations/:locationId/bot-enabled',
  locationsWriteLimiter,
  AuthMiddleware.requireAIGatewayAuth,
  LocationController.updateBotEnabled
);

export default router;