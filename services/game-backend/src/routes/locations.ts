import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { banChecks } from '../../../shared/src/middleware/banCheck';
import { LocationController } from '../controllers/LocationController';
import { LocationActionsController } from '../controllers/LocationActionsController';
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

// Location actions routes (HTTP-based for security)
router.post('/locations/actions', 
  AuthMiddleware.requireCharacterAuth,
  banChecks.chat(), // Check if user is banned from chat (covers location messages)
  LocationActionsController.createAction
);

router.get('/locations/actions/:locationId', 
  AuthMiddleware.requireCharacterAuth, 
  LocationActionsController.getLocationActions
);

router.patch('/locations/actions/:actionId', 
  AuthMiddleware.requireCharacterAuth,
  banChecks.chat(),
  LocationActionsController.updateAction
);

router.delete('/locations/actions/:actionId', 
  AuthMiddleware.requireCharacterAuth,
  LocationActionsController.deleteAction
);

router.delete('/locations/:locationId/actions', 
  AuthMiddleware.requireCharacterAuth,
  LocationActionsController.clearChat
);

router.post('/locations/actions/social-conflict', 
  AuthMiddleware.requireCharacterAuth,
  banChecks.chat(),
  LocationActionsController.createSocialConflict
);

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

export default router;