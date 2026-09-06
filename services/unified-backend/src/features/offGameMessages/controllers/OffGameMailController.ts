import { Request, Response } from 'express';
import { OffGameMessage } from '../models/OffGameMessage';
import { successResponse, errorResponse } from '@shared/utils/apiResponse';
import { logger } from '@shared/utils/logger';

export class OffGameMailController {
  /**
   * GET /admin/mail/offgame
   * List OffGame mail messages with filters
   */
  static async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 25,
        search = '',
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
        filter.deletedAt = null;
      } else if (status === 'deleted') {
        filter.deletedAt = { $ne: null };
      }

      // Search in content
      if (search) {
        filter.content = { $regex: search, $options: 'i' };
      }

      // Date range
      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = new Date(dateFrom as string);
        if (dateTo) filter.createdAt.$lte = new Date(dateTo as string);
      }

      // Execute queries in parallel
      const [messages, total] = await Promise.all([
        OffGameMessage.find(filter)
          .populate('senderId', 'name surname')
          .populate('offGameThreadId')
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean(),
        OffGameMessage.countDocuments(filter)
      ]);

      // Enrich with sender name
      const enrichedMessages = messages.map((msg: any) => ({
        ...msg,
        _id: msg._id.toString(),
        senderName: msg.senderId
          ? `${msg.senderId.name} ${msg.senderId.surname || ''}`.trim()
          : 'Unknown',
        isDeleted: !!msg.deletedAt
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
      logger.error('Error fetching OffGame messages', { error });
      res.status(500).json(errorResponse('Errore nel recupero dei messaggi OffGame', 'FETCH_ERROR'));
    }
  }

  /**
   * GET /admin/mail/offgame/stats
   * Get dashboard statistics for OffGame mail
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const [
        totalMessages,
        totalActive,
        totalDeleted,
        messagesByDay
      ] = await Promise.all([
        OffGameMessage.countDocuments(),
        OffGameMessage.countDocuments({ deletedAt: null }),
        OffGameMessage.countDocuments({ deletedAt: { $ne: null } }),
        OffGameMessage.aggregate([
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
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
          messagesByDay
        })
      );
    } catch (error) {
      logger.error('Error fetching OffGame stats', { error });
      res.status(500).json(errorResponse('Errore nel recupero delle statistiche', 'STATS_ERROR'));
    }
  }

  /**
   * GET /admin/mail/offgame/:id
   * Get single OffGame message details
   */
  static async getMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const message = await OffGameMessage.findById(id)
        .populate('senderId', 'name surname')
        .populate('offGameThreadId')
        .lean();

      if (!message) {
        res.status(404).json(errorResponse('Messaggio non trovato', 'NOT_FOUND'));
        return;
      }

      const enrichedMessage = {
        ...message,
        _id: message._id.toString(),
        senderName: (message as any).senderId
          ? `${(message as any).senderId.name} ${(message as any).senderId.surname || ''}`.trim()
          : 'Unknown',
        isDeleted: !!(message as any).deletedAt
      };

      res.json(successResponse(enrichedMessage));
    } catch (error) {
      logger.error('Error fetching OffGame message', { error, messageId: req.params.id });
      res.status(500).json(errorResponse('Errore nel recupero del messaggio', 'FETCH_ERROR'));
    }
  }

  /**
   * DELETE /admin/mail/offgame/:id/hard
   * Permanently delete OffGame message (requires reason)
   */
  static async hardDelete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json(errorResponse('Motivazione richiesta per eliminazione permanente', 'REASON_REQUIRED'));
        return;
      }

      const message = await OffGameMessage.findByIdAndDelete(id);

      if (!message) {
        res.status(404).json(errorResponse('Messaggio non trovato', 'NOT_FOUND'));
        return;
      }

      // Update thread if this was last message
      const OffGameThread = (await import('../models/OffGameThread')).OffGameThread;
      const remainingMessages = await OffGameMessage.countDocuments({
        offGameThreadId: message.offGameThreadId
      });

      if (remainingMessages === 0) {
        await OffGameThread.findByIdAndUpdate(message.offGameThreadId, {
          lastMessagePreview: '(Nessun messaggio)',
          lastMessageAt: null
        });
      }

      logger.warn('OffGame message hard deleted', {
        messageId: id,
        reason,
        adminUserId: req.user?.userId,
        content: message.content.substring(0, 100)
      });

      res.json(successResponse(undefined, 'Messaggio eliminato permanentemente'));
    } catch (error) {
      logger.error('Error hard deleting OffGame message', { error, messageId: req.params.id });
      res.status(500).json(errorResponse('Errore durante l\'eliminazione', 'DELETE_ERROR'));
    }
  }

  /**
   * POST /admin/mail/offgame/:id/soft-delete
   * Soft delete OffGame message
   */
  static async softDelete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const message = await OffGameMessage.findByIdAndUpdate(
        id,
        { deletedAt: new Date() },
        { new: true }
      );

      if (!message) {
        res.status(404).json(errorResponse('Messaggio non trovato', 'NOT_FOUND'));
        return;
      }

      logger.info('OffGame message soft deleted', {
        messageId: id,
        adminUserId: req.user?.userId,
        content: message.content.substring(0, 100)
      });

      res.json(successResponse(message, 'Messaggio archiviato'));
    } catch (error) {
      logger.error('Error soft deleting OffGame message', { error, messageId: req.params.id });
      res.status(500).json(errorResponse('Errore durante l\'archiviazione', 'DELETE_ERROR'));
    }
  }

  /**
   * POST /admin/mail/offgame/bulk-delete
   * Bulk delete OffGame messages
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
        const deleteResult = await OffGameMessage.deleteMany({ _id: { $in: messageIds } });
        count = deleteResult.deletedCount;
      } else {
        const updateResult = await OffGameMessage.updateMany(
          { _id: { $in: messageIds } },
          { deletedAt: new Date() }
        );
        count = updateResult.modifiedCount;
      }

      logger.warn('OffGame messages bulk deleted', {
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
      logger.error('Error bulk deleting OffGame messages', { error });
      res.status(500).json(errorResponse('Errore durante l\'eliminazione multipla', 'BULK_DELETE_ERROR'));
    }
  }
}
