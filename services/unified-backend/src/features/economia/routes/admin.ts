import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { SocialClassManagementController } from '../controllers/SocialClassManagementController';
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

// All social class management routes require admin access
router.use(AdminAuthMiddleware.requireAdminAccess);

// Static routes MUST come before parameterized routes
router.get(
  '/',
  requireViewPermission('social_classes.access'),
  AdminAuthMiddleware.logAdminAction('view_social_classes', 'social_class_management'),
  SocialClassManagementController.getSocialClasses
);

router.get(
  '/stats',
  requireViewPermission('social_classes.access'),
  AdminAuthMiddleware.logAdminAction('view_social_class_stats', 'social_class_management'),
  SocialClassManagementController.getSocialClassStats
);

router.get(
  '/characters/distribution',
  requireViewPermission('social_classes.access'),
  AdminAuthMiddleware.logAdminAction('view_character_distribution', 'social_class_management'),
  SocialClassManagementController.getCharacterDistribution
);

router.post(
  '/',
  requireViewPermission('social_classes.manage'),
  AdminAuthMiddleware.logAdminAction('create_social_class', 'social_class_management'),
  SocialClassManagementController.createSocialClass
);

router.post(
  '/reorder',
  requireViewPermission('social_classes.manage'),
  AdminAuthMiddleware.logAdminAction('reorder_social_classes', 'social_class_management'),
  SocialClassManagementController.reorderSocialClasses
);

// Parameterized routes AFTER all static ones
router.get(
  '/:socialClassId',
  requireViewPermission('social_classes.access'),
  AdminAuthMiddleware.logAdminAction('view_social_class_details', 'social_class_management'),
  SocialClassManagementController.getSocialClassDetails
);

router.put(
  '/:socialClassId',
  requireViewPermission('social_classes.manage'),
  AdminAuthMiddleware.logAdminAction('update_social_class', 'social_class_management'),
  SocialClassManagementController.updateSocialClass
);

router.delete(
  '/:socialClassId',
  requireViewPermission('social_classes.manage'),
  AdminAuthMiddleware.logAdminAction('delete_social_class', 'social_class_management'),
  SocialClassManagementController.deleteSocialClass
);

export default router;
