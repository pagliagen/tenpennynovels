import { Request, Response } from 'express';
import {
  SystemConfig,
  PaginationInfo
} from '../types/management';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { redis } from '@config/runtime/redis';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '../utils/apiResponse';


export class SystemConfigController {
  /**
   * Get current system configuration
   * GET /admin/system/config
   */
  static async getSystemConfig(req: Request, res: Response): Promise<void> {
    try {
      const { ConfigurationService } = await import('@shared/services/ConfigurationService');
      const configService = new ConfigurationService(redis.getClient(), logger);

      const [gameConfigs, economyConfigs, moderationConfigs, postalConfigs] = await Promise.all([
        configService.getConfigsBySection('character_creation'),
        configService.getConfigsBySection('economy'),
        configService.getConfigsBySection('moderation'),
        configService.getConfigsBySection('postal_system'),
      ]);

      const maintenanceValue = await configService.getConfig('system_maintenance_mode');

      const config: SystemConfig = {
        gameSettings: {
          maxCharactersPerUser: gameConfigs.max_characters_per_user ?? 3,
        },
        economySettings: {
          startingCash: economyConfigs.starting_cash ?? 50,
          startingDeposit: economyConfigs.starting_deposit ?? 200,
          dailySalaryEnabled: economyConfigs.daily_salary_enabled ?? true,
          inflationRate: economyConfigs.inflation_rate ?? 0.02,
          taxationEnabled: economyConfigs.taxation_enabled ?? false,
        },
        moderationSettings: {
          reportSystemEnabled: moderationConfigs.report_system_enabled ?? true,
        },
        messageSettings: {
          maxMessageLength: postalConfigs.max_message_length ?? 2000,
          messageEditTimeLimit: postalConfigs.message_edit_time_limit ?? 300,
          messageHistoryRetention: postalConfigs.message_history_retention ?? 365,
          postalDeliveryEnabled: postalConfigs.postal_delivery_enabled ?? true,
          postalDelaySimulation: postalConfigs.postal_delay_simulation ?? true,
        },
        maintenanceMode: maintenanceValue ?? {
          enabled: false,
          message: '',
          allowedUsers: [],
          estimatedCompletion: undefined,
        },
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed system configuration', auditInfo);

      res.json(successResponse(
        config,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
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

      const { ConfigurationService } = await import('@shared/services/ConfigurationService');
      const configService = new ConfigurationService(redis.getClient(), logger);
      const userId = req.user?.userId || 'unknown';

      const sectionMap: Record<string, Record<string, any>> = {};
      if (updates.gameSettings) sectionMap['character_creation'] = updates.gameSettings;
      if (updates.economySettings) sectionMap['economy'] = updates.economySettings;
      if (updates.moderationSettings) sectionMap['moderation'] = updates.moderationSettings;
      if (updates.messageSettings) sectionMap['postal_system'] = updates.messageSettings;

      const updatePromises: Promise<any>[] = [];
      for (const [_section, fields] of Object.entries(sectionMap)) {
        for (const [key, value] of Object.entries(fields)) {
          const configKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
          updatePromises.push(
            configService.updateConfig(configKey, value, userId, reason).catch((err: Error) => {
              logger.warn(`Config key ${configKey} not found in DB, skipping`, { error: err.message });
              return null;
            })
          );
        }
      }

      if (updates.maintenanceMode) {
        updatePromises.push(
          configService.updateConfig('system_maintenance_mode', updates.maintenanceMode, userId, reason).catch((err: Error) => {
            logger.warn('system_maintenance_mode not found in DB, skipping', { error: err.message });
            return null;
          })
        );
      }

      await Promise.all(updatePromises);

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('System configuration updated by admin', {
        ...auditInfo,
        updates: Object.keys(sectionMap),
        reason,
        category: 'system_configuration'
      });

      const redisClient = redis.getClient();
      if (redisClient) {
        await redisClient.publish('system:config_updated', JSON.stringify({
          updates: Object.keys(sectionMap),
          updatedBy: req.user?.userId,
          reason,
          timestamp: new Date().toISOString()
        }));
      }

      res.json(updateResponse(
        {
          action: 'configuration_updated',
          reason
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
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

      const { ConfigurationService } = await import('@shared/services/ConfigurationService');
      const configService = new ConfigurationService(redis.getClient(), logger);
      const userId = req.user?.userId || 'unknown';

      const maintenanceData = {
        enabled,
        message: enabled ? message.trim() : '',
        allowedUsers: allowedUsers || [],
        estimatedCompletion: estimatedCompletion || undefined,
      };

      await configService.updateConfig(
        'system_maintenance_mode',
        maintenanceData,
        userId,
        enabled ? 'Attivazione manutenzione' : 'Disattivazione manutenzione'
      ).catch(async () => {
        const { SystemConfiguration } = await import('@database/models');
        await SystemConfiguration.create({
          configKey: 'system_maintenance_mode',
          configSection: 'system',
          configType: 'json',
          value: maintenanceData,
          defaultValue: maintenanceData,
          description: 'Configurazione modalità manutenzione del sistema',
          metadata: { version: 1, lastUpdatedBy: userId }
        });
      });

      const redisClient = redis.getClient();
      if (redisClient) {
        await redisClient.publish('system:maintenance_mode', JSON.stringify({
          ...maintenanceData,
          updatedBy: req.user?.userId,
          timestamp: new Date().toISOString()
        }));
      }

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
    } catch (error: unknown) {
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
      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const category = req.query.category as string;
      const adminUserId = req.query.adminUserId as string;
      const severity = req.query.severity as string;
      const success = req.query.success !== undefined
        ? req.query.success === 'true'
        : undefined;
      const action = req.query.action as string;
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      const { AuditLog: AuditLogModel } = await import('@database/models/AuditLog');

      // Build query filters
      const query: any = {};
      if (category) query.category = category;
      if (adminUserId) query['actor.userId'] = adminUserId;
      if (severity) query.severity = severity;
      if (success !== undefined) query.success = success;
      if (action) query.action = action;
      if (dateFrom || dateTo) {
        query.timestamp = {};
        if (dateFrom) query.timestamp.$gte = dateFrom;
        if (dateTo) query.timestamp.$lte = dateTo;
      }

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const [logs, totalCount] = await Promise.all([
        AuditLogModel.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
        AuditLogModel.countDocuments(query)
      ]);

      const result = {
        logs,
        totalPages: Math.ceil(totalCount / limit),
        totalCount
      };

      // Map MongoDB format to frontend format
      const mappedLogs = result.logs.map((log: any) => ({
        id: log._id.toString(),
        timestamp: log.timestamp,
        actor: {
          userId: log.actor.userId.toString(),
          username: log.actor.username,
          characterName: log.actor.characterName,
          userRoles: log.actor.userRoles,
          characterRoles: log.actor.characterRoles
        },
        action: log.action,
        actionDescription: log.actionDescription,
        category: log.category,
        target: log.target,
        success: log.success,
        errorMessage: log.errorMessage,
        details: log.details,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        severity: log.severity,
        duration: log.duration
      }));

      const pagination: PaginationInfo = {
        currentPage: page,
        totalPages: result.totalPages,
        totalItems: result.totalCount,
        pageSize: limit,
        hasNextPage: page < result.totalPages,
        hasPreviousPage: page > 1
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed audit logs', {
        ...auditInfo,
        filters: { category, adminUserId, severity, success, action, dateFrom, dateTo },
        currentPage: page,
        limit,
        resultsCount: mappedLogs.length
      });

      // Use listResponse for consistency with other list endpoints
      // Returns: { result: true, result: true, items: [...], pagination: {...} }
      res.json(listResponse(
        mappedLogs,
        pagination,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching audit logs:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

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

      const { AuditLog: AuditLogModel } = await import('@database/models/AuditLog');

      const auditDocs = processedLogs.map((log: any) => ({
        action: log.action,
        actionDescription: log.details || log.action,
        category: log.section || 'frontend',
        actor: {
          userId: log.userId || 'unknown',
          username: log.username || 'unknown',
          userRoles: log.userRoles || [],
        },
        success: log.success !== false,
        errorMessage: log.error || undefined,
        details: log.details ? { raw: log.details } : undefined,
        ipAddress: log.ipAddress || clientIp,
        userAgent: log.userAgent,
        severity: log.success === false ? 'warning' : 'info',
        timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
      }));

      await AuditLogModel.insertMany(auditDocs, { ordered: false }).catch((err: any) => {
        logger.warn('Partial failure inserting frontend audit logs', { error: err.message });
      });

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

      const redisClient = redis.getClient();
      if (redisClient) {
        await redisClient.publish('system:audit_logs_submitted', JSON.stringify({
          count: processedLogs.length,
          timestamp: new Date().toISOString()
        }));
      }

      res.json(successResponse(
        {
          processed: processedLogs.length
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
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

      const { AuditLog: AuditLogModel } = await import('@database/models/AuditLog');

      const query: any = {};
      if (category) query.category = category;
      if (dateFrom || dateTo) {
        query.timestamp = {};
        if (dateFrom) query.timestamp.$gte = new Date(dateFrom);
        if (dateTo) query.timestamp.$lte = new Date(dateTo);
      }

      const logs = await AuditLogModel.find(query)
        .sort({ timestamp: -1 })
        .limit(10000)
        .lean();

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin exported audit logs', {
        ...auditInfo,
        filters: { category, dateFrom, dateTo },
        format,
        count: logs.length,
        category: 'system_configuration'
      });

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.json"`);
        res.send(JSON.stringify(logs, null, 2));
      } else {
        const csvHeader = 'ID,Timestamp,User,Username,Action,Category,Severity,Success,IP Address,Error';
        const csvRows = logs.map((log: any) => {
          const escape = (val: any) => {
            const str = String(val ?? '');
            return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
          };
          return [
            log._id,
            log.timestamp?.toISOString?.() || log.timestamp,
            log.actor?.userId || '',
            escape(log.actor?.username || ''),
            escape(log.action || ''),
            escape(log.category || ''),
            log.severity || 'info',
            log.success !== false ? 'true' : 'false',
            log.ipAddress || '',
            escape(log.errorMessage || ''),
          ].join(',');
        });

        const csvContent = [csvHeader, ...csvRows].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);
      }
    } catch (error: unknown) {
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
        charactersApprovedToday,
        usersRegisteredToday
      ] = await Promise.all([
        // Users
        User.countDocuments({}),
        User.countDocuments({ lastActive: { $gte: thirtyDaysAgo } }),
        User.countDocuments({ isOnline: true }),
        User.countDocuments({ canAccessAdminPanel: true }),

        // Characters
        Character.countDocuments({}),
        Character.countDocuments({ state: 'APPROVED' }),
        Character.countDocuments({ state: 'PENDING_APPROVAL' }),
        Character.countDocuments({ state: 'DELETED' }),

        // Locations
        Location.countDocuments({}),
        Location.countDocuments({ isVisible: true }),
        Location.countDocuments({ isPrivate: true }),

        // Events today
        Character.countDocuments({
          state: 'APPROVED',
          updatedAt: { $gte: startOfToday }
        }),
        User.countDocuments({ createdAt: { $gte: startOfToday } })
      ]);

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
        performance: {
          avgResponseTime: 'N/A', // Would require APM integration
          errorRate: 'N/A', // Would require error tracking
          memoryUsage: `${memoryUsagePercent}%`,
          cpuUsage: 'N/A' // Would require OS-level monitoring
        },
        events: {
          todayTotal: charactersApprovedToday + usersRegisteredToday,
          charactersApproved: charactersApprovedToday,
          usersRegistered: usersRegisteredToday
        }
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed system statistics', auditInfo);

      res.json(successResponse(
        stats,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
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
      const user = req.user;
      const character = req.character;

      // Save broadcast message to database
      const broadcastDoc = await BroadcastMessage.create({
        message: message.trim(),
        type,
        urgent: !!urgent,
        targetAudience,
        targetRoles: targetAudience === 'role_specific' ? targetRoles : [],
        targetCount,
        sentBy: {
          userId: user?.userId,
          characterId: character?.characterId,
          username: user?.username || 'System',
          characterName: character?.characterName,
          userRoles: user?.userRoles || []
        },
        sentAt: new Date()
      });

      const redisClient = redis.getClient();
      if (redisClient) {
        await redisClient.publish('system:broadcast', JSON.stringify({
          broadcastId: broadcastDoc._id.toString(),
          message: message.trim(),
          type,
          urgent: !!urgent,
          targetAudience,
          targetRoles: targetAudience === 'role_specific' ? targetRoles : [],
          timestamp: new Date().toISOString()
        }));
      }

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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
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
      const configService = new ConfigurationService(redis.getClient(), logger);

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
    } catch (error: unknown) {
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
      const configService = new ConfigurationService(redis.getClient(), logger);

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
    } catch (error: unknown) {
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