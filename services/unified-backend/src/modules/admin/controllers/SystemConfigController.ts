import { Request, Response } from 'express';
import { 
  ApiResponse, 
  SystemConfig,
  AuditLog,
  PaginationInfo
} from '../types/management';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { redis } from '@config/runtime/redis';
import { successResponse, errorResponse, updateResponse, getRequestId } from '../utils/apiResponse';

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

      res.json(successResponse(
        mockConfig,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching system config:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare la configurazione di sistema',
        'FETCH_SYSTEM_CONFIG_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
        res.status(400).json(errorResponse(
          'Il motivo dell\'aggiornamento è richiesto',
          'UPDATE_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
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

      res.json(updateResponse(
        {
          action: 'configuration_updated',
          reason
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error updating system config:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        requestBody: req.body,
        params: req.params
      });
      
      res.status(500).json(errorResponse(
        'Impossibile aggiornare la configurazione di sistema',
        'UPDATE_SYSTEM_CONFIG_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
        res.status(400).json(errorResponse(
          'enabled deve essere un booleano',
          'INVALID_MAINTENANCE_MODE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (enabled && (!message || message.trim().length === 0)) {
        res.status(400).json(errorResponse(
          'Il messaggio di manutenzione è richiesto quando si attiva la modalità manutenzione',
          'MAINTENANCE_MESSAGE_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
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

      res.json(successResponse(
        {
          enabled,
          message: enabled ? message : undefined
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error setting maintenance mode:', { error: error instanceof Error ? error.message : String(error) });
      
      res.status(500).json(errorResponse(
        'Impossibile impostare la modalità manutenzione',
        'SET_MAINTENANCE_MODE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
        page,
        totalPages: 1,
        totalItems: mockAuditLogs.length,
        pageSize: limit,
        hasNextPage: false,
        hasPrevPage: false
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed audit logs', {
        ...auditInfo,
        filters: { category, adminUserId, severity, dateFrom, dateTo },
        page,
        limit
      });

      res.json(successResponse(
        {
          logs: mockAuditLogs,
          pagination: mockPagination
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching audit logs:', { error: error instanceof Error ? error.message : String(error) });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare i log di audit',
        'FETCH_AUDIT_LOGS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
        res.status(400).json(errorResponse(
          'Dati log non validi',
          'INVALID_LOGS_DATA',
          undefined,
          400,
          getRequestId(req)
        ));
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

      res.json(successResponse(
        {
          processed: processedLogs.length
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error processing audit logs:', { error: error instanceof Error ? error.message : String(error) });
      
      res.status(500).json(errorResponse(
        'Impossibile elaborare i log di audit',
        'PROCESS_AUDIT_LOGS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
      
      res.status(500).json(errorResponse(
        'Impossibile esportare i log di audit',
        'EXPORT_AUDIT_LOGS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get system statistics and health
   * GET /admin/system/stats
   */
  static async getSystemStats(req: Request, res: Response): Promise<void> {
    try {
      // Dynamic imports to avoid circular dependencies
      const { User } = await import('@database/models/User');
      const { Character } = await import('@database/models/Character');
      const { Location } = await import('@database/models/Location');
      const { CharacterWallet, Transaction } = await import('@database/models/Economy');

      // Calculate date ranges
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Query real data from database
      const [
        totalUsers,
        activeUsers,
        onlineUsers,
        adminUsers,
        totalCharacters,
        approvedCharacters,
        pendingCharacters,
        rejectedCharacters,
        totalLocations,
        visibleLocations,
        privateLocations,
        wallets,
        transactionsToday,
        charactersApprovedToday,
        usersRegisteredToday
      ] = await Promise.all([
        // Users
        User.countDocuments({}),
        User.countDocuments({ lastActive: { $gte: thirtyDaysAgo } }),
        User.countDocuments({ isOnline: true }),
        User.countDocuments({ userRoles: { $in: ['gestore', 'master', 'moderatore'] } }),

        // Characters
        Character.countDocuments({}),
        Character.countDocuments({ state: 'APPROVED' }),
        Character.countDocuments({ state: 'PENDING_APPROVAL' }),
        Character.countDocuments({ state: 'DELETED' }),

        // Locations
        Location.countDocuments({}),
        Location.countDocuments({ isVisible: true }),
        Location.countDocuments({ isPrivate: true }),

        // Economy
        CharacterWallet.find({}).select('balance').lean(),
        Transaction.countDocuments({ createdAt: { $gte: startOfToday } }),

        // Events today
        Character.countDocuments({
          state: 'APPROVED',
          updatedAt: { $gte: startOfToday }
        }),
        User.countDocuments({ createdAt: { $gte: startOfToday } })
      ]);

      // Calculate economy stats
      const totalSupply = wallets.reduce((sum: number, wallet: any) => sum + (wallet.balance || 0), 0);
      const avgBalance = wallets.length > 0 ? Math.round(totalSupply / wallets.length) : 0;

      // Calculate uptime (from process start)
      const uptimeSeconds = Math.floor(process.uptime());
      const uptimeDays = Math.floor(uptimeSeconds / 86400);
      const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
      const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

      // Get memory usage
      const memUsage = process.memoryUsage();
      const memoryUsagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

      const stats = {
        uptime: {
          start: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
          uptime: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`,
          lastRestart: new Date(Date.now() - uptimeSeconds * 1000).toISOString()
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          online: onlineUsers,
          adminUsers: adminUsers
        },
        characters: {
          total: totalCharacters,
          approved: approvedCharacters,
          pending: pendingCharacters,
          rejected: rejectedCharacters
        },
        locations: {
          total: totalLocations,
          visible: visibleLocations,
          private: privateLocations,
          active: visibleLocations // Active = visible locations
        },
        economy: {
          totalSupply: totalSupply,
          avgBalance: avgBalance,
          transactionsToday: transactionsToday
        },
        performance: {
          avgResponseTime: 'N/A', // Would require APM integration
          errorRate: 'N/A', // Would require error tracking
          memoryUsage: `${memoryUsagePercent}%`,
          cpuUsage: 'N/A' // Would require OS-level monitoring
        },
        events: {
          todayTotal: charactersApprovedToday + usersRegisteredToday + transactionsToday,
          charactersApproved: charactersApprovedToday,
          usersRegistered: usersRegisteredToday,
          transactionsProcessed: transactionsToday
        }
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed system statistics', auditInfo);

      res.json(successResponse(
        stats,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching system stats:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare le statistiche di sistema',
        'FETCH_SYSTEM_STATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Broadcast system message to all users
   * POST /admin/system/broadcast
   */
  static async broadcastMessage(req: Request, res: Response): Promise<void> {
    try {
      const { message, type, targetAudience = 'all', targetRoles = [], urgent = false } = req.body;

      if (!message || message.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Il messaggio broadcast è richiesto',
          'BROADCAST_MESSAGE_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!type || !['info', 'warning', 'emergency'].includes(type)) {
        res.status(400).json(errorResponse(
          'Tipo di broadcast non valido',
          'INVALID_BROADCAST_TYPE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Dynamic imports to avoid circular dependencies
      const { BroadcastMessage } = await import('@database/models/BroadcastMessage');
      const { User } = await import('@database/models/User');

      // Calculate target count based on audience
      let targetCount = 0;

      if (targetAudience === 'all') {
        // Count all users
        targetCount = await User.countDocuments({});
      } else if (targetAudience === 'online') {
        // Count only online users
        targetCount = await User.countDocuments({ isOnline: true });
      } else if (targetAudience === 'role_specific' && targetRoles.length > 0) {
        // Count users with specific character roles
        const { Character } = await import('@database/models/Character');
        const characters = await Character.find({
          state: 'APPROVED',
          gameplayRoles: { $in: targetRoles }
        }).distinct('userId');
        targetCount = characters.length;
      }

      // Get sender information from request
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      const user = (req as any).user;
      const character = (req as any).character;

      // Save broadcast message to database
      const broadcastDoc = await BroadcastMessage.create({
        message: message.trim(),
        type,
        urgent: !!urgent,
        targetAudience,
        targetRoles: targetAudience === 'role_specific' ? targetRoles : [],
        targetCount,
        sentBy: {
          userId: user?._id || user?.id,
          characterId: character?._id || character?.id,
          username: user?.username || 'System',
          characterName: character ? `${character.name}${character.surname ? ' ' + character.surname : ''}` : undefined,
          userRoles: user?.userRoles || []
        },
        sentAt: new Date()
      });

      // TODO: Future enhancements:
      // - Send message to all connected users via WebSocket
      // - Store message for users who are offline
      // - Publish Redis event for real-time notifications

      logger.info('System broadcast sent and saved', {
        ...auditInfo,
        broadcastId: broadcastDoc._id.toString(),
        message,
        type,
        targetAudience,
        targetRoles,
        targetCount,
        urgent: !!urgent,
        category: 'system_configuration'
      });

      res.json(successResponse(
        {
          broadcastId: broadcastDoc._id.toString(),
          targetCount
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error broadcasting message:', { error: error instanceof Error ? error.message : String(error) });

      res.status(500).json(errorResponse(
        'Impossibile trasmettere il messaggio',
        'BROADCAST_MESSAGE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get broadcast message history
   * GET /admin/system/broadcast/history
   */
  static async getBroadcastHistory(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const type = req.query.type as string; // Optional filter by type

      // Dynamic import to avoid circular dependencies
      const { BroadcastMessage } = await import('@database/models/BroadcastMessage');

      // Build query
      const query: any = {};
      if (type && ['info', 'warning', 'emergency'].includes(type)) {
        query.type = type;
      }

      // Fetch messages with pagination
      const [messages, totalCount] = await Promise.all([
        BroadcastMessage.find(query)
          .sort({ sentAt: -1 }) // Most recent first
          .skip(offset)
          .limit(limit)
          .lean(),
        BroadcastMessage.countDocuments(query)
      ]);

      // Transform data to match frontend interface
      const transformedMessages = messages.map((msg: any) => ({
        _id: msg._id.toString(),
        message: msg.message,
        priority: msg.type === 'emergency' ? 'critical' : msg.type, // Map 'emergency' back to 'critical' for frontend
        targetAudience: msg.targetAudience,
        targetRoles: msg.targetRoles,
        sentBy: msg.sentBy.username || 'System',
        sentAt: msg.sentAt,
        recipientCount: msg.targetCount
      }));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Broadcast history retrieved', {
        ...auditInfo,
        pageSize: limit,
        offset,
        type,
        resultCount: messages.length,
        category: 'system_configuration'
      });

      res.json(successResponse(
        {
          messages: transformedMessages,
          pagination: {
            total: totalCount,
            pageSize: limit,
            offset,
            hasNextPage: offset + messages.length < totalCount,
          }
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error retrieving broadcast history:', { error: error instanceof Error ? error.message : String(error) });

      res.status(500).json(errorResponse(
        'Impossibile recuperare la cronologia dei broadcast',
        'BROADCAST_HISTORY_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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
      const { SystemConfiguration } = await import('@database/models');

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

      res.json(successResponse(
        { configs },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching system configurations:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json(errorResponse(
        'Errore nel recupero delle configurazioni di sistema',
        'FETCH_CONFIGURATIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get specific configuration by key
   * GET /admin/system/configurations/:configKey
   */
  static async getConfigurationByKey(req: Request<{ configKey: string }>, res: Response): Promise<void> {
    try {
      const { configKey } = req.params;
      const { SystemConfiguration } = await import('@database/models');

      const config = await SystemConfiguration.findOne({ configKey }).lean();

      if (!config) {
        res.status(404).json(errorResponse(
          'Configurazione non trovata',
          'CONFIGURATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed configuration detail', {
        ...auditInfo,
        configKey
      });

      res.json(successResponse(
        { config },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching configuration:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json(errorResponse(
        'Errore nel recupero della configurazione',
        'FETCH_CONFIGURATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update configuration value
   * PATCH /admin/system/configurations/:configKey
   * Body: { value: any, updateReason?: string }
   */
  static async updateConfiguration(req: Request<{ configKey: string }>, res: Response): Promise<void> {
    try {
      const { configKey } = req.params;
      const { value, updateReason } = req.body;

      if (value === undefined) {
        res.status(400).json(errorResponse(
          'Il campo value è obbligatorio',
          'VALUE_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Initialize ConfigurationService
      const { ConfigurationService } = await import('@shared/services/ConfigurationService');
      const configService = new ConfigurationService(redis.getClient() as any, logger);

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
        res.status(404).json(errorResponse(
          'Configurazione non trovata',
          'CONFIGURATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
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

      res.json(updateResponse(
        {
          message: 'Configurazione aggiornata con successo',
          config: updatedConfig
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error updating configuration:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json(errorResponse(
        'Errore nell\'aggiornamento della configurazione',
        'UPDATE_CONFIGURATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Invalidate all cached configurations
   * POST /admin/system/configurations/invalidate-cache
   */
  static async invalidateConfigCache(req: Request, res: Response): Promise<void> {
    try {
      // Initialize ConfigurationService
      const { ConfigurationService } = await import('@shared/services/ConfigurationService');
      const configService = new ConfigurationService(redis.getClient() as any, logger);

      // Invalidate all cache
      await configService.invalidateAllCache();

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin invalidated configuration cache', {
        ...auditInfo,
        category: 'system_configuration'
      });

      res.json(successResponse(
        {
          message: 'Cache delle configurazioni invalidata con successo'
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error invalidating configuration cache:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json(errorResponse(
        'Errore nell\'invalidazione della cache',
        'INVALIDATE_CACHE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}