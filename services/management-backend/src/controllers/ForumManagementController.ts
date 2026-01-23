import { Request, Response } from 'express';
import { OnGameMessage } from '../../../database/models/OnGameMessage';
import { OnGameMessageView } from '../../../database/models/OnGameMessageView';
import { Character } from '../../../database/models/Character';
import { Location } from '../../../database/models/Location';
import { logger } from '../utils/logger';
import { auditLogger } from '../utils/auditLogger';
import { listResponse, successResponse, errorResponse, createResponse, updateResponse, deleteResponse, getRequestId } from '../utils/apiResponse';

export class ForumManagementController {
  
  /**
   * Get messages with advanced filtering and pagination
   */
  static async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 25,
        search = '',
        messageType = 'all',
        status = 'all',
        dateFrom,
        dateTo,
        fromCharacter,
        toCharacter,
        location,
        sortBy = 'sentAt',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Build filter query
      const filter: any = {};

      // Search in subject and content
      if (search) {
        filter.$or = [
          { subject: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } }
        ];
      }

      // Filter by message type
      if (messageType !== 'all') {
        filter.messageType = messageType;
      }

      // Filter by status
      if (status === 'pending') {
        filter.scheduledDelivery = { $exists: true, $gte: new Date() };
      } else if (status === 'delivered') {
        filter.deliveredAt = { $exists: true };
      } else if (status === 'failed') {
        // Messages that were scheduled but delivery time passed without delivery
        filter.scheduledDelivery = { $lt: new Date() };
        filter.deliveredAt = { $exists: false };
      }

      // Date range filter
      if (dateFrom || dateTo) {
        filter.sentAt = {};
        if (dateFrom) filter.sentAt.$gte = new Date(dateFrom as string);
        if (dateTo) filter.sentAt.$lte = new Date(dateTo as string);
      }

      // Character filters
      if (fromCharacter) {
        filter.from = fromCharacter;
      }
      if (toCharacter) {
        filter.to = { $in: [toCharacter] };
      }

      // Location filter
      if (location) {
        filter.sentFromLocation = location;
      }

      // Sort configuration
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

      // Execute queries in parallel
      const [messages, total] = await Promise.all([
        OnGameMessage.find(filter)
          .populate('from', 'name surname')
          .populate('to', 'name surname')
          .populate('sentFromLocation', 'name')
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        OnGameMessage.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / limitNum);

      const pagination = {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        limit: limitNum,
        hasMore: pageNum < totalPages
      };

      res.json(listResponse(
        messages.map(msg => ({
          ...msg,
          from: msg.from ? `${(msg.from as any).name} ${(msg.from as any).surname || ''}`.trim() : 'Unknown',
          to: (msg.to as any[]).map((char: any) => `${char.name} ${char.surname || ''}`.trim()),
          sentFromLocation: (msg.sentFromLocation as any)?.name || 'Unknown Location',
          status: this.getMessageStatus(msg)
        })),
        pagination,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching messages:', error);
      res.status(500).json(errorResponse(
        'Failed to fetch messages',
        'GET_MESSAGES_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get message statistics for dashboard
   */
  static async getMessageStats(req: Request, res: Response): Promise<void> {
    try {
      const [
        totalMessages,
        messagesByType,
        messagesByStatus,
        recentActivity,
        topSenders,
        deliveryStats
      ] = await Promise.all([
        // Total messages
        OnGameMessage.countDocuments(),

        // Messages by type
        OnGameMessage.aggregate([
          { $group: { _id: '$messageType', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),

        // Messages by status
        OnGameMessage.aggregate([
          {
            $addFields: {
              status: {
                $cond: [
                  { $ne: ['$deliveredAt', null] },
                  'delivered',
                  {
                    $cond: [
                      { $and: [{ $ne: ['$scheduledDelivery', null] }, { $gte: ['$scheduledDelivery', new Date()] }] },
                      'pending',
                      {
                        $cond: [
                          { $and: [{ $ne: ['$scheduledDelivery', null] }, { $lt: ['$scheduledDelivery', new Date()] }] },
                          'failed',
                          'sent'
                        ]
                      }
                    ]
                  }
                ]
              }
            }
          },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),

        // Recent activity (last 7 days)
        OnGameMessage.aggregate([
          {
            $match: {
              sentAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$sentAt' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]),

        // Top senders (last 30 days)
        OnGameMessage.aggregate([
          {
            $match: {
              sentAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            }
          },
          { $group: { _id: '$from', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'characters',
              localField: '_id',
              foreignField: '_id',
              as: 'character'
            }
          },
          { $unwind: '$character' }
        ]),

        // Delivery performance stats
        OnGameMessage.aggregate([
          {
            $match: {
              deliveredAt: { $exists: true },
              scheduledDelivery: { $exists: true }
            }
          },
          {
            $addFields: {
              deliveryDelay: {
                $divide: [
                  { $subtract: ['$deliveredAt', '$scheduledDelivery'] },
                  1000 * 60 // Convert to minutes
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              avgDeliveryDelay: { $avg: '$deliveryDelay' },
              onTimeDeliveries: {
                $sum: { $cond: [{ $lte: ['$deliveryDelay', 5] }, 1, 0] }
              },
              totalScheduled: { $sum: 1 }
            }
          }
        ])
      ]);

      // Calculate derived statistics
      const stats = {
        total: totalMessages,
        byType: messagesByType.map(item => ({
          name: item._id,
          count: item.count
        })),
        byStatus: messagesByStatus.map(item => ({
          name: item._id,
          count: item.count
        })),
        recentActivity: recentActivity.map(item => ({
          date: item._id,
          count: item.count
        })),
        topSenders: topSenders.map(item => ({
          name: `${item.character.name} ${item.character.surname || ''}`.trim(),
          count: item.count
        })),
        deliveryPerformance: deliveryStats[0] ? {
          averageDelay: Math.round(deliveryStats[0].avgDeliveryDelay || 0),
          onTimeRate: Math.round((deliveryStats[0].onTimeDeliveries / deliveryStats[0].totalScheduled) * 100) || 0
        } : {
          averageDelay: 0,
          onTimeRate: 100
        }
      };

      res.json(successResponse(
        stats,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching message statistics:', error);
      res.status(500).json(errorResponse(
        'Failed to fetch statistics',
        'GET_MESSAGE_STATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get detailed message with views and conversation thread
   */
  static async getMessageDetails(req: Request, res: Response): Promise<void> {
    try {
      const { messageId } = req.params;

      const message = await OnGameMessage.findById(messageId)
        .populate('from', 'name surname')
        .populate('to', 'name surname')
        .populate('sentFromLocation', 'name description')
        .populate('replyTo', 'subject from to')
        .lean();

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

      // Get all views for this message
      const views = await OnGameMessageView.find({ messageId })
        .populate('characterId', 'name surname')
        .lean();

      // Get conversation thread if exists
      let conversationMessages: any[] = [];
      if ((message as any).conversationId) {
        conversationMessages = await OnGameMessage.find({
          conversationId: (message as any).conversationId,
          _id: { $ne: messageId }
        })
          .populate('from', 'name surname')
          .populate('to', 'name surname')
          .sort({ sentAt: 1 })
          .lean();
      }

      res.json(successResponse(
        {
          message: {
            ...message,
            from: (message as any).from ? `${((message as any).from as any).name} ${((message as any).from as any).surname || ''}`.trim() : 'Unknown',
            to: ((message as any).to as any[]).map((char: any) => `${char.name} ${char.surname || ''}`.trim()),
            sentFromLocation: ((message as any).sentFromLocation as any)?.name || 'Unknown Location',
            status: this.getMessageStatus(message)
          },
          views: views.map(view => ({
            ...view,
            characterName: `${(view.characterId as any).name} ${(view.characterId as any).surname || ''}`.trim()
          })),
          conversation: conversationMessages.map(msg => ({
            ...msg,
            from: `${(msg.from as any).name} ${(msg.from as any).surname || ''}`.trim()
          }))
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching message details:', error);
      res.status(500).json(errorResponse(
        'Failed to fetch message details',
        'GET_MESSAGE_DETAILS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete a message (admin override)
   */
  static async deleteMessage(req: Request, res: Response): Promise<void> {
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

      const message = await OnGameMessage.findById(messageId);
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

      // Delete the message and all associated views
      await Promise.all([
        OnGameMessage.findByIdAndDelete(messageId),
        OnGameMessageView.deleteMany({ messageId })
      ]);

      // Audit log
      await auditLogger.logAdminAction({
        userId: (req as any).user?.userId || 'unknown',
        username: (req as any).user?.username || 'Admin',
        action: 'delete_message',
        resource: 'forum_management',
        resourceId: messageId,
        details: {
          messageSubject: message.subject,
          messageType: message.messageType,
          reason
        }
      });

      res.json(deleteResponse(
        'Message deleted successfully',
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
   * Bulk operations on messages
   */
  static async bulkMessageOperations(req: Request, res: Response): Promise<void> {
    try {
      const { operation, messageIds, reason } = req.body;

      if (!operation || !messageIds || !Array.isArray(messageIds)) {
        res.status(400).json(errorResponse(
          'Operation and messageIds are required',
          'BULK_OPERATION_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (operation === 'delete' && !reason) {
        res.status(400).json(errorResponse(
          'Deletion reason is required',
          'DELETION_REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      let result;
      switch (operation) {
        case 'delete':
          result = await Promise.all([
            OnGameMessage.deleteMany({ _id: { $in: messageIds } }),
            OnGameMessageView.deleteMany({ messageId: { $in: messageIds } })
          ]);
          break;

        case 'mark_delivered':
          result = await OnGameMessage.updateMany(
            { _id: { $in: messageIds } },
            { $set: { deliveredAt: new Date() } }
          );
          break;

        case 'retry_delivery':
          result = await OnGameMessage.updateMany(
            { _id: { $in: messageIds } },
            { 
              $set: { 
                scheduledDelivery: new Date(Date.now() + 5 * 60 * 1000) // Retry in 5 minutes
              },
              $unset: { deliveredAt: 1 }
            }
          );
          break;

        default:
          res.status(400).json(errorResponse(
            'Invalid operation',
            'INVALID_BULK_OPERATION',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
      }

      // Audit log
      await auditLogger.logAdminAction({
        userId: (req as any).user?.userId || 'unknown',
        username: (req as any).user?.username || 'Admin',
        action: `bulk_${operation}`,
        resource: 'forum_management',
        details: {
          messageIds,
          count: messageIds.length,
          reason
        }
      });

      res.json(updateResponse(
        {
          message: `Bulk ${operation} completed successfully`,
          affected: (result as any)[0]?.deletedCount || (result as any)?.modifiedCount || messageIds.length
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error in bulk message operations:', error);
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
   * Get delivery queue status (pending messages)
   */
  static async getDeliveryQueue(req: Request, res: Response): Promise<void> {
    try {
      const pendingMessages = await OnGameMessage.find({
        scheduledDelivery: { $exists: true },
        deliveredAt: { $exists: false }
      })
        .populate('from', 'name surname')
        .populate('to', 'name surname')
        .sort({ scheduledDelivery: 1 })
        .limit(100)
        .lean();

      const failedMessages = await OnGameMessage.find({
        scheduledDelivery: { $lt: new Date() },
        deliveredAt: { $exists: false }
      })
        .populate('from', 'name surname')
        .populate('to', 'name surname')
        .sort({ scheduledDelivery: 1 })
        .limit(50)
        .lean();

      res.json(successResponse(
        {
          pending: pendingMessages.map(msg => ({
            ...msg,
            from: `${(msg.from as any).name} ${(msg.from as any).surname || ''}`.trim(),
            to: (msg.to as any[]).map((char: any) => `${char.name} ${char.surname || ''}`.trim()),
            minutesUntilDelivery: Math.max(0, Math.floor((msg.scheduledDelivery!.getTime() - Date.now()) / (1000 * 60)))
          })),
          failed: failedMessages.map(msg => ({
            ...msg,
            from: `${(msg.from as any).name} ${(msg.from as any).surname || ''}`.trim(),
            to: (msg.to as any[]).map((char: any) => `${char.name} ${char.surname || ''}`.trim()),
            minutesOverdue: Math.floor((Date.now() - msg.scheduledDelivery!.getTime()) / (1000 * 60))
          }))
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error fetching delivery queue:', error);
      res.status(500).json(errorResponse(
        'Failed to fetch delivery queue',
        'GET_DELIVERY_QUEUE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Manual delivery trigger for failed messages
   */
  static async triggerManualDelivery(req: Request, res: Response): Promise<void> {
    try {
      const { messageIds } = req.body;

      if (!messageIds || !Array.isArray(messageIds)) {
        res.status(400).json(errorResponse(
          'Message IDs are required',
          'MESSAGE_IDS_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const result = await OnGameMessage.updateMany(
        { _id: { $in: messageIds } },
        { $set: { deliveredAt: new Date() } }
      );

      // Create delivery views for recipients
      const messages = await OnGameMessage.find({ _id: { $in: messageIds } });
      
      for (const message of messages) {
        // Create inbox views for all recipients
        const inboxViews = message.to.map((recipientId: any) => ({
          messageId: message._id,
          characterId: recipientId,
          viewType: 'inbox' as const,
          deliveredAt: new Date()
        }));

        // Create outbox view for sender
        const outboxView = {
          messageId: message._id,
          characterId: message.from,
          viewType: 'outbox' as const,
          deliveryStatus: 'delivered' as const,
          deliveredAt: new Date()
        };

        await OnGameMessageView.insertMany([...inboxViews, outboxView]);
      }

      // Audit log
      await auditLogger.logAdminAction({
        userId: (req as any).user?.userId || 'unknown',
        username: (req as any).user?.username || 'Admin',
        action: 'manual_delivery',
        resource: 'forum_management',
        details: {
          messageIds,
          count: messageIds.length
        }
      });

      res.json(updateResponse(
        {
          message: 'Manual delivery completed',
          delivered: result.modifiedCount
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Error in manual delivery:', error);
      res.status(500).json(errorResponse(
        'Failed to trigger manual delivery',
        'MANUAL_DELIVERY_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get message status helper
   */
  private static getMessageStatus(message: any): string {
    if (message.deliveredAt) return 'delivered';
    if (message.scheduledDelivery && message.scheduledDelivery >= new Date()) return 'pending';
    if (message.scheduledDelivery && message.scheduledDelivery < new Date()) return 'failed';
    return 'sent';
  }
}