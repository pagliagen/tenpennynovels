import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { banChecks } from '@shared/middleware/banCheck';
import { requireGamePermission } from '../middleware/gamePermissions';
import { LocationController } from '../controllers/LocationController';
// LocationActionsController removed - moved to LocationChatsController in chats.ts
import { LocationTagController } from '../controllers/LocationTagController';
import { BlockNotesController } from '../controllers/BlockNotesController';
import { QuestController } from '../controllers/QuestController';

const router = Router();

// Location routes (require character auth)
router.get('/locations',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:list'),
  LocationController.getAccessibleLocations
);

router.get('/locations/:locationId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:read'),
  LocationController.getLocation
);

router.post('/locations/:locationId/enter',
  AuthMiddleware.requireCharacterAuth,
  banChecks.game(), // Check if user is banned from game
  requireGamePermission('game:locations:enter'),
  LocationController.enterLocation
);

router.post('/locations/leave',
  AuthMiddleware.requireCharacterAuth,
  banChecks.game(), // Check if user is banned from game
  requireGamePermission('game:locations:leave'),
  LocationController.leaveLocation
);

router.get('/locations/:locationId/access',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:check-access'),
  LocationController.checkAccess
);

router.post('/locations/:locationId/grant-access',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:grant-access'),
  LocationController.grantAccess
);

router.get('/locations/:locationId/occupants',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:list-occupants'),
  LocationController.getLocationOccupants
);

router.patch('/locations/:locationId/occupant-tag',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:locations:tag-occupant'),
  LocationController.updateOccupantTag
);

// Location actions routes REMOVED - moved to /chats route (see chats.ts)
// Old routes:
//   POST   /locations/actions
//   GET    /locations/actions/:locationId
//   PATCH  /locations/actions/:actionId
//   DELETE /locations/actions/:actionId
//   DELETE /locations/:locationId/actions
//   POST   /locations/actions/social-conflict
// New routes: /chats/* (see routes/chats.ts)

// Location tags routes (Admin only)
router.get('/location-tags',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:admin:location-tags:read'),
  LocationTagController.getTags
);

router.post('/location-tags',
  AuthMiddleware.requireUserAuth,
  AuthMiddleware.requireAdminAccess, // Admin only
  requireGamePermission('game:admin:location-tags:create'),
  LocationTagController.createTag
);

router.patch('/location-tags/:tagId',
  AuthMiddleware.requireUserAuth,
  AuthMiddleware.requireAdminAccess, // Admin only
  requireGamePermission('game:admin:location-tags:update'),
  LocationTagController.updateTag
);

router.delete('/location-tags/:tagId',
  AuthMiddleware.requireUserAuth,
  AuthMiddleware.requireAdminAccess, // Admin only
  requireGamePermission('game:admin:location-tags:delete'),
  LocationTagController.deleteTag
);

// Block notes routes (Personal location notes)
router.get('/block-notes',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:block-notes:read'),
  BlockNotesController.getNotes
);

router.post('/block-notes',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:block-notes:write'),
  BlockNotesController.saveNotes
);

router.delete('/block-notes/:notesId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:block-notes:delete'),
  BlockNotesController.deleteNotes
);

// Quest routes (using GamingSession)
router.post('/quests',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:quests:create'),
  QuestController.createQuest
);

router.get('/quests/:questId',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:quests:read'),
  QuestController.getQuestStatus
);

router.post('/quests/:questId/start',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:quests:start'),
  QuestController.startQuest
);

router.post('/quests/:questId/end',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:quests:end'),
  QuestController.endQuest
);

router.post('/quests/:questId/action-mode',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:quests:action-mode'),
  QuestController.activateActionMode
);

router.post('/quests/:questId/reveal-actions',
  AuthMiddleware.requireCharacterAuth,
  requireGamePermission('game:quests:reveal-actions'),
  QuestController.revealActions
);

// Bot-only endpoints (API key auth, no JWT)
// Bot action endpoint REMOVED - moved to /chats/bot (see routes/chats.ts)

router.get('/locations/:locationId/bot-details',
  AuthMiddleware.requireBotApiKey,
  LocationController.getBotLocationDetails
);

router.patch('/locations/:locationId/bot-enabled',
  AuthMiddleware.requireBotApiKey,
  LocationController.updateBotEnabled
);

export default router;