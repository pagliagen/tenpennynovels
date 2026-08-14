import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ForumPostManagementController } from '../controllers/ForumPostManagementController';
import { AdminAuthMiddleware } from '@modules/admin/middleware/adminAuth';
import { requireViewPermission } from '@modules/admin/utils/permissions';

const router = Router();

// CodeQL (js/missing-rate-limiting): limiter generico prima ancora
// dell'auth check, per proteggere anche quest'ultimo da un flood.
const routeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});
router.use(routeLimiter);

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
