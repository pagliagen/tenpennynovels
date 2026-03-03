import { Router } from 'express';
import { SystemConfigController } from '../controllers/SystemConfigController';
import { CharacterCreationConfigController } from '../controllers/CharacterCreationConfigController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { requireViewPermission } from '../utils/permissions';
import { autoLogOutcome } from '../middleware/auditMiddleware';

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
  AdminAuthMiddleware.logAdminAction('system.config.update', 'system_configuration'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  SystemConfigController.updateSystemConfig
);

// Maintenance mode management
router.post(
  '/maintenance',
  requireViewPermission('system.maintenance_mode'),
  AdminAuthMiddleware.logAdminAction('system.maintenance_mode', 'system_configuration'),
  autoLogOutcome,
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
  AdminAuthMiddleware.logAdminAction('system.broadcast', 'system_configuration'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  SystemConfigController.broadcastMessage
);

router.get(
  '/broadcast/history',
  requireViewPermission('system.broadcast_messages'),
  AdminAuthMiddleware.logAdminAction('view_broadcast_history', 'system_configuration'),
  SystemConfigController.getBroadcastHistory
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
  AdminAuthMiddleware.logAdminAction('system.config.update', 'system_configuration'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  SystemConfigController.updateConfiguration
);

// Invalidate all cached configurations
router.post(
  '/configurations/invalidate-cache',
  requireViewPermission('system.broadcast_messages'),
  AdminAuthMiddleware.logAdminAction('system.cache.invalidate', 'system_configuration'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  SystemConfigController.invalidateConfigCache
);

// ============================================================================
// Character Creation Configuration Management (JSON File Based)
// ============================================================================

// Get character creation configuration
router.get(
  '/character-creation-config',
  requireViewPermission('system.broadcast_messages'),
  AdminAuthMiddleware.logAdminAction('view_character_creation_config', 'system_configuration'),
  CharacterCreationConfigController.getConfig
);

// Update character creation configuration
router.put(
  '/character-creation-config',
  requireViewPermission('system.broadcast_messages'),
  AdminAuthMiddleware.logAdminAction('system.character_config.update', 'system_configuration'),
  autoLogOutcome,
  AdminAuthMiddleware.sensitiveOperationLimit(),
  CharacterCreationConfigController.updateConfig
);

// Invalidate character creation config cache
router.post(
  '/character-creation-config/invalidate-cache',
  requireViewPermission('system.broadcast_messages'),
  AdminAuthMiddleware.logAdminAction('system.cache.invalidate', 'system_configuration'),
  autoLogOutcome,
  CharacterCreationConfigController.invalidateCache
);

// Validate character creation configuration
router.post(
  '/character-creation-config/validate',
  requireViewPermission('system.broadcast_messages'),
  CharacterCreationConfigController.validateConfig
);

export { router as systemRoutes };