import { Router } from 'express';
import { ForumTopicManagementController } from '../controllers/ForumTopicManagementController';
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

export default router;
