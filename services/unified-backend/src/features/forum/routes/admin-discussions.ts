import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ForumDiscussionManagementController } from '../controllers/ForumDiscussionManagementController';
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
