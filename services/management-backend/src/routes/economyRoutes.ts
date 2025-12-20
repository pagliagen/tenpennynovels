import { Router } from 'express';
import { EconomyAdminController } from '../controllers/EconomyAdminController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

// All economy routes require admin access
router.use(AdminAuthMiddleware.requireAdminAccess);

// Money management routes - require canManageEconomy permission
router.post(
  '/grant',
  requireViewPermission('economy.grant_money'),
  AdminAuthMiddleware.logAdminAction('grant_money', 'economy_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  EconomyAdminController.grantMoney
);

router.post(
  '/adjust',
  requireViewPermission('economy.adjust_balances'),
  AdminAuthMiddleware.logAdminAction('adjust_money', 'economy_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  EconomyAdminController.adjustMoney
);

router.post(
  '/bulk-grant',
  requireViewPermission('economy.grant_money'),
  AdminAuthMiddleware.logAdminAction('bulk_grant_money', 'economy_management'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  EconomyAdminController.bulkGrantMoney
);

// Transaction and reporting routes
router.get(
  '/transactions',
  requireViewPermission('economy.view_reports'),
  AdminAuthMiddleware.logAdminAction('view_transactions', 'economy_management'),
  EconomyAdminController.getTransactions
);

router.get(
  '/reports',
  requireViewPermission('economy.view_reports'),
  AdminAuthMiddleware.logAdminAction('view_economic_reports', 'economy_management'),
  EconomyAdminController.getEconomicReports
);

router.get(
  '/config',
  requireViewPermission('economy.view_reports'),
  AdminAuthMiddleware.logAdminAction('view_economy_config', 'economy_management'),
  EconomyAdminController.getEconomyConfig
);

// Character-specific financial routes
router.get(
  '/character/:characterId',
  requireViewPermission('economy.grant_money'),
  AdminAuthMiddleware.logAdminAction('view_character_finances', 'economy_management'),
  EconomyAdminController.getCharacterFinances
);

export { router as economyRoutes };