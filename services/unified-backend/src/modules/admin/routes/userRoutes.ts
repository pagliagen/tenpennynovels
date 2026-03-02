import { Router } from 'express';
import { UserManagementController } from '../controllers/UserManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

// All user routes require admin access
router.use(AdminAuthMiddleware.requireAdminAccess);

// User listing and search routes - require users.read permission
router.get(
  '/',
  requireViewPermission('users.read'),
  AdminAuthMiddleware.logAdminAction('view_users_list', 'user_management'),
  UserManagementController.getUsers
);

router.get(
  '/search',
  requireViewPermission('users.read'),
  AdminAuthMiddleware.logAdminAction('search_users', 'user_management'),
  UserManagementController.searchUsers
);

router.get(
  '/summary',
  requireViewPermission('users.read'),
  AdminAuthMiddleware.logAdminAction('view_user_summary', 'user_management'),
  UserManagementController.getUserSummary
);

// Individual user management routes
router.get(
  '/:userId',
  requireViewPermission('users.read'),
  AdminAuthMiddleware.logAdminAction('view_user_profile', 'user_management'),
  UserManagementController.getUserProfile
);

router.post(
  '/:userId/ban',
  requireViewPermission('users.ban'),
  AdminAuthMiddleware.logAdminAction('ban_user', 'user_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  UserManagementController.banUser
);

router.patch(
  '/:userId/ban',
  requireViewPermission('users.ban'),
  AdminAuthMiddleware.logAdminAction('update_ban', 'user_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  UserManagementController.updateBan
);

router.delete(
  '/:userId/ban',
  requireViewPermission('users.ban'),
  AdminAuthMiddleware.logAdminAction('unban_user', 'user_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  UserManagementController.unbanUser
);

router.patch(
  '/:userId',
  requireViewPermission('users.update'),
  AdminAuthMiddleware.logAdminAction('update_user', 'user_management'),
  UserManagementController.updateUser
);


router.patch(
  '/:userId/permissions',
  requireViewPermission('manager.manage_user_permissions'),
  AdminAuthMiddleware.logAdminAction('update_user_permissions', 'user_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  UserManagementController.updateUserPermissions
);

export { router as userRoutes };