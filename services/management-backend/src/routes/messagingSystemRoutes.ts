import { Router } from 'express';
import { MessagingSystemController } from '../controllers/MessagingSystemController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

// All messaging system routes require admin access
router.use(AdminAuthMiddleware.requireAdminAccess);

// Chat listing and statistics routes
router.get(
  '/',
  requireViewPermission('messaging.access'),
  AdminAuthMiddleware.logAdminAction('view_chats', 'messaging_system'),
  MessagingSystemController.getChats
);

router.get(
  '/stats',
  requireViewPermission('messaging.access'),
  AdminAuthMiddleware.logAdminAction('view_messaging_stats', 'messaging_system'),
  MessagingSystemController.getMessagingStats
);

// Chat detail and management routes
router.get(
  '/chat/:chatId',
  requireViewPermission('messaging.detail.view'),
  AdminAuthMiddleware.logAdminAction('view_chat_details', 'messaging_system'),
  MessagingSystemController.getChatDetails
);

router.delete(
  '/chat/:chatId',
  requireViewPermission('messaging.detail.delete'),
  AdminAuthMiddleware.logAdminAction('delete_chat', 'messaging_system'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  MessagingSystemController.deleteChat
);

router.delete(
  '/message/:messageId',
  requireViewPermission('messaging.detail.delete'),
  AdminAuthMiddleware.logAdminAction('delete_message', 'messaging_system'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  MessagingSystemController.deleteMessage
);

// Participant moderation
router.post(
  '/chat/:chatId/participant/:participantId/moderate',
  requireViewPermission('messaging.moderation.manage'),
  AdminAuthMiddleware.logAdminAction('moderate_participant', 'messaging_system'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  MessagingSystemController.moderateParticipant
);

// Bulk operations
router.post(
  '/bulk',
  requireViewPermission('messaging.detail.update'),
  AdminAuthMiddleware.logAdminAction('bulk_messaging_operation', 'messaging_system'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  MessagingSystemController.bulkOperations
);

// Cleanup recommendations
router.get(
  '/cleanup',
  requireViewPermission('messaging.maintenance.view'),
  AdminAuthMiddleware.logAdminAction('view_cleanup_recommendations', 'messaging_system'),
  MessagingSystemController.getCleanupRecommendations
);

export default router;