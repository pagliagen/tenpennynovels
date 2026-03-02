import { Request, Response } from 'express';
import { OffGameChat } from '@database/models/OffGameChat';
import { OffGameChatMessage } from '@database/models/OffGameChatMessage';
import { OffGameChatParticipant } from '@database/models/OffGameChatParticipant';
import { Character } from '@database/models/Character';
import { logger } from '../utils/logger';
import { auditLogger } from '../utils/auditLogger';
import { successResponse, errorResponse, deleteResponse, getRequestId } from '../utils/apiResponse';

export class MessagingSystemController {
  
  /**
   * Get chats with advanced filtering and pagination
   */
  static async getChats(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 25,
        search = '',
        type = 'all',
        isActive = 'true',
        dateFrom,
        dateTo,
        minParticipants = 0,
        maxParticipants = 1000,
        sortBy = 'lastActivity',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Build filter query
      const filter: any = {};

      // Filter by active status
      if (isActive === 'true') {
        filter.isActive = true;
      } else if (isActive === 'false') {
        filter.isActive = false;
      }

      // Filter by type
      if (type !== 'all') {
        filter.type = type;
      }

      // Search in name
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } }
        ];
      }

      // Date range filter
      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom as string);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo as string);
      }

      // Participants count filter
      filter.$expr = {
        $and: [
          { $gte: [{ $size: '$participants' }, parseInt(minParticipants as string)] },
          { $lte: [{ $size: '$participants' }, parseInt(maxParticipants as string)] }
        ]
      };

      // Sort configuration
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

      // Execute queries in parallel
      const [chats, total] = await Promise.all([
        OffGameChat.find(filter)
          .populate('participants', 'name surname')
          .populate('admins', 'name surname')
          .populate('createdBy', 'name surname')
          .populate('lastMessage', 'content sentAt messageType')
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        OffGameChat.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / limitNum);

      // Get message counts for each chat
      const enrichedChats = await Promise.all(
        chats.map(async (chat) => {
          const messageCount = await OffGameChatMessage.countDocuments({ 
            chatId: chat._id,
            deletedAt: { $exists: false }
          });
          
          return {
            ...chat,
            participants: (chat.participants as any[]).map((p: any) => 
              `${p.name} ${p.surname || ''}`.trim()
            ),
            admins: (chat.admins as any[]).map((a: any) => 
              `${a.name} ${a.surname || ''}`.trim()
            ),
            createdBy: chat.createdBy ? 
              `${(chat.createdBy as any).name} ${(chat.createdBy as any).surname || ''}`.trim() : 'Unknown',
            messageCount,
            lastMessage: chat.lastMessage ? {
              content: (chat.lastMessage as any).content?.substring(0, 100) + '...',
              sentAt: (chat.lastMessage as any).sentAt,
              messageType: (chat.lastMessage as any).messageType
            } : null
          };
        })
      );

      res.json(successResponse(
        {
          chats: enrichedChats,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalItems: total,
            limit: limitNum,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching chats:', error);
      res.status(500).json(errorResponse(
        'Failed to fetch chats',
        'FETCH_CHATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get messaging system statistics for dashboard
   */
  static async getMessagingStats(req: Request, res: Response): Promise<void> {
    try {
      const [
        totalChats,
        totalMessages,
        chatsByType,
        chatsByActivity,
        topActiveChats,
        messagingActivity,
        participantStats,
        moderationStats
      ] = await Promise.all([
        // Total chats (active only)
        OffGameChat.countDocuments({ isActive: true }),

        // Total messages (non-deleted)
        OffGameChatMessage.countDocuments({ deletedAt: { $exists: false } }),

        // Chats by type
        OffGameChat.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),

        // Chats by last activity
        OffGameChat.aggregate([
          { $match: { isActive: true } },
          {
            $addFields: {
              activityStatus: {
                $cond: [
                  { $gte: ['$lastActivity', new Date(Date.now() - 24 * 60 * 60 * 1000)] },
                  'active_today',
                  {
                    $cond: [
                      { $gte: ['$lastActivity', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                      'active_week',
                      {
                        $cond: [
                          { $gte: ['$lastActivity', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                          'active_month',
                          'inactive'
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          },
          { $group: { _id: '$activityStatus', count: { $sum: 1 } } }
        ]),

        // Top 10 most active chats (by message count last 30 days)
        OffGameChatMessage.aggregate([
          {
            $match: {
              sentAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
              deletedAt: { $exists: false }
            }
          },
          { $group: { _id: '$chatId', messageCount: { $sum: 1 } } },
          { $sort: { messageCount: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'offgamechats',
              localField: '_id',
              foreignField: '_id',
              as: 'chat'
            }
          },
          { $unwind: '$chat' },
          {
            $project: {
              chatName: { 
                $cond: [
                  { $eq: ['$chat.type', 'group'] },
                  '$chat.name',
                  'Chat Diretto'
                ]
              },
              messageCount: 1,
              participantCount: { $size: '$chat.participants' }
            }
          }
        ]),

        // Messaging activity (last 7 days)
        OffGameChatMessage.aggregate([
          {
            $match: {
              sentAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
              deletedAt: { $exists: false }
            }
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$sentAt' } },
              messageCount: { $sum: 1 },
              uniqueSenders: { $addToSet: '$senderId' }
            }
          },
          {
            $project: {
              date: '$_id',
              messageCount: 1,
              uniqueSenders: { $size: '$uniqueSenders' }
            }
          },
          { $sort: { date: 1 } }
        ]),

        // Participant statistics
        OffGameChat.aggregate([
          { $match: { isActive: true } },
          {
            $group: {
              _id: null,
              avgParticipants: { $avg: { $size: '$participants' } },
              maxParticipants: { $max: { $size: '$participants' } },
              totalParticipants: { $sum: { $size: '$participants' } }
            }
          }
        ]),

        // Moderation stats (deleted messages, muted participants)
        Promise.all([
          OffGameChatMessage.countDocuments({ deletedAt: { $exists: true } }),
          OffGameChatParticipant.countDocuments({ 
            mutedUntil: { $gte: new Date() },
            isActive: true 
          })
        ])
      ]);

      const stats = {
        overview: {
          totalChats,
          totalMessages,
          avgParticipants: participantStats[0]?.avgParticipants || 0,
          deletedMessages: moderationStats[0],
          mutedParticipants: moderationStats[1]
        },
        chatsByType: chatsByType.map(item => ({
          name: item._id,
          count: item.count
        })),
        chatsByActivity: chatsByActivity.map(item => ({
          name: item._id,
          count: item.count
        })),
        topActiveChats: topActiveChats.map(item => ({
          name: item.chatName,
          messageCount: item.messageCount,
          participantCount: item.participantCount
        })),
        messagingActivity: messagingActivity.map(item => ({
          date: item.date,
          messageCount: item.messageCount,
          uniqueSenders: item.uniqueSenders
        }))
      };

      res.json(successResponse(
        stats,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching messaging statistics:', error);
      res.status(500).json(errorResponse(
        'Failed to fetch statistics',
        'FETCH_MESSAGING_STATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get detailed chat information with messages and participants
   */
  static async getChatDetails(req: Request<{ chatId: string }>, res: Response): Promise<void> {
    try {
      const { chatId } = req.params;
      const { messagesPage = 1, messagesLimit = 50 } = req.query;

      const chat = await OffGameChat.findById(chatId)
        .populate('participants', 'name surname')
        .populate('admins', 'name surname')
        .populate('createdBy', 'name surname')
        .lean();

      if (!chat) {
        res.status(404).json(errorResponse(
          'Chat not found',
          'CHAT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Get recent messages with pagination
      const messagesPageNum = parseInt(messagesPage as string);
      const messagesLimitNum = parseInt(messagesLimit as string);
      const skip = (messagesPageNum - 1) * messagesLimitNum;

      const [messages, messageCount, participants] = await Promise.all([
        OffGameChatMessage.find({ 
          chatId,
          deletedAt: { $exists: false }
        })
          .populate('senderId', 'name surname')
          .populate('replyTo', 'content senderId')
          .sort({ sentAt: -1 })
          .skip(skip)
          .limit(messagesLimitNum)
          .lean(),

        OffGameChatMessage.countDocuments({ 
          chatId,
          deletedAt: { $exists: false }
        }),

        OffGameChatParticipant.find({ chatId, isActive: true })
          .populate('characterId', 'name surname')
          .lean()
      ]);

      const enrichedChat = {
        ...chat,
        participants: ((chat as any).participants as any[]).map((p: any) =>
          `${p.name} ${p.surname || ''}`.trim()
        ),
        admins: ((chat as any).admins as any[]).map((a: any) =>
          `${a.name} ${a.surname || ''}`.trim()
        ),
        createdBy: (chat as any).createdBy ?
          `${((chat as any).createdBy as any).name} ${((chat as any).createdBy as any).surname || ''}`.trim() : 'Unknown'
      };

      const enrichedMessages = messages.map(msg => ({
        ...msg,
        sender: `${(msg.senderId as any).name} ${(msg.senderId as any).surname || ''}`.trim(),
        isEdited: !!msg.editedAt,
        readByCount: msg.readBy.length
      }));

      const enrichedParticipants = participants.map(p => ({
        ...p,
        characterName: `${(p.characterId as any).name} ${(p.characterId as any).surname || ''}`.trim(),
        isMuted: p.mutedUntil && p.mutedUntil > new Date(),
        canModerate: p.role === 'admin' || p.role === 'owner'
      }));

      res.json(successResponse(
        {
          chat: enrichedChat,
          messages: {
            data: enrichedMessages,
            pagination: {
              currentPage: messagesPageNum,
              totalPages: Math.ceil(messageCount / messagesLimitNum),
              totalItems: messageCount,
              limit: messagesLimitNum
            }
          },
          participants: enrichedParticipants,
          statistics: {
            totalMessages: messageCount,
            activeParticipants: participants.filter(p => p.isActive).length,
            mutedParticipants: participants.filter(p => p.mutedUntil && p.mutedUntil > new Date()).length
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching chat details:', error);
      res.status(500).json(errorResponse(
        'Failed to fetch chat details',
        'FETCH_CHAT_DETAILS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete a chat (admin override)
   */
  static async deleteChat(req: Request<{ chatId: string }>, res: Response): Promise<void> {
    try {
      const { chatId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json(errorResponse(
          'Deletion reason is required',
          'DELETION_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const chat = await OffGameChat.findById(chatId);
      if (!chat) {
        res.status(404).json(errorResponse(
          'Chat not found',
          'CHAT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Soft delete the chat and all related data
      await Promise.all([
        OffGameChat.findByIdAndUpdate(chatId, { isActive: false }),
        OffGameChatParticipant.updateMany({ chatId }, { isActive: false, leftAt: new Date() }),
        OffGameChatMessage.updateMany({ chatId }, { deletedAt: new Date() })
      ]);

      // Audit log
      auditLogger.logSuccess({
        action: 'delete_chat',
        userId: req.user?.userId || 'system',
        username: req.user?.username || 'System',
        resource: 'messaging_system',
        resourceId: chatId,
        details: {
          chatType: chat.type,
          chatName: chat.name,
          participantCount: chat.participants.length,
          reason
        },
      });

      res.json(deleteResponse(
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error deleting chat:', error);
      res.status(500).json(errorResponse(
        'Failed to delete chat',
        'DELETE_CHAT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete a message (admin override)
   */
  static async deleteMessage(req: Request<{ messageId: string }>, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json(errorResponse(
          'Deletion reason is required',
          'DELETION_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const message = await OffGameChatMessage.findById(messageId);
      if (!message) {
        res.status(404).json(errorResponse(
          'Message not found',
          'MESSAGE_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Soft delete the message
      await OffGameChatMessage.findByIdAndUpdate(messageId, { 
        deletedAt: new Date()
      });

      // Audit log
      auditLogger.logSuccess({
        action: 'delete_message',
        userId: req.user?.userId || 'system',
        username: req.user?.username || 'System',
        resource: 'messaging_system',
        resourceId: messageId,
        details: {
          chatId: message!.chatId,
          senderId: message!.senderId,
          content: message!.content.substring(0, 100),
          reason
        },
      });

      res.json(deleteResponse(
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error deleting message:', error);
      res.status(500).json(errorResponse(
        'Failed to delete message',
        'DELETE_MESSAGE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Mute/unmute participant
   */
  static async moderateParticipant(req: Request<{ chatId: string, characterId: string }>, res: Response): Promise<void> {
    try {
      const { chatId, characterId } = req.params;
      const { action, duration, reason } = req.body;

      if (!['mute', 'unmute', 'remove'].includes(action)) {
        res.status(400).json(errorResponse(
          'Invalid action. Must be mute, unmute, or remove',
          'INVALID_ACTION',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const participant = await OffGameChatParticipant.findOne({ chatId, characterId });
      if (!participant) {
        res.status(404).json(errorResponse(
          'Participant not found',
          'PARTICIPANT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      let updateData: any = {};
      let actionDescription = '';

      switch (action) {
        case 'mute':
          const muteDuration = duration || 24; // Default 24 hours
          updateData.mutedUntil = new Date(Date.now() + muteDuration * 60 * 60 * 1000);
          actionDescription = `muted for ${muteDuration} hours`;
          break;

        case 'unmute':
          updateData.mutedUntil = undefined;
          actionDescription = 'unmuted';
          break;

        case 'remove':
          updateData.isActive = false;
          updateData.leftAt = new Date();
          actionDescription = 'removed from chat';
          break;
      }

      await OffGameChatParticipant.findOneAndUpdate(
        { chatId, characterId },
        updateData
      );

      // Get character info for logging
      const character = await Character.findById(characterId, 'name surname');
      const characterName = character ? 
        `${character.name} ${character.surname || ''}`.trim() : 'Unknown';

      // Audit log
      auditLogger.logSuccess({
        action: 'moderate_participant',
        userId: req.user?.userId || 'system',
        username: req.user?.username || 'System',
        resource: 'messaging_system',
        resourceId: chatId,
        details: {
          characterId,
          characterName,
          moderationAction: action,
          duration: duration || null,
          reason: reason || 'No reason provided'
        },
      });

      res.json(successResponse(
        {
          message: `Participant ${actionDescription} successfully`
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error moderating participant:', error);
      res.status(500).json(errorResponse(
        'Failed to moderate participant',
        'MODERATE_PARTICIPANT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Bulk operations on chats or messages
   */
  static async bulkOperations(req: Request, res: Response): Promise<void> {
    try {
      const { operation, targetType, targetIds, reason, data } = req.body;

      if (!operation || !targetType || !targetIds || !Array.isArray(targetIds)) {
        res.status(400).json(errorResponse(
          'Operation, targetType, and targetIds are required',
          'MISSING_BULK_OPERATION_DATA',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!['chat', 'message'].includes(targetType)) {
        res.status(400).json(errorResponse(
          'targetType must be chat or message',
          'INVALID_TARGET_TYPE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      let result;
      let affectedCount = 0;

      if (targetType === 'chat') {
        switch (operation) {
          case 'delete':
            if (!reason) {
              res.status(400).json(errorResponse(
                'Deletion reason is required',
                'DELETION_REASON_REQUIRED',
                undefined,
                400,
                getRequestId(req)
              ));
              return;
            }
            result = await Promise.all([
              OffGameChat.updateMany({ _id: { $in: targetIds } }, { isActive: false }),
              OffGameChatParticipant.updateMany(
                { chatId: { $in: targetIds } }, 
                { isActive: false, leftAt: new Date() }
              ),
              OffGameChatMessage.updateMany(
                { chatId: { $in: targetIds } }, 
                { deletedAt: new Date() }
              )
            ]);
            affectedCount = result[0].modifiedCount;
            break;

          case 'update_retention':
            if (!data?.messageRetentionDays) {
              res.status(400).json(errorResponse(
                'messageRetentionDays is required for retention update',
                'MESSAGE_RETENTION_DAYS_REQUIRED',
                undefined,
                400,
                getRequestId(req)
              ));
              return;
            }
            result = await OffGameChat.updateMany(
              { _id: { $in: targetIds } },
              { messageRetentionDays: data.messageRetentionDays }
            );
            affectedCount = result.modifiedCount;
            break;

          default:
            res.status(400).json(errorResponse(
              'Invalid operation for chats',
              'INVALID_CHAT_OPERATION',
              undefined,
              400,
              getRequestId(req)
            ));
            return;
        }
      } else { // message operations
        switch (operation) {
          case 'delete':
            if (!reason) {
              res.status(400).json(errorResponse(
                'Deletion reason is required',
                'DELETION_REASON_REQUIRED',
                undefined,
                400,
                getRequestId(req)
              ));
              return;
            }
            result = await OffGameChatMessage.updateMany(
              { _id: { $in: targetIds } },
              { deletedAt: new Date() }
            );
            affectedCount = result.modifiedCount;
            break;

          case 'restore':
            result = await OffGameChatMessage.updateMany(
              { _id: { $in: targetIds } },
              { $unset: { deletedAt: 1 } }
            );
            affectedCount = result.modifiedCount;
            break;

          default:
            res.status(400).json(errorResponse(
              'Invalid operation for messages',
              'INVALID_MESSAGE_OPERATION',
              undefined,
              400,
              getRequestId(req)
            ));
            return;
        }
      }

      // Audit log
      auditLogger.logSuccess({
        action: `bulk_${operation}`,
        userId: req.user?.userId || 'system',
        username: req.user?.username || 'System',
        resource: 'messaging_system',
        resourceId: 'bulk_operation',
        details: {
          targetType,
          targetIds,
          count: targetIds.length,
          affectedCount,
          reason: reason || null,
          data: data || null
        },
      });

      res.json(successResponse(
        {
          message: `Bulk ${operation} completed successfully`,
          affected: affectedCount
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error in bulk operations:', error);
      res.status(500).json(errorResponse(
        'Failed to perform bulk operation',
        'BULK_OPERATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get system cleanup recommendations
   */
  static async getCleanupRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const [
        inactiveChats,
        oldDeletedMessages,
        inactiveParticipants,
        emptyChats
      ] = await Promise.all([
        // Chats inactive for more than 90 days
        OffGameChat.find({
          isActive: true,
          lastActivity: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        }).countDocuments(),

        // Deleted messages older than retention period
        OffGameChatMessage.find({
          deletedAt: { 
            $exists: true,
            $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }).countDocuments(),

        // Inactive participants still in active chats
        OffGameChatParticipant.find({
          isActive: false,
          leftAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }).countDocuments(),

        // Chats with no active participants
        OffGameChat.aggregate([
          { $match: { isActive: true } },
          {
            $lookup: {
              from: 'offgamechatparticipants',
              localField: '_id',
              foreignField: 'chatId',
              as: 'activeParticipants',
              pipeline: [{ $match: { isActive: true } }]
            }
          },
          { $match: { 'activeParticipants': { $size: 0 } } },
          { $count: 'emptyChats' }
        ])
      ]);

      const recommendations = {
        inactiveChats: {
          count: inactiveChats,
          description: 'Chats inactive for more than 90 days',
          action: 'Consider archiving or deleting'
        },
        oldDeletedMessages: {
          count: oldDeletedMessages,
          description: 'Deleted messages older than 30 days',
          action: 'Can be permanently removed to save space'
        },
        inactiveParticipants: {
          count: inactiveParticipants,
          description: 'Inactive participants from more than 30 days ago',
          action: 'Clean up participant records'
        },
        emptyChats: {
          count: emptyChats[0]?.emptyChats || 0,
          description: 'Active chats with no active participants',
          action: 'Should be deactivated'
        }
      };

      res.json(successResponse(
        recommendations,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error getting cleanup recommendations:', error);
      res.status(500).json(errorResponse(
        'Failed to get cleanup recommendations',
        'FETCH_CLEANUP_RECOMMENDATIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}