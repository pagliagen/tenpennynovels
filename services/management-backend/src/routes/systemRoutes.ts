import { Router } from 'express';
import { SystemConfigController } from '../controllers/SystemConfigController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';

const router = Router();

// All system routes require admin access
router.use(AdminAuthMiddleware.requireAdminAccess);

// System configuration routes - require canConfigureSystem permission
router.get(
  '/config',
  requireViewPermission('system.broadcast_messages'),
  AdminAuthMiddleware.logAdminAction('view_system_config', 'system_configuration'),
  SystemConfigController.getSystemConfig
);

router.patch(
  '/config',
  requireViewPermission('system.broadcast_messages'),
  AdminAuthMiddleware.logAdminAction('update_system_config', 'system_configuration'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  SystemConfigController.updateSystemConfig
);

// Maintenance mode management  
router.post(
  '/maintenance',
  requireViewPermission('system.maintenance_mode'),
  AdminAuthMiddleware.logAdminAction('set_maintenance_mode', 'system_configuration'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  SystemConfigController.setMaintenanceMode
);

// System monitoring and statistics
router.get(
  '/stats',
  requireViewPermission('system.view_logs'),
  AdminAuthMiddleware.logAdminAction('view_system_stats', 'system_configuration'),
  SystemConfigController.getSystemStats
);

// Audit log management
router.get(
  '/audit-logs',
  requireViewPermission('system.view_logs'),
  AdminAuthMiddleware.logAdminAction('view_audit_logs', 'system_configuration'),
  SystemConfigController.getAuditLogs
);

router.post(
  '/audit-logs',
  // All authenticated users can submit audit logs (the logs themselves contain auth info)
  SystemConfigController.submitAuditLogs
);

router.get(
  '/audit-logs/export',
  requireViewPermission('system.view_logs'),
  AdminAuthMiddleware.logAdminAction('export_audit_logs', 'system_configuration'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  SystemConfigController.exportAuditLogs
);

// System communication
router.post(
  '/broadcast',
  requireViewPermission('system.broadcast_messages'),
  AdminAuthMiddleware.logAdminAction('broadcast_message', 'system_configuration'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  SystemConfigController.broadcastMessage
);

// ============================================================================
// System Configuration Management (Email Templates & Constants)
// ============================================================================

// Get all configurations or filter by section
router.get(
  '/configurations',
  requireViewPermission('system.broadcast_messages'), // Reusing system permission
  AdminAuthMiddleware.logAdminAction('view_configurations', 'system_configuration'),
  SystemConfigController.getConfigurations
);

// Get specific configuration by key
router.get(
  '/configurations/:configKey',
  requireViewPermission('system.broadcast_messages'),
  AdminAuthMiddleware.logAdminAction('view_configuration_detail', 'system_configuration'),
  SystemConfigController.getConfigurationByKey
);

// Update configuration value
router.patch(
  '/configurations/:configKey',
  requireViewPermission('system.broadcast_messages'),
  AdminAuthMiddleware.logAdminAction('update_configuration', 'system_configuration'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  SystemConfigController.updateConfiguration
);

// Invalidate all cached configurations
router.post(
  '/configurations/invalidate-cache',
  requireViewPermission('system.broadcast_messages'),
  AdminAuthMiddleware.logAdminAction('invalidate_config_cache', 'system_configuration'),
  AdminAuthMiddleware.sensitiveOperationLimit(),
  SystemConfigController.invalidateConfigCache
);

export { router as systemRoutes };