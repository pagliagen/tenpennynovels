import { Request, Response } from 'express';
import { OnGameMessage } from '@core/chat/models/OnGameMessage';
import { successResponse, errorResponse } from '@shared/utils/apiResponse';
import { logger } from '@shared/utils/logger';

// Type for populated character reference
interface PopulatedCharacter {
  name: string;
  surname?: string;
}

// Type for OnGameMessage with populated fields
interface PopulatedOnGameMessage {
  _id: any;
  senderId: PopulatedCharacter | null;
  recipientId: PopulatedCharacter | null;
  onGameThreadId: any;
  deletedBy?: {
    sender?: Date;
    recipient?: Date;
  };
  [key: string]: any;
}

export class OnGameMailController {
  /**
   * GET /admin/mail/ongame
   * List OnGame mail messages with filters
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
        dateTo
      } = req.query;

      const pageNum = Number.parseInt(page as string, 10);
      const limitNum = Number.parseInt(limit as string, 10);

      // Build filter query
      const filter: any = {};

      // Soft delete filter
      if (status === 'active') {
        filter.$or = [
          { 'deletedBy.sender': { $exists: false } },
          { 'deletedBy.recipient': { $exists: false } }
        ];
      } else if (status === 'deleted') {
        filter.$and = [
          { 'deletedBy.sender': { $exists: true } },
          { 'deletedBy.recipient': { $exists: true } }
        ];
      }

      // Message type filter
      if (messageType && messageType !== 'all') {
        filter.messageType = messageType;
      }

      // Search in subject or content
      if (search) {
        filter.$or = [
          { subject: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } }
        ];
      }

      // Date range
      if (dateFrom || dateTo) {
        filter.sentAt = {};
        if (dateFrom) filter.sentAt.$gte = new Date(dateFrom as string);
        if (dateTo) filter.sentAt.$lte = new Date(dateTo as string);
      }

      // Execute queries in parallel
      const [messages, total] = await Promise.all([
        OnGameMessage.find(filter)
          .populate('senderId', 'name surname')
          .populate('recipientId', 'name surname')
          .populate('onGameThreadId')
          .sort({ sentAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean(),
        OnGameMessage.countDocuments(filter)
      ]);

      // Enrich with sender/recipient names
      const enrichedMessages = messages.map((msg: any) => ({
        ...msg,
        _id: msg._id.toString(),
        senderName: msg.senderId
          ? `${msg.senderId.name} ${msg.senderId.surname || ''}`.trim()
          : 'Unknown',
        recipientName: msg.recipientId
          ? `${msg.recipientId.name} ${msg.recipientId.surname || ''}`.trim()
          : 'Unknown',
        isDeleted: !!(msg.deletedBy?.sender && msg.deletedBy?.recipient)
      }));

      res.json(
        successResponse({
          messages: enrichedMessages,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
            hasNextPage: pageNum * limitNum < total,
            hasPrevPage: pageNum > 1
          }
        })
      );
    } catch (error) {
      logger.error('Error fetching OnGame messages', { error });
      res.status(500).json(errorResponse('Errore nel recupero dei messaggi OnGame', 'FETCH_ERROR'));
    }
  }

  /**
   * GET /admin/mail/ongame/stats
   * Get dashboard statistics for OnGame mail
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const [
        totalMessages,
        totalActive,
        totalDeleted,
        messagesByType,
        messagesByDay
      ] = await Promise.all([
        OnGameMessage.countDocuments(),
        OnGameMessage.countDocuments({
          $or: [
            { 'deletedBy.sender': { $exists: false } },
            { 'deletedBy.recipient': { $exists: false } }
          ]
        }),
        OnGameMessage.countDocuments({
          $and: [
            { 'deletedBy.sender': { $exists: true } },
            { 'deletedBy.recipient': { $exists: true } }
          ]
        }),
        OnGameMessage.aggregate([
          { $group: { _id: '$messageType', count: { $sum: 1 } } }
        ]),
        OnGameMessage.aggregate([
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$sentAt' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: -1 } },
          { $limit: 30 }
        ])
      ]);

      res.json(
        successResponse({
          totalMessages,
          totalActive,
          totalDeleted,
          messagesByType,
          messagesByDay
        })
      );
    } catch (error) {
      logger.error('Error fetching OnGame stats', { error });
      res.status(500).json(errorResponse('Errore nel recupero delle statistiche', 'STATS_ERROR'));
    }
  }

  /**
   * GET /admin/mail/ongame/:id
   * Get single OnGame message details
   */
  static async getMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const message = await OnGameMessage.findById(id)
        .populate('senderId', 'name surname')
        .populate('recipientId', 'name surname')
        .populate('onGameThreadId')
        .lean<PopulatedOnGameMessage>();

      if (!message) {
        res.status(404).json(errorResponse('Messaggio non trovato', 'NOT_FOUND'));
        return;
      }

      const enrichedMessage = {
        ...message,
        _id: message._id.toString(),
        senderName: message.senderId
          ? `${message.senderId.name} ${message.senderId.surname || ''}`.trim()
          : 'Unknown',
        recipientName: message.recipientId
          ? `${message.recipientId.name} ${message.recipientId.surname || ''}`.trim()
          : 'Unknown',
        isDeleted: !!(message.deletedBy?.sender && message.deletedBy?.recipient)
      };

      res.json(successResponse(enrichedMessage));
    } catch (error) {
      logger.error('Error fetching OnGame message', { error, messageId: req.params.id });
      res.status(500).json(errorResponse('Errore nel recupero del messaggio', 'FETCH_ERROR'));
    }
  }

  /**
   * DELETE /admin/mail/ongame/:id/hard
   * Permanently delete OnGame message (requires reason)
   */
  static async hardDelete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json(errorResponse('Motivazione richiesta per eliminazione permanente', 'REASON_REQUIRED'));
        return;
      }

      const message = await OnGameMessage.findByIdAndDelete(id);

      if (!message) {
        res.status(404).json(errorResponse('Messaggio non trovato', 'NOT_FOUND'));
        return;
      }

      // Update thread if this was last message
      const OnGameThread = (await import('@core/chat/models/OnGameThread')).OnGameThread;
      const remainingMessages = await OnGameMessage.countDocuments({
        onGameThreadId: message.onGameThreadId
      });

      if (remainingMessages === 0) {
        await OnGameThread.findByIdAndUpdate(message.onGameThreadId, {
          lastMessageSubject: '(Nessun messaggio)',
          lastMessagePreview: '',
          lastMessageAt: null
        });
      }

      logger.warn('OnGame message hard deleted', {
        messageId: id,
        reason,
        adminUserId: req.user?.userId,
        subject: message.subject
      });

      res.json(successResponse(undefined, 'Messaggio eliminato permanentemente'));
    } catch (error) {
      logger.error('Error hard deleting OnGame message', { error, messageId: req.params.id });
      res.status(500).json(errorResponse('Errore durante l\'eliminazione', 'DELETE_ERROR'));
    }
  }

  /**
   * POST /admin/mail/ongame/:id/soft-delete
   * Soft delete OnGame message (both sides)
   */
  static async softDelete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const message = await OnGameMessage.findByIdAndUpdate(
        id,
        {
          'deletedBy.sender': new Date(),
          'deletedBy.recipient': new Date()
        },
        { new: true }
      );

      if (!message) {
        res.status(404).json(errorResponse('Messaggio non trovato', 'NOT_FOUND'));
        return;
      }

      logger.info('OnGame message soft deleted', {
        messageId: id,
        adminUserId: req.user?.userId,
        subject: message.subject
      });

      res.json(successResponse(message, 'Messaggio archiviato'));
    } catch (error) {
      logger.error('Error soft deleting OnGame message', { error, messageId: req.params.id });
      res.status(500).json(errorResponse('Errore durante l\'archiviazione', 'DELETE_ERROR'));
    }
  }

  /**
   * POST /admin/mail/ongame/bulk-delete
   * Bulk delete OnGame messages
   */
  static async bulkDelete(req: Request, res: Response): Promise<void> {
    try {
      const { messageIds, deleteType, reason } = req.body;

      if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
        res.status(400).json(errorResponse('IDs messaggi non validi', 'INVALID_IDS'));
        return;
      }

      if (deleteType === 'hard' && !reason) {
        res.status(400).json(
          errorResponse('Motivazione richiesta per eliminazione permanente multipla', 'REASON_REQUIRED')
        );
        return;
      }

      let count: number;
      if (deleteType === 'hard') {
        const deleteResult = await OnGameMessage.deleteMany({ _id: { $in: messageIds } });
        count = deleteResult.deletedCount;
      } else {
        const updateResult = await OnGameMessage.updateMany(
          { _id: { $in: messageIds } },
          {
            'deletedBy.sender': new Date(),
            'deletedBy.recipient': new Date()
          }
        );
        count = updateResult.modifiedCount;
      }

      logger.warn('OnGame messages bulk deleted', {
        count,
        deleteType,
        reason,
        adminUserId: req.user?.userId,
        severity: count > 50 ? 'critical' : 'high'
      });

      res.json(
        successResponse(
          { deletedCount: count },
          `${count} messaggi ${deleteType === 'hard' ? 'eliminati' : 'archiviati'}`
        )
      );
    } catch (error) {
      logger.error('Error bulk deleting OnGame messages', { error });
      res.status(500).json(errorResponse('Errore durante l\'eliminazione multipla', 'BULK_DELETE_ERROR'));
    }
  }
}
