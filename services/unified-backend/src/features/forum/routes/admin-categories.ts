import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ForumCategoryManagementController } from '../controllers/ForumCategoryManagementController';
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
  AdminAuthMiddleware.logAdminAction('view_forum_categories', 'forum_category_management'),
  ForumCategoryManagementController.getCategories
);

router.get(
  '/:categoryId',
  requireViewPermission('forum.list'),
  AdminAuthMiddleware.logAdminAction('view_forum_category_details', 'forum_category_management'),
  ForumCategoryManagementController.getCategoryDetails
);

router.post(
  '/',
  requireViewPermission('forum.manage'),
  AdminAuthMiddleware.logAdminAction('create_forum_category', 'forum_category_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumCategoryManagementController.createCategory
);

router.put(
  '/:categoryId',
  requireViewPermission('forum.manage'),
  AdminAuthMiddleware.logAdminAction('update_forum_category', 'forum_category_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumCategoryManagementController.updateCategory
);

router.delete(
  '/:categoryId',
  requireViewPermission('forum.manage'),
  AdminAuthMiddleware.logAdminAction('delete_forum_category', 'forum_category_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  ForumCategoryManagementController.deleteCategory
);

export default router;
