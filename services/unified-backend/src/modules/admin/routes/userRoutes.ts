import { Router } from 'express';
import { UserManagementController } from '../controllers/UserManagementController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';
import { autoLogOutcome } from '../middleware/auditMiddleware';

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
  AdminAuthMiddleware.logAdminAction('user.ban', 'user_management'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  UserManagementController.banUser
);

router.patch(
  '/:userId/ban',
  requireViewPermission('users.ban'),
  AdminAuthMiddleware.logAdminAction('user.update_ban', 'user_management'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  UserManagementController.updateBan
);

router.delete(
  '/:userId/ban',
  requireViewPermission('users.ban'),
  AdminAuthMiddleware.logAdminAction('user.unban', 'user_management'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  UserManagementController.unbanUser
);

// Bulk ban/unban operations
router.post(
  '/bulk-ban',
  requireViewPermission('users.ban'),
  AdminAuthMiddleware.logAdminAction('user.bulk_ban', 'user_management'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  UserManagementController.bulkBanUsers
);

router.post(
  '/bulk-unban',
  requireViewPermission('users.ban'),
  AdminAuthMiddleware.logAdminAction('user.bulk_unban', 'user_management'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  UserManagementController.bulkUnbanUsers
);

// Bulk activate/deactivate operations
router.post(
  '/bulk-activate',
  requireViewPermission('users.update'),
  AdminAuthMiddleware.logAdminAction('user.bulk_activate', 'user_management'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  UserManagementController.bulkActivateUsers
);

router.post(
  '/bulk-deactivate',
  requireViewPermission('users.update'),
  AdminAuthMiddleware.logAdminAction('user.bulk_deactivate', 'user_management'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  UserManagementController.bulkDeactivateUsers
);

router.patch(
  '/:userId',
  requireViewPermission('users.update'),
  AdminAuthMiddleware.logAdminAction('user.update', 'user_management'),
  autoLogOutcome,
  UserManagementController.updateUser
);

router.patch(
  '/:userId/permissions',
  requireViewPermission('manager.manage_user_permissions'),
  AdminAuthMiddleware.logAdminAction('user.change_permissions', 'user_management'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  UserManagementController.updateUserPermissions
);

export { router as userRoutes };