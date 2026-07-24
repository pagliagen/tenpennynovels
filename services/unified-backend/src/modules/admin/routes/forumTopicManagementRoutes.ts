import { Router } from 'express';
import { ForumTopicManagementController } from '../controllers/ForumTopicManagementController';
import { ForumTopicPermissionManagementController } from '../controllers/ForumTopicPermissionManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

router.use(AdminAuthMiddleware.requireAdminAccess);

router.get(
  '/',
  requireViewPermission('forum.list'),
  AdminAuthMiddleware.logAdminAction('view_forum_topics', 'forum_topic_management'),
  ForumTopicManagementController.getTopics
);

router.get(
  '/:topicId',
  requireViewPermission('forum.list'),
  AdminAuthMiddleware.logAdminAction('view_forum_topic_details', 'forum_topic_management'),
  ForumTopicManagementController.getTopicDetails
);

router.post(
  '/',
  requireViewPermission('forum.manage'),
  AdminAuthMiddleware.logAdminAction('create_forum_topic', 'forum_topic_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumTopicManagementController.createTopic
);

router.put(
  '/:topicId',
  requireViewPermission('forum.manage'),
  AdminAuthMiddleware.logAdminAction('update_forum_topic', 'forum_topic_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumTopicManagementController.updateTopic
);

router.delete(
  '/:topicId',
  requireViewPermission('forum.manage'),
  AdminAuthMiddleware.logAdminAction('delete_forum_topic', 'forum_topic_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumTopicManagementController.deleteTopic
);

// ----- Per-character granular permission overrides -----

router.get(
  '/:topicId/permissions',
  requireViewPermission('forum.manage'),
  AdminAuthMiddleware.logAdminAction('view_forum_topic_permissions', 'forum_topic_management'),
  ForumTopicPermissionManagementController.getOverrides
);

router.put(
  '/:topicId/permissions/:characterId',
  requireViewPermission('forum.manage'),
  AdminAuthMiddleware.logAdminAction('update_forum_topic_permission', 'forum_topic_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumTopicPermissionManagementController.upsertOverride
);

router.delete(
  '/:topicId/permissions/:characterId',
  requireViewPermission('forum.manage'),
  AdminAuthMiddleware.logAdminAction('delete_forum_topic_permission', 'forum_topic_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumTopicPermissionManagementController.deleteOverride
);

export default router;
