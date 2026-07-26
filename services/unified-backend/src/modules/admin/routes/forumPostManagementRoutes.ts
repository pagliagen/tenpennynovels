import { Router } from 'express';
import { ForumPostManagementController } from '../controllers/ForumPostManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

router.use(AdminAuthMiddleware.requireAdminAccess);

router.get(
  '/',
  requireViewPermission('forum.list'),
  AdminAuthMiddleware.logAdminAction('view_forum_posts', 'forum_post_management'),
  ForumPostManagementController.getPosts
);

router.put(
  '/:postId/pin',
  requireViewPermission('forum.manage'),
  AdminAuthMiddleware.logAdminAction('pin_forum_post', 'forum_post_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumPostManagementController.pinPost
);

router.delete(
  '/:postId',
  requireViewPermission('forum.manage'),
  AdminAuthMiddleware.logAdminAction('delete_forum_post', 'forum_post_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumPostManagementController.softDeletePost
);

router.post(
  '/:postId/restore',
  requireViewPermission('forum.manage'),
  AdminAuthMiddleware.logAdminAction('restore_forum_post', 'forum_post_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumPostManagementController.restorePost
);

export default router;
