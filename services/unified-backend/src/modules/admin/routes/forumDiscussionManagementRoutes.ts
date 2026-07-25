import { Router } from 'express';
import { ForumDiscussionManagementController } from '../controllers/ForumDiscussionManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

router.use(AdminAuthMiddleware.requireAdminAccess);

router.get(
  '/',
  requireViewPermission('forum.list'),
  AdminAuthMiddleware.logAdminAction('view_forum_discussions', 'forum_discussion_management'),
  ForumDiscussionManagementController.getDiscussions
);

router.put(
  '/:discussionId',
  requireViewPermission('forum.manage'),
  AdminAuthMiddleware.logAdminAction('update_forum_discussion', 'forum_discussion_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumDiscussionManagementController.updateDiscussion
);

router.delete(
  '/:discussionId',
  requireViewPermission('forum.manage'),
  AdminAuthMiddleware.logAdminAction('delete_forum_discussion', 'forum_discussion_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumDiscussionManagementController.softDeleteDiscussion
);

router.post(
  '/:discussionId/restore',
  requireViewPermission('forum.manage'),
  AdminAuthMiddleware.logAdminAction('restore_forum_discussion', 'forum_discussion_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumDiscussionManagementController.restoreDiscussion
);

export default router;
