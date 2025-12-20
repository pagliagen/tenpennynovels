import { Request, Response } from 'express';
import { ChatModerationAction } from '../../../../packages/database/models/ChatModerationAction';
import { MessageReport } from '../../../../packages/database/models/MessageReport';
import { OnGameMessage } from '../../../../packages/database/models/OnGameMessage';
import { OffGameChatMessage } from '../../../../packages/database/models/OffGameChatMessage';
import { Character } from '../../../../packages/database/models/Character';
import { logger } from '../utils/logger';

export class ChatModerationController {

  /**
   * Report a message for inappropriate content (Player action)
   * POST /game/chat/report-message
   */
  static async reportMessage(req: Request, res: Response): Promise<void> {
    const reporterCharacterId = req.character!.characterId;
    const reporterName = req.character!.characterName;
    
    try {
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
        res.status(400).json({
          success: false,
          error: 'Tipo di messaggio non valido',
          code: 'INVALID_MESSAGE_TYPE'
        });
        return;
      }

      // Get reporter's user ID
      const reporter = await Character.findById(reporterCharacterId).populate('userId');
      if (!reporter) {
        res.status(404).json({
          success: false,
          error: 'Personaggio segnalante non trovato',
          code: 'REPORTER_NOT_FOUND'
        });
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
            res.status(501).json({
              success: false,
              error: 'Segnalazione messaggi location non ancora implementata',
              code: 'LOCATION_REPORTING_NOT_IMPLEMENTED'
            });
            return;
        }
      } catch (error: any) {
        logger.error('Error fetching original message for report', {
          messageId,
          messageType,
          error: error instanceof Error ? error.message : String(error)
        });
        
        res.status(404).json({
          success: false,
          error: 'Messaggio originale non trovato o inaccessibile',
          code: 'MESSAGE_NOT_FOUND'
        });
        return;
      }

      if (!originalMessage) {
        res.status(404).json({
          success: false,
          error: 'Messaggio non trovato',
          code: 'MESSAGE_NOT_FOUND'
        });
        return;
      }

      // Check if user has already reported this message
      const existingReport = await MessageReport.findOne({
        messageId,
        reportedBy: reporterCharacterId
      });

      if (existingReport) {
        res.status(400).json({
          success: false,
          error: 'Hai già segnalato questo messaggio',
          code: 'ALREADY_REPORTED'
        });
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

      res.json({
        success: true,
        message: 'Messaggio segnalato con successo',
        data: {
          reportId: report._id,
          status: 'pending'
        }
      });

    } catch (error: any) {
      logger.error('Failed to report message', {
        messageId: req.body.messageId,
        reporterCharacterId,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        success: false,
        error: 'Impossibile segnalare il messaggio',
        code: 'REPORT_MESSAGE_ERROR'
      });
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

      res.json({
        success: true,
        data: {
          reports,
          pagination: {
            total: totalCount,
            limit: parseInt(limit as string),
            skip: parseInt(skip as string),
            hasMore: totalCount > parseInt(skip as string) + parseInt(limit as string)
          }
        }
      });

    } catch (error: any) {
      logger.error('Failed to get user reports', {
        characterId,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare le segnalazioni',
        code: 'GET_REPORTS_ERROR'
      });
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

      res.json({
        success: true,
        data: {
          actions: actionsWithTimeRemaining,
          pagination: {
            total: totalCount,
            limit: parseInt(limit as string),
            skip: parseInt(skip as string),
            hasMore: totalCount > parseInt(skip as string) + parseInt(limit as string)
          }
        }
      });

    } catch (error: any) {
      logger.error('Failed to get moderation actions', {
        characterId,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        success: false,
        error: 'Impossibile recuperare le azioni di moderazione',
        code: 'GET_MODERATION_ACTIONS_ERROR'
      });
    }
  }

  /**
   * Appeal a moderation action
   * POST /game/chat/moderation-actions/:actionId/appeal
   */
  static async appealModerationAction(req: Request, res: Response): Promise<void> {
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
        res.status(404).json({
          success: false,
          error: 'Azione di moderazione non trovata o non applicabile a te',
          code: 'ACTION_NOT_FOUND'
        });
        return;
      }

      if (action.wasAppealed) {
        res.status(400).json({
          success: false,
          error: 'Questa azione è già stata appellata',
          code: 'ALREADY_APPEALED'
        });
        return;
      }

      // Check if action is still within appeal window (e.g., 30 days)
      const appealWindowDays = 30;
      const appealDeadline = new Date(action.actionTakenAt.getTime() + (appealWindowDays * 24 * 60 * 60 * 1000));
      
      if (new Date() > appealDeadline) {
        res.status(400).json({
          success: false,
          error: 'La finestra per l\'appello è scaduta',
          code: 'APPEAL_WINDOW_EXPIRED'
        });
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

      res.json({
        success: true,
        message: 'Appello inviato con successo',
        data: {
          actionId,
          appealedAt: action.appealedAt
        }
      });

    } catch (error: any) {
      logger.error('Failed to appeal moderation action', {
        actionId,
        characterId,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        success: false,
        error: 'Impossibile inviare l\'appello',
        code: 'APPEAL_ACTION_ERROR'
      });
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

      res.json({
        success: true,
        data: {
          canChat: !isBanned,
          isBanned,
          hasWarnings,
          banExpiresAt,
          timeUntilUnban: banExpiresAt 
            ? Math.max(0, Math.round((banExpiresAt.getTime() - Date.now()) / (1000 * 60)))
            : null,
          restrictionCount: restrictions.length
        }
      });

    } catch (error: any) {
      logger.error('Failed to check chat permissions', {
        characterId,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        success: false,
        error: 'Impossibile verificare i permessi di chat',
        code: 'CHECK_CHAT_PERMISSIONS_ERROR'
      });
    }
  }

  // Helper Methods

  private static async notifyModerators(notification: any): Promise<void> {
    try {
      const { getRedisClient } = await import('../config/redis');
      const redis = getRedisClient();
      
      await redis.publish('moderator:notification', JSON.stringify({
        ...notification,
        timestamp: new Date().toISOString()
      }));
    } catch (error: any) {
      logger.warn('Failed to notify moderators', { 
        notification: notification.type, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}