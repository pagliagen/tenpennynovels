import { Request, Response } from 'express';
import { 
  ApiResponse, 
  SystemConfig,
  AuditLog,
  PaginationInfo
} from '../types/management';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';

export class SystemConfigController {
  /**
   * Get current system configuration
   * GET /admin/system/config
   */
  static async getSystemConfig(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement database query for system configuration
      const mockConfig: SystemConfig = {
        gameSettings: {
          newCharacterApprovalRequired: true,
          maxCharactersPerUser: 3,
          characterCreationEnabled: true,
          aiCharacterGenerationEnabled: true,
          npcInteractionEnabled: true,
          locationChatEnabled: true
        },
        economySettings: {
          startingCash: 50,
          startingDeposit: 200,
          dailySalaryEnabled: true,
          inflationRate: 0.02,
          taxationEnabled: false
        },
        moderationSettings: {
          chatModerationEnabled: true,
          autoModerationLevel: 'medium',
          reportSystemEnabled: true,
          appealProcessEnabled: true
        },
        messageSettings: {
          maxMessageLength: 2000,
          messageEditTimeLimit: 300,
          messageHistoryRetention: 365,
          postalDeliveryEnabled: true,
          postalDelaySimulation: true
        },
        maintenanceMode: {
          enabled: false,
          message: '',
          allowedUsers: [],
          estimatedCompletion: undefined
        }
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed system configuration', auditInfo);

      const response: ApiResponse<SystemConfig> = {
        success: true,
        data: mockConfig,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching system config:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare la configurazione di sistema',
        code: 'FETCH_SYSTEM_CONFIG_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Update system configuration
   * PATCH /admin/system/config
   */
  static async updateSystemConfig(req: Request, res: Response): Promise<void> {
    try {
      const updates = req.body;
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Il motivo dell\'aggiornamento è richiesto',
          code: 'UPDATE_REASON_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // TODO: Implement configuration update logic
      // - Validate configuration changes
      // - Update configuration in database
      // - Create audit log entry
      // - Publish Redis event for real-time config updates
      // - Restart services if needed

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('System configuration updated by admin', {
        ...auditInfo,
        updates: {
          gameSettings: updates.gameSettings,
          economySettings: updates.economySettings,
          moderationSettings: updates.moderationSettings,
          messageSettings: updates.messageSettings,
          maintenanceMode: updates.maintenanceMode
        },
        reason,
        category: 'system_configuration'
      });

      // TODO: Send Redis event for real-time config updates
      // await redisClient.publish('system:config_updated', {
      //   updates,
      //   updatedBy: req.user?.userId,
      //   reason,
      //   timestamp: new Date().toISOString()
      // });

      const response: ApiResponse<{ action: string; reason: string }> = {
        success: true,
        data: {
          action: 'configuration_updated',
          reason
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error updating system config:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        requestBody: req.body,
        params: req.params
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile aggiornare la configurazione di sistema',
        code: 'UPDATE_SYSTEM_CONFIG_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Enable/disable maintenance mode
   * POST /admin/system/maintenance
   */
  static async setMaintenanceMode(req: Request, res: Response): Promise<void> {
    try {
      const { enabled, message, allowedUsers, estimatedCompletion } = req.body;

      if (typeof enabled !== 'boolean') {
        const response: ApiResponse = {
          success: false,
          error: 'enabled deve essere un booleano',
          code: 'INVALID_MAINTENANCE_MODE',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (enabled && (!message || message.trim().length === 0)) {
        const response: ApiResponse = {
          success: false,
          error: 'Il messaggio di manutenzione è richiesto quando si attiva la modalità manutenzione',
          code: 'MAINTENANCE_MESSAGE_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // TODO: Implement maintenance mode logic
      // - Update maintenance mode configuration
      // - Notify all active users
      // - Disconnect non-allowed users if enabled
      // - Create audit log entry
      // - Publish Redis event

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.warn('Maintenance mode changed by admin', {
        ...auditInfo,
        enabled,
        message,
        allowedUsers: allowedUsers || [],
        estimatedCompletion,
        category: 'system_configuration'
      });

      const response: ApiResponse<{ enabled: boolean; message?: string }> = {
        success: true,
        data: {
          enabled,
          message: enabled ? message : undefined
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error setting maintenance mode:', { error: error instanceof Error ? error.message : String(error) });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile impostare la modalità manutenzione',
        code: 'SET_MAINTENANCE_MODE_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get audit logs with filtering and pagination
   * GET /admin/system/audit-logs
   */
  static async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const category = req.query.category as string;
      const adminUserId = req.query.adminUserId as string;
      const severity = req.query.severity as string;
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const sortBy = req.query.sortBy as string || 'timestamp';
      const sortOrder = req.query.sortOrder as string || 'desc';

      // TODO: Implement database query for audit logs
      const mockAuditLogs: AuditLog[] = [
        {
          id: 'audit_1',
          timestamp: '2024-01-15T14:30:00Z',
          adminUser: {
            id: 'admin1',
            username: 'admin',
            userRoles: ['user'],
            characterRoles: ['master']
          },
          action: 'character_approved',
          category: 'character_management',
          target: {
            type: 'character',
            id: 'char1',
            name: 'John Smith'
          },
          details: {
            note: 'Character meets all requirements',
            previousStatus: 'PENDING_APPROVAL',
            newStatus: 'APPROVED'
          },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          severity: 'normal'
        },
        {
          id: 'audit_2',
          timestamp: '2024-01-15T13:15:00Z',
          adminUser: {
            id: 'admin1',
            username: 'admin',
            userRoles: ['user'],
            characterRoles: ['master']
          },
          action: 'user_banned',
          category: 'user_management',
          target: {
            type: 'user',
            id: 'user123',
            name: 'troublemaker'
          },
          details: {
            duration: 'temporary',
            bannedUntil: '2024-01-22T13:15:00Z',
            reason: 'Inappropriate behavior in chat',
            banScope: 'chat_only'
          },
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          severity: 'high'
        }
      ];

      const mockPagination: PaginationInfo = {
        currentPage: page,
        totalPages: 1,
        totalItems: mockAuditLogs.length,
        limit,
        hasMore: false
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed audit logs', {
        ...auditInfo,
        filters: { category, adminUserId, severity, dateFrom, dateTo },
        page,
        limit
      });

      const response: ApiResponse<{ logs: AuditLog[]; pagination: PaginationInfo }> = {
        success: true,
        data: {
          logs: mockAuditLogs,
          pagination: mockPagination
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching audit logs:', { error: error instanceof Error ? error.message : String(error) });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare i log di audit',
        code: 'FETCH_AUDIT_LOGS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Submit audit logs from frontend
   * POST /admin/system/audit-logs
   */
  static async submitAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const { logs } = req.body;

      if (!logs || !Array.isArray(logs) || logs.length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Dati log non validi',
          code: 'INVALID_LOGS_DATA',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Extract client IP address
      const clientIp = req.ip || 
                      req.connection.remoteAddress || 
                      req.socket.remoteAddress || 
                      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                      'unknown';

      // Process each log entry
      const processedLogs = logs.map((log: any) => ({
        ...log,
        ipAddress: clientIp,
        timestamp: log.timestamp || new Date().toISOString(),
        source: 'frontend'
      }));

      // TODO: Store logs in database
      // await AuditLogModel.insertMany(processedLogs);

      // Log to Winston for immediate availability
      processedLogs.forEach((log: any) => {
        const logLevel = log.success === false ? 'warn' : 'info';
        logger[logLevel]('Frontend audit log', {
          action: log.action,
          section: log.section,
          details: log.details,
          success: log.success,
          error: log.error,
          userId: log.userId,
          username: log.username,
          userAgent: log.userAgent,
          ipAddress: log.ipAddress,
          timestamp: log.timestamp,
          source: 'frontend'
        });
      });

      // TODO: Publish Redis event for real-time log updates
      // await redisClient.publish('system:audit_logs_submitted', {
      //   count: processedLogs.length,
      //   timestamp: new Date().toISOString()
      // });

      const response: ApiResponse<{ processed: number }> = {
        success: true,
        data: {
          processed: processedLogs.length
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error processing audit logs:', { error: error instanceof Error ? error.message : String(error) });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile elaborare i log di audit',
        code: 'PROCESS_AUDIT_LOGS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Export audit logs as CSV
   * GET /admin/system/audit-logs/export
   */
  static async exportAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const category = req.query.category as string;
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const format = req.query.format as string || 'csv';

      // TODO: Implement audit log export
      // - Query audit logs with filters
      // - Format as CSV or JSON
      // - Create downloadable file
      // - Log the export action

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin exported audit logs', {
        ...auditInfo,
        filters: { category, dateFrom, dateTo },
        format,
        category: 'system_configuration'
      });

      // Mock CSV content
      const csvContent = `ID,Timestamp,Admin User,Action,Category,Target Type,Target ID,Severity,IP Address
audit_1,2024-01-15T14:30:00Z,admin,character_approved,character_management,character,char1,normal,192.168.1.100
audit_2,2024-01-15T13:15:00Z,admin,user_banned,user_management,user,user123,high,192.168.1.100`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } catch (error: any) {
      logger.error('Error exporting audit logs:', { error: error instanceof Error ? error.message : String(error) });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile esportare i log di audit',
        code: 'EXPORT_AUDIT_LOGS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get system statistics and health
   * GET /admin/system/stats
   */
  static async getSystemStats(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement system statistics queries
      const mockStats = {
        uptime: {
          start: '2024-01-01T00:00:00Z',
          uptime: '15d 14h 30m',
          lastRestart: '2024-01-01T00:00:00Z'
        },
        users: {
          total: 1250,
          active: 890,
          online: 45,
          adminUsers: 12
        },
        characters: {
          total: 2100,
          approved: 1950,
          pending: 35,
          rejected: 115
        },
        locations: {
          total: 45,
          visible: 42,
          private: 8,
          active: 25
        },
        economy: {
          totalSupply: 975000,
          avgBalance: 780,
          transactionsToday: 156
        },
        performance: {
          avgResponseTime: '120ms',
          errorRate: '0.02%',
          memoryUsage: '65%',
          cpuUsage: '25%'
        },
        events: {
          todayTotal: 2450,
          charactersApproved: 8,
          usersRegistered: 12,
          transactionsProcessed: 156
        }
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed system statistics', auditInfo);

      const response: ApiResponse<any> = {
        success: true,
        data: mockStats,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching system stats:', { error: error instanceof Error ? error.message : String(error) });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le statistiche di sistema',
        code: 'FETCH_SYSTEM_STATS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Broadcast system message to all users
   * POST /admin/system/broadcast
   */
  static async broadcastMessage(req: Request, res: Response): Promise<void> {
    try {
      const { message, type, targetUsers, urgent } = req.body;

      if (!message || message.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Il messaggio broadcast è richiesto',
          code: 'BROADCAST_MESSAGE_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!type || !['info', 'warning', 'emergency'].includes(type)) {
        const response: ApiResponse = {
          success: false,
          error: 'Tipo di broadcast non valido',
          code: 'INVALID_BROADCAST_TYPE',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // TODO: Implement broadcast logic
      // - Send message to all connected users via WebSocket
      // - Store message for users who are offline
      // - Create audit log entry
      // - Publish Redis event

      const broadcastId = 'broadcast_' + Date.now();

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('System broadcast sent by admin', {
        ...auditInfo,
        broadcastId,
        message,
        type,
        targetUsers: targetUsers || 'all',
        urgent: !!urgent,
        category: 'system_configuration'
      });

      const response: ApiResponse<{ broadcastId: string; targetCount: number }> = {
        success: true,
        data: {
          broadcastId,
          targetCount: targetUsers ? targetUsers.length : 890
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error broadcasting message:', { error: error instanceof Error ? error.message : String(error) });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile trasmettere il messaggio',
        code: 'BROADCAST_MESSAGE_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  // ============================================================================
  // SYSTEM CONFIGURATION MANAGEMENT (Email Templates & Constants)
  // ============================================================================

  /**
   * Get all system configurations or filter by section
   * GET /admin/system/configurations
   * Query params: ?section=email_templates (optional)
   */
  static async getConfigurations(req: Request, res: Response): Promise<void> {
    try {
      const { section } = req.query;
      const { SystemConfiguration } = await import('../../../../packages/database/models');

      let query: any = {};
      if (section && typeof section === 'string') {
        query.configSection = section;
      }

      const configs = await SystemConfiguration.find(query)
        .sort({ configSection: 1, configKey: 1 })
        .lean();

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed system configurations', {
        ...auditInfo,
        section,
        count: configs.length
      });

      const response: ApiResponse<any> = {
        success: true,
        data: { configs },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching system configurations:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      const response: ApiResponse = {
        success: false,
        error: 'Errore nel recupero delle configurazioni di sistema',
        code: 'FETCH_CONFIGURATIONS_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * Get specific configuration by key
   * GET /admin/system/configurations/:configKey
   */
  static async getConfigurationByKey(req: Request, res: Response): Promise<void> {
    try {
      const { configKey } = req.params;
      const { SystemConfiguration } = await import('../../../../packages/database/models');

      const config = await SystemConfiguration.findOne({ configKey }).lean();

      if (!config) {
        const response: ApiResponse = {
          success: false,
          error: 'Configurazione non trovata',
          code: 'CONFIGURATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed configuration detail', {
        ...auditInfo,
        configKey
      });

      const response: ApiResponse<any> = {
        success: true,
        data: { config },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching configuration:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      const response: ApiResponse = {
        success: false,
        error: 'Errore nel recupero della configurazione',
        code: 'FETCH_CONFIGURATION_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * Update configuration value
   * PATCH /admin/system/configurations/:configKey
   * Body: { value: any, updateReason?: string }
   */
  static async updateConfiguration(req: Request, res: Response): Promise<void> {
    try {
      const { configKey } = req.params;
      const { value, updateReason } = req.body;

      if (value === undefined) {
        const response: ApiResponse = {
          success: false,
          error: 'Il campo value è obbligatorio',
          code: 'VALUE_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Initialize ConfigurationService
      const { ConfigurationService } = await import('../../../../packages/shared/src/services/ConfigurationService');
      const { redis } = await import('../config/redis');
      const configService = new ConfigurationService(redis, logger);

      // Get user ID from request
      const userId = req.user?.userId || 'unknown';

      // Update configuration
      const updatedConfig = await configService.updateConfig(
        configKey,
        value,
        userId,
        updateReason
      );

      if (!updatedConfig) {
        const response: ApiResponse = {
          success: false,
          error: 'Configurazione non trovata',
          code: 'CONFIGURATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin updated system configuration', {
        ...auditInfo,
        configKey,
        updateReason,
        version: updatedConfig.metadata.version,
        category: 'system_configuration'
      });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          message: 'Configurazione aggiornata con successo',
          config: updatedConfig
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error updating configuration:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      const response: ApiResponse = {
        success: false,
        error: 'Errore nell\'aggiornamento della configurazione',
        code: 'UPDATE_CONFIGURATION_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }

  /**
   * Invalidate all cached configurations
   * POST /admin/system/configurations/invalidate-cache
   */
  static async invalidateConfigCache(req: Request, res: Response): Promise<void> {
    try {
      // Initialize ConfigurationService
      const { ConfigurationService } = await import('../../../../packages/shared/src/services/ConfigurationService');
      const { redis } = await import('../config/redis');
      const configService = new ConfigurationService(redis, logger);

      // Invalidate all cache
      await configService.invalidateAllCache();

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin invalidated configuration cache', {
        ...auditInfo,
        category: 'system_configuration'
      });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          message: 'Cache delle configurazioni invalidata con successo'
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error invalidating configuration cache:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      const response: ApiResponse = {
        success: false,
        error: 'Errore nell\'invalidazione della cache',
        code: 'INVALIDATE_CACHE_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }
}