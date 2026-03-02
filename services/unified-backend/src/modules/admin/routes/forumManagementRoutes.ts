import { Router } from 'express';
import { ForumManagementController } from '../controllers/ForumManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

// All forum management routes require admin access
router.use(AdminAuthMiddleware.requireAdminAccess);

// Message listing and statistics routes
router.get(
  '/',
  requireViewPermission('forum.access'),
  AdminAuthMiddleware.logAdminAction('view_messages', 'forum_management'),
  ForumManagementController.getMessages
);

router.get(
  '/stats',
  requireViewPermission('forum.access'),
  AdminAuthMiddleware.logAdminAction('view_forum_stats', 'forum_management'),
  ForumManagementController.getMessageStats
);

// Message detail and management routes
router.get(
  '/:messageId',
  requireViewPermission('forum.detail.view'),
  AdminAuthMiddleware.logAdminAction('view_message_details', 'forum_management'),
  ForumManagementController.getMessageDetails
);

router.delete(
  '/:messageId',
  requireViewPermission('forum.detail.delete'),
  AdminAuthMiddleware.logAdminAction('delete_message', 'forum_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumManagementController.deleteMessage
);

// Bulk operations
router.post(
  '/bulk',
  requireViewPermission('forum.detail.update'),
  AdminAuthMiddleware.logAdminAction('bulk_forum_operation', 'forum_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumManagementController.bulkMessageOperations
);

// Delivery queue management
router.get(
  '/delivery/queue',
  requireViewPermission('forum.delivery.view'),
  AdminAuthMiddleware.logAdminAction('view_delivery_queue', 'forum_management'),
  ForumManagementController.getDeliveryQueue
);

router.post(
  '/delivery/manual',
  requireViewPermission('forum.delivery.manage'),
  AdminAuthMiddleware.logAdminAction('manual_delivery', 'forum_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumManagementController.triggerManualDelivery
);

export default router;