import { Router } from 'express';
import { ChatMonitoringController } from '../controllers/ChatMonitoringController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

// All chat monitoring routes require admin access
router.use(AdminAuthMiddleware.requireAdminAccess);

// Chat search and monitoring routes
router.post(
  '/search',
  requireViewPermission('chat.search_messages'),
  AdminAuthMiddleware.logAdminAction('search_messages', 'chat_monitoring'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ChatMonitoringController.searchMessages
);

router.get(
  '/monitoring/realtime',
  requireViewPermission('chat.view_activity'),
  AdminAuthMiddleware.logAdminAction('view_realtime_activity', 'chat_monitoring'),
  ChatMonitoringController.getRealTimeActivity
);

// User reports management
router.get(
  '/reports',
  requireViewPermission('chat.view_reports'),
  AdminAuthMiddleware.logAdminAction('view_reports', 'chat_monitoring'),
  ChatMonitoringController.getPendingReports
);

// Moderation history
router.get(
  '/moderation/character/:characterId',
  requireViewPermission('chat.view_moderation'),
  AdminAuthMiddleware.logAdminAction('view_moderation_history', 'chat_monitoring'),
  ChatMonitoringController.getCharacterModerationHistory
);

export { router as chatMonitoringRoutes };