import { Router } from 'express';
import { SkillManagementController } from '../controllers/SkillManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

// All skills management routes require admin access
router.use(AdminAuthMiddleware.requireAdminAccess);

// Skills listing and statistics routes
router.get(
  '/',
  requireViewPermission('skills.access'),
  AdminAuthMiddleware.logAdminAction('view_skills', 'skill_management'),
  SkillManagementController.getSkills
);

router.get(
  '/stats',
  requireViewPermission('skills.access'),
  AdminAuthMiddleware.logAdminAction('view_skill_stats', 'skill_management'),
  SkillManagementController.getSkillStats
);

// Skill detail and management routes
router.get(
  '/:skillId',
  requireViewPermission('skills.detail.view'),
  AdminAuthMiddleware.logAdminAction('view_skill_details', 'skill_management'),
  SkillManagementController.getSkillDetails
);

router.post(
  '/',
  requireViewPermission('skills.create'),
  AdminAuthMiddleware.logAdminAction('create_skill', 'skill_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  SkillManagementController.createSkill
);

router.put(
  '/:skillId',
  requireViewPermission('skills.detail.update'),
  AdminAuthMiddleware.logAdminAction('update_skill', 'skill_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  SkillManagementController.updateSkill
);

router.delete(
  '/:skillId',
  requireViewPermission('skills.detail.delete'),
  AdminAuthMiddleware.logAdminAction('delete_skill', 'skill_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  SkillManagementController.deleteSkill
);

// Bulk operations
router.post(
  '/bulk',
  requireViewPermission('skills.detail.update'),
  AdminAuthMiddleware.logAdminAction('bulk_skill_operation', 'skill_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  SkillManagementController.bulkOperations
);

// Skills reordering
router.post(
  '/reorder',
  requireViewPermission('skills.detail.update'),
  AdminAuthMiddleware.logAdminAction('reorder_skills', 'skill_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  SkillManagementController.reorderSkills
);

export default router;