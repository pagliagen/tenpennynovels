import { Request, Response } from 'express';
import { ChatModerationAction } from '@database/models/ChatModerationAction';
import { MessageReport } from '@database/models/MessageReport';
import { OnGameMessage } from '@database/models/OnGameMessage';
// boundary-allow: ChatModerationController è infrastruttura di moderazione condivisa
// fra location/onGame/offGame, resta fuori dal perimetro della feature offGameMessages.
import { OffGameChatMessage } from '@features/offGameMessages/api';
import { Character } from '@database/models/Character';
import { User } from '@database/models/User';
import { logger } from '../utils/logger';
import { redis } from '@config/runtime/redis';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '@shared/utils/apiResponse';

import { escapeRegex } from '@shared/utils/validation';
import { PaginationInfo } from '../types/management';

export class ChatModerationController {

  /**
   * Get chat moderation overview with statistics
   * GET /admin/chat/overview
   */
  static async getChatModerationOverview(req: Request, res: Response): Promise<void> {
    try {
      const { timeframe = '30d' } = req.query;
      
      // Calculate date range
      let startDate = new Date();
      switch (timeframe) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }
      
      // Get basic statistics
      const [
        totalReports,
        pendingReports,
        resolvedReports,
        totalActions,
        activeActions
      ] = await Promise.all([
        MessageReport.countDocuments({ reportedAt: { $gte: startDate } }),
        MessageReport.countDocuments({ status: 'pending' }),
        MessageReport.countDocuments({ 
          status: 'resolved', 
          reviewedAt: { $gte: startDate } 
        }),
        ChatModerationAction.countDocuments({ actionTakenAt: { $gte: startDate } }),
        ChatModerationAction.countDocuments({ 
          isActive: true,
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } }
          ]
        })
      ]);
      
      // Get report reason breakdown
      const reportReasons = await MessageReport.aggregate([
        { $match: { reportedAt: { $gte: startDate } } },
        { $group: { _id: '$reportReason', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      // Get moderation action breakdown
      const actionTypes = await ChatModerationAction.aggregate([
        { $match: { actionTakenAt: { $gte: startDate } } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      // Get top reported users
      const topReportedUsers = await MessageReport.aggregate([
        { $match: { reportedAt: { $gte: startDate } } },
        { 
          $group: { 
            _id: '$messageSnapshot.senderId', 
            senderName: { $first: '$messageSnapshot.senderName' },
            reportCount: { $sum: 1 },
            reasons: { $addToSet: '$reportReason' }
          } 
        },
        { $sort: { reportCount: -1 } },
        { $limit: 10 }
      ]);
      
      // Get moderator activity
      const moderatorActivity = await ChatModerationAction.aggregate([
        { $match: { actionTakenAt: { $gte: startDate } } },
        { 
          $group: { 
            _id: '$moderatorId',
            moderatorName: { $first: '$moderatorUsername' },
            actionCount: { $sum: 1 },
            actionTypes: { $addToSet: '$action' }
          } 
        },
        { $sort: { actionCount: -1 } },
        { $limit: 10 }
      ]);
      
      // Calculate response times
      const responseTimeStats = await MessageReport.aggregate([
        { 
          $match: { 
            reportedAt: { $gte: startDate },
            responseTime: { $exists: true }
          } 
        },
        {
          $group: {
            _id: null,
            avgResponseTime: { $avg: '$responseTime' },
            minResponseTime: { $min: '$responseTime' },
            maxResponseTime: { $max: '$responseTime' },
            count: { $sum: 1 }
          }
        }
      ]);
      
      const overview = {
        metrics: {
          totalReports,
          pendingReports,
          resolvedReports,
          totalActions,
          activeActions,
          resolutionRate: totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 0,
          avgResponseTime: responseTimeStats[0]?.avgResponseTime || null
        },
        reportReasons,
        actionTypes,
        topReportedUsers,
        moderatorActivity,
        responseTimeStats: responseTimeStats[0] || null
      };
      
      res.json(successResponse(
        { overview },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to get chat moderation overview', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare la panoramica della moderazione chat',
        'GET_OVERVIEW_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get all message reports with filtering
   * GET /admin/chat/reports
   */
  static async getReports(req: Request, res: Response): Promise<void> {
    try {
      const { 
        status, 
        priority, 
        reportReason, 
        messageType,
        reportedBy,
        senderId,
        limit = 50,
        skip = 0,
        sortBy = 'reportedAt',
        sortOrder = 'desc'
      } = req.query;
      
      let filter: any = {};
      
      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (reportReason) filter.reportReason = reportReason;
      if (messageType) filter.messageType = messageType;
      if (reportedBy) filter.reportedBy = reportedBy;
      if (senderId) filter['messageSnapshot.senderId'] = senderId;
      
      const sortOption: any = {};
      sortOption[sortBy as string] = sortOrder === 'asc' ? 1 : -1;
      
      const reports = await MessageReport.find(filter)
        .populate('reportedBy', 'name')
        .populate('messageSnapshot.senderId', 'name')
        .populate('reviewedBy', 'name')
        .populate('moderationActionIds')
        .sort(sortOption)
        .limit(parseInt(limit as string))
        .skip(parseInt(skip as string));
      
      const totalCount = await MessageReport.countDocuments(filter);
      
      const skipNum = parseInt(skip as string);
      const limitNum = parseInt(limit as string);
      const pageNum = Math.floor(skipNum / limitNum) + 1;
      const totalPages = Math.ceil(totalCount / limitNum);

      const pagination: PaginationInfo = {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        pageSize: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1
      };

      res.json(successResponse(
        {
          reports,
          pagination
        },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to get reports', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le segnalazioni',
        'GET_REPORTS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Take moderation action on a message
   * POST /admin/chat/moderation-action
   */
  static async takeModerationAction(req: Request, res: Response): Promise<void> {
    const moderatorId = req.user!.userId;
    const moderatorUsername = req.user!.username;
    
    try {
      const {
        messageId,
        messageType,
        action,
        reason,
        severity,
        duration,
        modifiedContent,
        reportIds
      } = req.body;
      
      // Validate action type
      const validActions = ['hide', 'delete', 'warn_sender', 'ban_sender', 'edit_content', 'flag_inappropriate', 'restore'];
      if (!validActions.includes(action)) {
        res.status(400).json(errorResponse(
          'Azione di moderazione non valida',
          'INVALID_ACTION',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }
      
      // Fetch original message
      let originalMessage: any = null;
      let messageCollection = '';
      
      switch (messageType) {
        case 'ongame':
          originalMessage = await OnGameMessage.findById(messageId)
            .populate('from', 'name userId')
            .populate('to', 'name');
          messageCollection = 'ongame_messages';
          break;
        
        case 'offgame':
          originalMessage = await OffGameChatMessage.findById(messageId)
            .populate('senderId', 'name userId')
            .populate('chatId');
          messageCollection = 'offgame_chat_messages';
          break;
        
        default:
          res.status(400).json(errorResponse(
            'Tipo di messaggio non supportato per la moderazione',
            'UNSUPPORTED_MESSAGE_TYPE',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
      }
      
      if (!originalMessage) {
        res.status(404).json(errorResponse(
          'Messaggio non trovato',
          'MESSAGE_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }
      
      // Get sender information
      const senderId = messageType === 'ongame' ? originalMessage.from : originalMessage.senderId;
      const senderName = senderId?.name || 'Unknown';
      const senderUserId = senderId?.userId;
      
      // Create original message snapshot
      const originalMessageSnapshot = {
        content: originalMessage.content,
        sender: {
          characterId: senderId?._id,
          characterName: senderName,
          userId: senderUserId
        },
        timestamp: originalMessage.sentAt || originalMessage.createdAt,
        ...(messageType === 'ongame' && { recipients: originalMessage.to?.map((r: any) => r._id) }),
        ...(messageType === 'offgame' && { chatId: originalMessage.chatId })
      };
      
      // Create moderation action
      const moderationAction = new ChatModerationAction({
        messageId,
        messageType,
        messageCollection,
        originalMessage: originalMessageSnapshot,
        action,
        reason,
        severity: severity || 'medium',
        modifiedContent,
        moderatorId,
        moderatorUsername,
        moderatorUserRoles: req.user!.userRoles || [],
        moderatorCharacterRoles: req.user!.characterRoles || [],
        targetCharacterId: senderId?._id,
        targetCharacterName: senderName,
        targetUserId: senderUserId,
        duration: duration ? parseInt(duration) : undefined,
        isAutomaticAction: false,
        escalationLevel: 'none'
      });
      
      await moderationAction.save();
      
      // Apply the moderation action
      await this.applyModerationAction(originalMessage, action, modifiedContent);
      
      // Update related reports
      if (reportIds && reportIds.length > 0) {
        await MessageReport.updateMany(
          { _id: { $in: reportIds } },
          { 
            $push: { moderationActionIds: moderationAction._id },
            $set: { 
              status: 'resolved',
              reviewedBy: moderatorId,
              reviewerName: moderatorUsername,
              reviewedAt: new Date(),
              resolution: this.getResolutionFromAction(action),
              resolutionNotes: reason
            }
          }
        );
      }
      
      // Notify relevant parties
      await this.notifyModerationAction({
        action,
        targetCharacterName: senderName,
        moderatorUsername,
        reason: reason.substring(0, 100),
        messageType
      });
      
      logger.info('Moderation action taken', {
        actionId: moderationAction._id,
        messageId,
        messageType,
        action,
        targetCharacter: senderName,
        moderatorId
      });
      
      res.json(updateResponse(
        {
          actionId: moderationAction._id,
          action,
          targetCharacter: senderName
        },
        'Azione di moderazione eseguita con successo',
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to take moderation action', {
        moderatorId,
        messageId: req.body.messageId,
        action: req.body.action,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile eseguire l\'azione di moderazione',
        'MODERATION_ACTION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get all moderation actions with filtering
   * GET /admin/chat/moderation-actions
   */
  static async getModerationActions(req: Request, res: Response): Promise<void> {
    try {
      const { 
        action,
        severity,
        moderatorId,
        targetCharacterId,
        isActive,
        limit = 50,
        skip = 0,
        sortBy = 'actionTakenAt',
        sortOrder = 'desc'
      } = req.query;
      
      let filter: any = {};
      
      if (action) filter.action = action;
      if (severity) filter.severity = severity;
      if (moderatorId) filter.moderatorId = moderatorId;
      if (targetCharacterId) filter.targetCharacterId = targetCharacterId;
      if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
        if (filter.isActive) {
          filter.$or = [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } }
          ];
        }
      }
      
      const sortOption: any = {};
      sortOption[sortBy as string] = sortOrder === 'asc' ? 1 : -1;
      
      const actions = await ChatModerationAction.find(filter)
        .populate('moderatorId', 'name')
        .populate('targetCharacterId', 'name')
        .sort(sortOption)
        .limit(parseInt(limit as string))
        .skip(parseInt(skip as string));
      
      const totalCount = await ChatModerationAction.countDocuments(filter);
      
      const skipNum = parseInt(skip as string);
      const limitNum = parseInt(limit as string);
      const pageNum = Math.floor(skipNum / limitNum) + 1;
      const totalPages = Math.ceil(totalCount / limitNum);

      const pagination: PaginationInfo = {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        pageSize: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1
      };

      res.json(successResponse(
        {
          actions,
          pagination
        },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to get moderation actions', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le azioni di moderazione',
        'GET_ACTIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Search messages across all chat systems
   * GET /admin/chat/search-messages
   */
  static async searchMessages(req: Request, res: Response): Promise<void> {
    try {
      const { 
        query,
        messageType,
        senderId,
        startDate,
        endDate,
        limit = 100
      } = req.query;
      
      if (!query || typeof query !== 'string' || query.length < 3) {
        res.status(400).json(errorResponse(
          'La query di ricerca deve contenere almeno 3 caratteri',
          'INVALID_SEARCH_QUERY',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }
      
      const results: any[] = [];
      const escapedQuery = escapeRegex(query);
      
      // Search OnGame messages
      if (!messageType || messageType === 'ongame') {
        let filter: any = {
          $or: [
            { subject: { $regex: escapedQuery, $options: 'i' } },
            { content: { $regex: escapedQuery, $options: 'i' } }
          ]
        };

        if (senderId) filter.senderId = senderId;
        if (startDate) filter.sentAt = { $gte: new Date(startDate as string) };
        if (endDate) filter.sentAt = { ...filter.sentAt, $lte: new Date(endDate as string) };

        const ongameMessages = await OnGameMessage.find(filter)
          .populate('senderId', 'name')
          .populate('recipientId', 'name')
          .sort({ sentAt: -1 })
          .limit(Math.min(parseInt(limit as string), 50));

        results.push(...ongameMessages.map(msg => ({
          messageType: 'ongame',
          messageId: msg._id,
          content: msg.content,
          subject: msg.subject,
          sender: msg.senderId,
          recipients: [msg.recipientId], // NEW schema: single recipient, return array for consistency
          timestamp: msg.sentAt,
          deliveredAt: msg.deliveredAt
        })));
      }
      
      // Search OffGame messages
      if (!messageType || messageType === 'offgame') {
        let filter: any = {
          content: { $regex: escapedQuery, $options: 'i' },
          deletedAt: { $exists: false }
        };
        
        if (senderId) filter.senderId = senderId;
        if (startDate) filter.sentAt = { $gte: new Date(startDate as string) };
        if (endDate) filter.sentAt = { ...filter.sentAt, $lte: new Date(endDate as string) };
        
        const offgameMessages = await OffGameChatMessage.find(filter)
          .populate('senderId', 'name')
          .populate('chatId', 'name')
          .sort({ sentAt: -1 })
          .limit(Math.min(parseInt(limit as string), 50));
        
        results.push(...offgameMessages.map(msg => ({
          messageType: 'offgame',
          messageId: msg._id,
          content: msg.content,
          sender: msg.senderId,
          chat: msg.chatId,
          timestamp: msg.sentAt,
          editedAt: msg.editedAt,
          wasEdited: !!msg.editedAt
        })));
      }
      
      // Sort all results by timestamp
      results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      res.json(successResponse(
        {
          messages: results.slice(0, parseInt(limit as string)),
          totalFound: results.length,
          searchQuery: query
        },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to search messages', {
        query: req.query.query,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile cercare i messaggi',
        'MESSAGE_SEARCH_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Resolve appeal for moderation action
   * PUT /admin/chat/moderation-actions/:actionId/resolve-appeal
   */
  static async resolveAppeal(req: Request<{ actionId: string }>, res: Response): Promise<void> {
    const { actionId } = req.params;
    const { resolution, resolutionNotes } = req.body;
    const moderatorId = req.user!.userId;
    const moderatorUsername = req.user!.username;
    
    try {
      const action = await ChatModerationAction.findOne({
        _id: actionId,
        wasAppealed: true,
        appealResolvedAt: { $exists: false }
      });
      
      if (!action) {
        res.status(404).json(errorResponse(
          'Ricorso non trovato o già risolto',
          'APPEAL_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }
      
      // Update appeal resolution
      action.appealResolution = resolutionNotes;
      action.appealResolvedAt = new Date();
      action.appealResolvedBy = moderatorId;
      
      // If appeal is upheld, deactivate the action
      if (resolution === 'upheld') {
        action.isActive = false;
      }
      
      await action.save();
      
      logger.info('Appeal resolved', {
        actionId,
        resolution,
        moderatorId,
        originalAction: action.action,
        targetCharacter: action.targetCharacterName
      });
      
      res.json(updateResponse(
        {
          actionId,
          resolution,
          resolvedAt: action.appealResolvedAt
        },
        'Ricorso risolto con successo',
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Failed to resolve appeal', {
        actionId,
        moderatorId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile risolvere il ricorso',
        'RESOLVE_APPEAL_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  // Helper Methods

  private static async applyModerationAction(message: any, action: string, modifiedContent?: string): Promise<void> {
    try {
      switch (action) {
        case 'hide':
          // Mark message as hidden (implementation depends on message schema)
          if (message.isHidden !== undefined) {
            message.isHidden = true;
            await message.save();
          }
          break;
        
        case 'delete':
          // Soft delete the message
          message.deletedAt = new Date();
          await message.save();
          break;
        
        case 'edit_content':
          if (modifiedContent) {
            message.originalContent = message.content;
            message.content = modifiedContent;
            message.editedAt = new Date();
            message.editedByModerator = true;
            await message.save();
          }
          break;
        
        case 'restore':
          // Restore previously deleted/hidden message
          if (message.isHidden !== undefined) message.isHidden = false;
          if (message.deletedAt) message.deletedAt = undefined;
          await message.save();
          break;
      }
    } catch (error: any) {
      logger.error('Failed to apply moderation action to message', {
        messageId: message._id,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private static getResolutionFromAction(action: string): string {
    const resolutionMap: Record<string, string> = {
      'hide': 'content_removed',
      'delete': 'content_removed',
      'warn_sender': 'warning_issued',
      'ban_sender': 'user_banned',
      'edit_content': 'content_edited',
      'flag_inappropriate': 'no_action',
      'restore': 'escalated_further'
    };
    
    return resolutionMap[action] || 'no_action';
  }

  private static async notifyModerationAction(notification: any): Promise<void> {
    try {
      await redis.publish('moderation:action', JSON.stringify({
        ...notification,
        timestamp: new Date().toISOString()
      }));
    } catch (error: any) {
      logger.warn('Failed to notify moderation action', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}
