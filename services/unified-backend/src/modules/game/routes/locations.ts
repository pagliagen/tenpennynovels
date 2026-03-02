import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { banChecks } from '@shared/middleware/banCheck';
import { LocationController } from '../controllers/LocationController';
// LocationActionsController removed - moved to LocationChatsController in chats.ts
import { LocationTagController } from '../controllers/LocationTagController';
import { BlockNotesController } from '../controllers/BlockNotesController';
import { QuestController } from '../controllers/QuestController';

const router = Router();

// Location routes (require character auth)
router.get('/locations', 
  AuthMiddleware.requireCharacterAuth, 
  LocationController.getAccessibleLocations
);

router.get('/locations/:locationId', 
  AuthMiddleware.requireCharacterAuth, 
  LocationController.getLocation
);

router.post('/locations/:locationId/enter',
  AuthMiddleware.requireCharacterAuth,
  banChecks.game(), // Check if user is banned from game
  LocationController.enterLocation
);

router.post('/locations/leave',
  AuthMiddleware.requireCharacterAuth,
  banChecks.game(), // Check if user is banned from game
  LocationController.leaveLocation
);

router.get('/locations/:locationId/access', 
  AuthMiddleware.requireCharacterAuth, 
  LocationController.checkAccess
);

router.post('/locations/:locationId/grant-access', 
  AuthMiddleware.requireCharacterAuth, 
  LocationController.grantAccess
);

router.get('/locations/:locationId/occupants', 
  AuthMiddleware.requireCharacterAuth, 
  LocationController.getLocationOccupants
);

router.patch('/locations/:locationId/occupant-tag',
  AuthMiddleware.requireCharacterAuth,
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

// Location tags routes
router.get('/location-tags', 
  AuthMiddleware.requireCharacterAuth, 
  LocationTagController.getTags
);

router.post('/location-tags', 
  AuthMiddleware.requireUserAuth,
  AuthMiddleware.requireAdminAccess, // Admin only
  LocationTagController.createTag
);

router.patch('/location-tags/:tagId', 
  AuthMiddleware.requireUserAuth,
  AuthMiddleware.requireAdminAccess, // Admin only
  LocationTagController.updateTag
);

router.delete('/location-tags/:tagId', 
  AuthMiddleware.requireUserAuth,
  AuthMiddleware.requireAdminAccess, // Admin only
  LocationTagController.deleteTag
);

// Block notes routes
router.get('/block-notes', 
  AuthMiddleware.requireCharacterAuth, 
  BlockNotesController.getNotes
);

router.post('/block-notes', 
  AuthMiddleware.requireCharacterAuth, 
  BlockNotesController.saveNotes
);

router.delete('/block-notes/:notesId', 
  AuthMiddleware.requireCharacterAuth, 
  BlockNotesController.deleteNotes
);

// Quest routes (using GamingSession)
router.post('/quests', 
  AuthMiddleware.requireCharacterAuth, 
  QuestController.createQuest
);

router.get('/quests/:questId', 
  AuthMiddleware.requireCharacterAuth, 
  QuestController.getQuestStatus
);

router.post('/quests/:questId/start', 
  AuthMiddleware.requireCharacterAuth, 
  QuestController.startQuest
);

router.post('/quests/:questId/end', 
  AuthMiddleware.requireCharacterAuth, 
  QuestController.endQuest
);

router.post('/quests/:questId/action-mode', 
  AuthMiddleware.requireCharacterAuth, 
  QuestController.activateActionMode
);

router.post('/quests/:questId/reveal-actions',
  AuthMiddleware.requireCharacterAuth,
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