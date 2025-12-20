import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ApiResponse } from '../types/management';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { ChatModerationAction, UserReport, IChatModerationAction, IUserReport } from '../models/ChatModeration';

export class ChatMonitoringController {
  
  /**
   * Search messages across all chat types
   * POST /admin/chat/search
   */
  static async searchMessages(req: Request, res: Response): Promise<void> {
    try {
      const {
        query,
        messageType = 'all', // 'all', 'location', 'ongame', 'offgame'
        characterId,
        locationId,
        chatId,
        dateFrom,
        dateTo,
        page = 1,
        limit = 25
      } = req.body;

      if (!query || query.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'La query di ricerca è richiesta',
          code: 'SEARCH_QUERY_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const searchResults: any[] = [];
      let totalCount = 0;
      const skip = (page - 1) * limit;
      
      // Search regex pattern (case-insensitive)
      const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      // Build date filter
      const dateFilter: any = {};
      if (dateFrom || dateTo) {
        if (dateFrom) dateFilter.$gte = new Date(dateFrom);
        if (dateTo) dateFilter.$lte = new Date(dateTo);
      }

      // Search OnGame Messages
      if (messageType === 'all' || messageType === 'ongame') {
        try {
          const ongameQuery: any = {
            $or: [
              { subject: searchRegex },
              { content: searchRegex }
            ]
          };
          
          if (characterId) {
            ongameQuery.$or.push(
              { from: new mongoose.Types.ObjectId(characterId) },
              { to: new mongoose.Types.ObjectId(characterId) }
            );
          }
          
          if (dateFrom || dateTo) {
            ongameQuery.sentAt = dateFilter;
          }

          const ongameMessages = await mongoose.connection.db!.collection('ongame_messages')
            .find(ongameQuery)
            .sort({ sentAt: -1 })
            .limit(limit)
            .skip(skip)
            .toArray();

          const ongameCount = await mongoose.connection.db!.collection('ongame_messages')
            .countDocuments(ongameQuery);

          totalCount += ongameCount;
          
          for (const msg of ongameMessages) {
            searchResults.push({
              messageId: msg._id,
              messageType: 'ongame',
              content: msg.content,
              subject: msg.subject,
              timestamp: msg.sentAt,
              senderCharacterId: msg.from,
              recipients: msg.to || [],
              messageSubtype: msg.messageType,
              collection: 'ongame_messages'
            });
          }
        } catch (error: any) {
          logger.error('Error searching OnGame messages:', error);
        }
      }

      // Search OffGame Messages
      if (messageType === 'all' || messageType === 'offgame') {
        try {
          const offgameQuery: any = {
            content: searchRegex
          };
          
          if (characterId) {
            offgameQuery.senderId = new mongoose.Types.ObjectId(characterId);
          }
          
          if (chatId) {
            offgameQuery.chatId = new mongoose.Types.ObjectId(chatId);
          }
          
          if (dateFrom || dateTo) {
            offgameQuery.sentAt = dateFilter;
          }

          const offgameMessages = await mongoose.connection.db!.collection('offgame_chat_messages')
            .find(offgameQuery)
            .sort({ sentAt: -1 })
            .limit(limit)
            .skip(skip)
            .toArray();

          const offgameCount = await mongoose.connection.db!.collection('offgame_chat_messages')
            .countDocuments(offgameQuery);

          totalCount += offgameCount;
          
          for (const msg of offgameMessages) {
            searchResults.push({
              messageId: msg._id,
              messageType: 'offgame',
              content: msg.content,
              timestamp: msg.sentAt,
              senderCharacterId: msg.senderId,
              chatId: msg.chatId,
              messageSubtype: msg.messageType,
              collection: 'offgame_chat_messages'
            });
          }
        } catch (error: any) {
          logger.error('Error searching OffGame messages:', error);
        }
      }

      // Search Location Messages (placeholder - implementation depends on location chat structure)
      if (messageType === 'all' || messageType === 'location') {
        try {
          // Note: This is a placeholder. Location chat messages might be stored differently
          // or might be real-time only. Adjust according to actual implementation.
          
          const locationQuery: any = {
            content: searchRegex
          };
          
          if (characterId) {
            locationQuery.characterId = new mongoose.Types.ObjectId(characterId);
          }
          
          if (locationId) {
            locationQuery.locationId = new mongoose.Types.ObjectId(locationId);
          }
          
          if (dateFrom || dateTo) {
            locationQuery.timestamp = dateFilter;
          }

          // Check if location_messages collection exists and search
          const collections = await mongoose.connection.db!.listCollections({ name: 'location_messages' }).toArray();
          if (collections.length > 0) {
            const locationMessages = await mongoose.connection.db!.collection('location_messages')
              .find(locationQuery)
              .sort({ timestamp: -1 })
              .limit(limit)
              .skip(skip)
              .toArray();

            const locationCount = await mongoose.connection.db!.collection('location_messages')
              .countDocuments(locationQuery);

            totalCount += locationCount;
            
            for (const msg of locationMessages) {
              searchResults.push({
                messageId: msg._id,
                messageType: 'location',
                content: msg.content,
                timestamp: msg.timestamp,
                senderCharacterId: msg.characterId,
                locationId: msg.locationId,
                messageSubtype: msg.messageType || 'roleplay',
                collection: 'location_messages'
              });
            }
          }
        } catch (error: any) {
          logger.error('Error searching Location messages:', error);
        }
      }

      // Sort results by timestamp (most recent first)
      searchResults.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Chat message search performed', {
        ...auditInfo,
        searchQuery: query,
        messageType,
        resultsCount: searchResults.length,
        totalCount
      });

      const response: ApiResponse<{
        messages: any[];
        pagination: {
          currentPage: number;
          totalPages: number;
          totalItems: number;
          limit: number;
          hasMore: boolean;
        };
        searchQuery: string;
        searchFilters: any;
      }> = {
        success: true,
        data: {
          messages: searchResults,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalItems: totalCount,
            limit,
            hasMore: page < Math.ceil(totalCount / limit)
          },
          searchQuery: query,
          searchFilters: {
            messageType,
            characterId,
            locationId,
            chatId,
            dateFrom,
            dateTo
          }
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error searching messages:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile cercare i messaggi',
        code: 'SEARCH_MESSAGES_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get real-time chat activity overview
   * GET /admin/chat/monitoring/realtime
   */
  static async getRealTimeActivity(req: Request, res: Response): Promise<void> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
      const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

      // Count recent messages by type
      const [
        recentOngame,
        recentOffgame,
        recentLocation,
        totalOngame,
        totalOffgame,
        activeModerationActions,
        pendingReports
      ] = await Promise.all([
        // OnGame messages last hour
        mongoose.connection.db!.collection('ongame_messages')
          .countDocuments({ sentAt: { $gte: oneHourAgo } }),
        
        // OffGame messages last hour
        mongoose.connection.db!.collection('offgame_chat_messages')
          .countDocuments({ sentAt: { $gte: oneHourAgo } }),
        
        // Location messages last hour (if collection exists)
        mongoose.connection.db!.collection('location_messages')
          .countDocuments({ timestamp: { $gte: oneHourAgo } }).catch(() => 0),
        
        // Total OnGame messages last 24h
        mongoose.connection.db!.collection('ongame_messages')
          .countDocuments({ sentAt: { $gte: oneDayAgo } }),
        
        // Total OffGame messages last 24h
        mongoose.connection.db!.collection('offgame_chat_messages')
          .countDocuments({ sentAt: { $gte: oneDayAgo } }),
        
        // Active moderation actions
        ChatModerationAction.countDocuments({ isActive: true }),
        
        // Pending user reports
        UserReport.countDocuments({ status: 'pending' })
      ]);

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Real-time chat activity viewed', {
        ...auditInfo,
        category: 'chat_monitoring'
      });

      const response: ApiResponse<{
        recentActivity: {
          lastHour: {
            ongame: number;
            offgame: number;
            location: number;
            total: number;
          };
          last24Hours: {
            ongame: number;
            offgame: number;
            total: number;
          };
        };
        moderation: {
          activeModerationActions: number;
          pendingReports: number;
        };
        timestamp: string;
      }> = {
        success: true,
        data: {
          recentActivity: {
            lastHour: {
              ongame: recentOngame,
              offgame: recentOffgame,
              location: recentLocation,
              total: recentOngame + recentOffgame + recentLocation
            },
            last24Hours: {
              ongame: totalOngame,
              offgame: totalOffgame,
              total: totalOngame + totalOffgame
            }
          },
          moderation: {
            activeModerationActions,
            pendingReports
          },
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error getting real-time activity:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare l\'attività in tempo reale',
        code: 'REALTIME_ACTIVITY_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get pending user reports
   * GET /admin/chat/reports
   */
  static async getPendingReports(req: Request, res: Response): Promise<void> {
    try {
      const {
        priority = 'all',
        assignedTo = 'all',
        status = 'pending',
        page = 1,
        limit = 25
      } = req.query;

      // Build query
      const query: any = {};
      
      if (status !== 'all') {
        query.status = status;
      }
      
      if (priority !== 'all') {
        query.severity = priority;
      }
      
      if (assignedTo !== 'all') {
        query.assignedTo = new mongoose.Types.ObjectId(assignedTo as string);
      }

      const totalItems = await UserReport.countDocuments(query);
      const reports = await UserReport.find(query)
        .populate('reporterId', 'name surname')
        .populate('reportedCharacterId', 'name surname')
        .populate('assignedTo', 'name surname')
        .sort({ priorityScore: -1, createdAt: -1 })
        .skip((parseInt(page as string) - 1) * parseInt(limit as string))
        .limit(parseInt(limit as string))
        .lean();

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('User reports viewed', {
        ...auditInfo,
        filters: { priority, assignedTo, status },
        page,
        limit,
        totalResults: totalItems
      });

      const response: ApiResponse<{
        reports: any[];
        pagination: {
          currentPage: number;
          totalPages: number;
          totalItems: number;
          limit: number;
          hasMore: boolean;
        };
      }> = {
        success: true,
        data: {
          reports,
          pagination: {
            currentPage: parseInt(page as string),
            totalPages: Math.ceil(totalItems / parseInt(limit as string)),
            totalItems,
            limit: parseInt(limit as string),
            hasMore: parseInt(page as string) < Math.ceil(totalItems / parseInt(limit as string))
          }
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching user reports:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le segnalazioni utente',
        code: 'FETCH_REPORTS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get moderation history for a character
   * GET /admin/chat/moderation/character/:characterId
   */
  static async getCharacterModerationHistory(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const { limit = 50, skip = 0 } = req.query;

      const moderationHistory = await ChatModerationAction.find({
        targetCharacterId: new mongoose.Types.ObjectId(characterId)
      })
        .populate('moderatorId', 'name surname')
        .sort({ actionTakenAt: -1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(skip as string))
        .lean();

      const totalCount = await ChatModerationAction.countDocuments({
        targetCharacterId: new mongoose.Types.ObjectId(characterId)
      });

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Character moderation history viewed', {
        ...auditInfo,
        targetCharacterId: characterId,
        category: 'chat_monitoring'
      });

      const response: ApiResponse<{
        history: any[];
        pagination: {
          total: number;
          limit: number;
          skip: number;
          hasMore: boolean;
        };
      }> = {
        success: true,
        data: {
          history: moderationHistory,
          pagination: {
            total: totalCount,
            limit: parseInt(limit as string),
            skip: parseInt(skip as string),
            hasMore: totalCount > parseInt(skip as string) + parseInt(limit as string)
          }
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching moderation history:', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare lo storico delle moderazioni',
        code: 'MODERATION_HISTORY_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }
}