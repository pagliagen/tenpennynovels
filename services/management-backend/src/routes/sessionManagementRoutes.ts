import { Router } from 'express';
import { SessionManagementController } from '../controllers/SessionManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Apply admin auth middleware to all routes
router.use(AdminAuthMiddleware.requireAdminAccess);

// Session management overview and statistics
router.get('/sessions/overview', 
  SessionManagementController.getSessionOverview
);

// Session management and monitoring
router.get('/sessions',
  SessionManagementController.getSessions
);

router.get('/sessions/:sessionId',
  SessionManagementController.getSessionDetail
);

// Session status management (admin actions)
router.put('/sessions/:sessionId/status',
  SessionManagementController.updateSessionStatus
);

// Session analytics and reporting
router.get('/sessions/analytics',
  SessionManagementController.getSessionAnalytics
);

// Session templates management
router.get('/session-templates',
  SessionManagementController.getSessionTemplates
);

// Campaign management
router.get('/campaigns',
  SessionManagementController.getCampaigns
);

export default router;