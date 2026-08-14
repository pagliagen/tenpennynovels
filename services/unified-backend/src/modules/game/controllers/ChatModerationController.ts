import { Request, Response } from 'express';
import { ChatModerationAction } from '@database/models/ChatModerationAction';
import { MessageReport } from '@database/models/MessageReport';
import { OnGameMessage } from '@core/chat/models/OnGameMessage';
// boundary-allow: ChatModerationController è infrastruttura di moderazione condivisa
// fra location/onGame/offGame, resta fuori dal perimetro della feature offGameMessages.
import { OffGameChatMessage } from '@features/offGameMessages/api';
import { Character } from '@core/character/models/Character';
import { logger } from '../logger';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '@shared/utils/apiResponse';

import { ConfigurationService } from '@shared/services/ConfigurationService';
import { redis } from '@config/runtime/redis';

export class ChatModerationController {

  /**
   * Report a message for inappropriate content (Player action)
   * POST /game/chat/report-message
   */
  static async reportMessage(req: Request, res: Response): Promise<void> {
    const reporterCharacterId = req.character!.characterId;
    const reporterName = req.character!.characterName;

    try {
      // Check if report system is enabled
      const configService = new ConfigurationService(redis.getClient(), logger);
      const reportSystemEnabled = await configService.getConfig('report_system_enabled');

      if (reportSystemEnabled === false) {
        res.status(503).json(errorResponse(
          'Il sistema di segnalazioni è temporaneamente disabilitato',
          'REPORT_SYSTEM_DISABLED',
          undefined,
          503,
          getRequestId(req)
        ));
        return;
      }

      const {
        messageId,
        messageType,
        reportReason,
        reportDescription,
        reportCategory,
        additionalContext,
        relatedMessageIds
      } = req.body;

      // Validate message type
      if (!['location', 'ongame', 'offgame'].includes(messageType)) {
        res.status(400).json(errorResponse(
          'Tipo di messaggio non valido',
          'INVALID_MESSAGE_TYPE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Get reporter's user ID
      const reporter = await Character.findById(reporterCharacterId).populate('userId');
      if (!reporter) {
        res.status(404).json(errorResponse(
          'Personaggio segnalante non trovato',
          'REPORTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Fetch the original message to create snapshot
      let originalMessage: any = null;
      let messageCollection = '';
      
      try {
        switch (messageType) {
          case 'ongame':
            originalMessage = await OnGameMessage.findById(messageId)
              .populate('from', 'name')
              .populate('to', 'name');
            messageCollection = 'ongame_messages';
            break;
          
          case 'offgame':
            originalMessage = await OffGameChatMessage.findById(messageId)
              .populate('senderId', 'name')
              .populate('chatId');
            messageCollection = 'offgame_chat_messages';
            break;
          
          case 'location':
            // Location messages might be stored differently - this is a placeholder
            // In a real implementation, we'd need to fetch from the location chat system
            res.status(501).json(errorResponse(
              'Segnalazione messaggi location non ancora implementata',
              'LOCATION_REPORTING_NOT_IMPLEMENTED',
              undefined,
              501,
              getRequestId(req)
            ));
            return;
        }
      } catch (error: unknown) {
        logger.error('Error fetching original message for report', {
          messageId,
          messageType,
          error: error instanceof Error ? error.message : String(error)
        });
        
        res.status(404).json(errorResponse(
          'Messaggio originale non trovato o inaccessibile',
          'MESSAGE_NOT_FOUND',
          undefined,
          404,
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

      // Check if user has already reported this message
      const existingReport = await MessageReport.findOne({
        messageId,
        reportedBy: reporterCharacterId
      });

      if (existingReport) {
        res.status(400).json(errorResponse(
          'Hai già segnalato questo messaggio',
          'ALREADY_REPORTED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Create message snapshot
      let messageSnapshot: any = {
        content: originalMessage.content,
        timestamp: originalMessage.sentAt || originalMessage.createdAt
      };

      switch (messageType) {
        case 'ongame':
          messageSnapshot = {
            ...messageSnapshot,
            senderId: originalMessage.from,
            senderName: originalMessage.from?.name || 'Unknown',
            recipients: originalMessage.to
          };
          break;
        
        case 'offgame':
          messageSnapshot = {
            ...messageSnapshot,
            senderId: originalMessage.senderId,
            senderName: originalMessage.senderId?.name || 'Unknown',
            chatId: originalMessage.chatId
          };
          break;
      }

      // Determine priority based on report reason
      let priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';
      if (['threat', 'harassment', 'explicit_content'].includes(reportReason)) {
        priority = 'high';
      } else if (reportReason === 'spam') {
        priority = 'low';
      }

      // Create the report
      const report = new MessageReport({
        messageId,
        messageType,
        messageCollection,
        messageSnapshot,
        reportedBy: reporterCharacterId,
        reporterName,
        reporterUserId: reporter.userId,
        reportReason,
        reportDescription,
        reportCategory,
        additionalContext,
        relatedMessageIds: relatedMessageIds || [],
        priority
      });

      await report.save();

      // Notify moderators via Redis
      await this.notifyModerators({
        type: 'message_reported',
        reportId: report._id,
        messageId,
        messageType,
        reportReason,
        priority,
        reporterName
      });

      logger.info('Message reported for moderation', {
        reportId: report._id,
        messageId,
        messageType,
        reportReason,
        reporterCharacterId,
        priority
      });

      res.json(createResponse(
        {
          reportId: report._id,
          status: 'pending'
        },
        'Messaggio segnalato con successo',
        getRequestId(req)
      ));

    } catch (error: unknown) {
      logger.error('Failed to report message', {
        messageId: req.body.messageId,
        reporterCharacterId,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json(errorResponse(
        'Impossibile segnalare il messaggio',
        'REPORT_MESSAGE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get reports submitted by the current player
   * GET /game/chat/my-reports
   */
  static async getMyReports(req: Request, res: Response): Promise<void> {
    const characterId = req.character!.characterId;
    const { status, limit = 20, skip = 0 } = req.query;

    try {
      let filter: any = { reportedBy: characterId };
      
      if (status) {
        filter.status = status;
      }

      const reports = await MessageReport.find(filter)
        .select('messageType reportReason reportDescription status priority reportedAt reviewedAt resolution resolutionNotes')
        .sort({ reportedAt: -1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(skip as string));

      const totalCount = await MessageReport.countDocuments(filter);

      res.json(listResponse(
        reports,
        {
          currentPage: Math.floor(parseInt(skip as string) / parseInt(limit as string)) + 1,
          pageSize: parseInt(limit as string),
        totalItems: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit as string)),
          hasNextPage: totalCount > parseInt(skip as string) + parseInt(limit as string),
          hasPreviousPage: parseInt(skip as string) > 0
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      logger.error('Failed to get user reports', {
        characterId,
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
   * Get moderation actions affecting the current player
   * GET /game/chat/moderation-actions
   */
  static async getMyModerationActions(req: Request, res: Response): Promise<void> {
    const characterId = req.character!.characterId;
    const { active = 'true', limit = 20, skip = 0 } = req.query;

    try {
      let filter: any = { targetCharacterId: characterId };
      
      if (active === 'true') {
        filter.isActive = true;
        filter.$or = [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ];
      }

      const actions = await ChatModerationAction.find(filter)
        .select('action reason severity actionTakenAt duration expiresAt moderatorUsername')
        .sort({ actionTakenAt: -1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(skip as string));

      const totalCount = await ChatModerationAction.countDocuments(filter);

      // Add time remaining for temporary actions
      const actionsWithTimeRemaining = actions.map(action => ({
        ...action.toJSON(),
        timeRemaining: action.expiresAt && action.expiresAt > new Date() 
          ? Math.max(0, Math.round((action.expiresAt.getTime() - Date.now()) / (1000 * 60)))
          : null
      }));

      res.json(listResponse(
        actionsWithTimeRemaining,
        {
          currentPage: Math.floor(parseInt(skip as string) / parseInt(limit as string)) + 1,
          pageSize: parseInt(limit as string),
        totalItems: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit as string)),
          hasNextPage: totalCount > parseInt(skip as string) + parseInt(limit as string),
          hasPreviousPage: parseInt(skip as string) > 0
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      logger.error('Failed to get moderation actions', {
        characterId,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare le azioni di moderazione',
        'GET_MODERATION_ACTIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Appeal a moderation action
   * POST /game/chat/moderation-actions/:actionId/appeal
   */
  static async appealModerationAction(req: Request<{ actionId: string }>, res: Response): Promise<void> {
    const { actionId } = req.params;
    const characterId = req.character!.characterId;
    const { appealReason } = req.body;

    try {
      const action = await ChatModerationAction.findOne({
        _id: actionId,
        targetCharacterId: characterId,
        isActive: true
      });

      if (!action) {
        res.status(404).json(errorResponse(
          'Azione di moderazione non trovata o non applicabile a te',
          'ACTION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      if (action.wasAppealed) {
        res.status(400).json(errorResponse(
          'Questa azione è già stata appellata',
          'ALREADY_APPEALED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Check if action is still within appeal window (e.g., 30 days)
      const appealWindowDays = 30;
      const appealDeadline = new Date(action.actionTakenAt.getTime() + (appealWindowDays * 24 * 60 * 60 * 1000));
      
      if (new Date() > appealDeadline) {
        res.status(400).json(errorResponse(
          'La finestra per l\'appello è scaduta',
          'APPEAL_WINDOW_EXPIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Update action with appeal
      action.wasAppealed = true;
      action.appealedAt = new Date();
      action.appealReason = appealReason;
      await action.save();

      // Notify moderators about appeal
      await this.notifyModerators({
        type: 'moderation_appealed',
        actionId: action._id,
        targetCharacterName: req.character!.characterName,
        originalAction: action.action,
        appealReason
      });

      logger.info('Moderation action appealed', {
        actionId,
        characterId,
        originalAction: action.action,
        appealReason: appealReason?.substring(0, 100)
      });

      res.json(createResponse(
        {
          actionId,
          appealedAt: action.appealedAt
        },
        'Appello inviato con successo',
        getRequestId(req)
      ));

    } catch (error: unknown) {
      logger.error('Failed to appeal moderation action', {
        actionId,
        characterId,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json(errorResponse(
        'Impossibile inviare l\'appello',
        'APPEAL_ACTION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Check if character can perform chat actions (not banned/restricted)
   * GET /game/chat/can-chat
   */
  static async canChat(req: Request, res: Response): Promise<void> {
    const characterId = req.character!.characterId;

    try {
      // Find active restrictions
      const restrictions = await ChatModerationAction.find({
        targetCharacterId: characterId,
        action: { $in: ['ban_sender', 'warn_sender'] },
        isActive: true,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      });

      const isBanned = restrictions.some(r => r.action === 'ban_sender');
      const hasWarnings = restrictions.some(r => r.action === 'warn_sender');

      // Calculate remaining ban time if banned
      let banExpiresAt: Date | null = null;
      if (isBanned) {
        const banAction = restrictions.find(r => r.action === 'ban_sender' && r.expiresAt);
        if (banAction && banAction.expiresAt) {
          banExpiresAt = banAction.expiresAt;
        }
      }

      res.json(successResponse(
        {
          canChat: !isBanned,
          isBanned,
          hasWarnings,
          banExpiresAt,
          timeUntilUnban: banExpiresAt 
            ? Math.max(0, Math.round((banExpiresAt.getTime() - Date.now()) / (1000 * 60)))
            : null,
          restrictionCount: restrictions.length
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      logger.error('Failed to check chat permissions', {
        characterId,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json(errorResponse(
        'Impossibile verificare i permessi di chat',
        'CHECK_CHAT_PERMISSIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  // Helper Methods

  private static async notifyModerators(notification: any): Promise<void> {
    try {
      const { redis } = await import('@config/runtime');
      const redisClient = redis.getClient();
      
      await redis.publish('moderator:notification', JSON.stringify({
        ...notification,
        timestamp: new Date().toISOString()
      }));
    } catch (error: unknown) {
      logger.warn('Failed to notify moderators', { 
        notification: notification.type, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}