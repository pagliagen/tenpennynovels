import { Router } from 'express';
import { ExperienceManagementController } from '../controllers/ExperienceManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Apply admin auth middleware to all routes
router.use(AdminAuthMiddleware.requireAdminAccess);

// Experience overview and statistics
router.get('/experience/overview', 
  ExperienceManagementController.getExperienceOverview
);

// Character progression details
router.get('/experience/characters/:characterId/progression', 
  ExperienceManagementController.getCharacterProgressionDetails
);

// Gaming sessions management
router.get('/experience/sessions', 
  ExperienceManagementController.getSessionsOverview
);

// Gaming session creation
router.post('/experience/sessions', 
  ExperienceManagementController.createGamingSession
);

// Gaming session updates
router.put('/experience/sessions/:sessionId', 
  ExperienceManagementController.updateGamingSession
);

// Experience assignment from sessions
router.post('/experience/sessions/:sessionId/assign-experience', 
  ExperienceManagementController.assignSessionExperience
);

// Manual experience grants
router.post('/experience/manual-grant', 
  ExperienceManagementController.manualExperienceGrant
);

export default router;