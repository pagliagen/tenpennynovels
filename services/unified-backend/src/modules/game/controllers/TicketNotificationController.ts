import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { TicketNotification } from '@database/models/TicketNotification';

/**
 * TicketNotificationController
 * Gestisce notifiche ticket per character (public API)
 *
 * Endpoints:
 * - GET /game/tickets/notifications - Lista notifiche
 * - PUT /game/tickets/notifications/:id/read - Mark as read
 * - PUT /game/tickets/notifications/read-all - Mark all as read
 * - GET /game/tickets/notifications/unread-count - Unread count
 */

export class TicketNotificationController {
  /**
   * GET /game/tickets/notifications
   * Lista notifiche per character autenticato
   * Query params: ?unreadOnly=true&limit=20&offset=0
   */
  static async listForCharacter(req: Request, res: Response): Promise<void> {
    try {
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json({
          result: false,
          error: 'Character not found',
          code: 'CHARACTER_NOT_FOUND'
        });
        return;
      }

      const { unreadOnly, limit = 20, offset = 0 } = req.query;

      // Get notifications
      const notifications = await (TicketNotification as any).getRecentForRecipient(
        'character',
        characterId,
        {
          unreadOnly: unreadOnly === 'true',
          limit: Number(limit),
          offset: Number(offset)
        }
      );

      // Get counts
      const unreadCount = await (TicketNotification as any).getUnreadCount('character', characterId);
      const totalCount = await (TicketNotification as any).getTotalCount('character', characterId, {
        unreadOnly: unreadOnly === 'true'
      });

      res.status(200).json({
        result: true,
        data: {
          notifications,
          unreadCount,
          totalCount,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + notifications.length < totalCount
        }
      });
    } catch (error: any) {
      console.error('[TicketNotificationController] List error:', error);
      res.status(500).json({
        result: false,
        error: 'Failed to fetch notifications',
        code: 'LIST_NOTIFICATIONS_ERROR'
      });
    }
  }

  /**
   * PUT /game/tickets/notifications/:id/read
   * Mark single notification as read
   */
  static async markRead(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json({
          result: false,
          error: 'Character not found',
          code: 'CHARACTER_NOT_FOUND'
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          result: false,
          error: 'Invalid notification ID',
          code: 'INVALID_NOTIFICATION_ID'
        });
        return;
      }

      const notificationId = new mongoose.Types.ObjectId(id);

      // Find notification (must belong to character)
      const notification = await TicketNotification.findOne({
        _id: notificationId,
        recipientType: 'character',
        recipientId: characterId
      });

      if (!notification) {
        res.status(404).json({
          result: false,
          error: 'Notification not found',
          code: 'NOTIFICATION_NOT_FOUND'
        });
        return;
      }

      // Mark as read
      await (notification as any).markAsRead();

      res.status(200).json({
        result: true,
        data: {
          isRead: true,
          readAt: notification.readAt
        },
        message: 'Notification marked as read'
      });
    } catch (error: any) {
      console.error('[TicketNotificationController] Mark read error:', error);
      res.status(500).json({
        result: false,
        error: 'Failed to mark notification as read',
        code: 'MARK_READ_ERROR'
      });
    }
  }

  /**
   * PUT /game/tickets/notifications/read-all
   * Mark all notifications as read for character
   */
  static async markAllRead(req: Request, res: Response): Promise<void> {
    try {
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json({
          result: false,
          error: 'Character not found',
          code: 'CHARACTER_NOT_FOUND'
        });
        return;
      }

      // Mark all unread notifications as read
      const markedCount = await (TicketNotification as any).markAllAsRead('character', characterId);

      res.status(200).json({
        result: true,
        data: {
          markedCount
        },
        message: `Marked ${markedCount} notifications as read`
      });
    } catch (error: any) {
      console.error('[TicketNotificationController] Mark all read error:', error);
      res.status(500).json({
        result: false,
        error: 'Failed to mark all notifications as read',
        code: 'MARK_ALL_READ_ERROR'
      });
    }
  }

  /**
   * GET /game/tickets/notifications/unread-count
   * Get unread count for character
   */
  static async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json({
          result: false,
          error: 'Character not found',
          code: 'CHARACTER_NOT_FOUND'
        });
        return;
      }

      const unreadCount = await (TicketNotification as any).getUnreadCount('character', characterId);

      res.status(200).json({
        result: true,
        data: {
          unreadCount
        }
      });
    } catch (error: any) {
      console.error('[TicketNotificationController] Get unread count error:', error);
      res.status(500).json({
        result: false,
        error: 'Failed to get unread count',
        code: 'GET_UNREAD_COUNT_ERROR'
      });
    }
  }

  /**
   * DELETE /game/tickets/notifications/:id
   * Delete single notification
   */
  static async deleteNotification(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json({
          result: false,
          error: 'Character not found',
          code: 'CHARACTER_NOT_FOUND'
        });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.status(400).json({
          result: false,
          error: 'Invalid notification ID',
          code: 'INVALID_NOTIFICATION_ID'
        });
        return;
      }

      const notificationId = new mongoose.Types.ObjectId(id);

      // Delete notification (must belong to character)
      const result = await TicketNotification.deleteOne({
        _id: notificationId,
        recipientType: 'character',
        recipientId: characterId
      });

      if (result.deletedCount === 0) {
        res.status(404).json({
          result: false,
          error: 'Notification not found',
          code: 'NOTIFICATION_NOT_FOUND'
        });
        return;
      }

      res.status(200).json({
        result: true,
        data: {
          deleted: true
        },
        message: 'Notification deleted'
      });
    } catch (error: any) {
      console.error('[TicketNotificationController] Delete error:', error);
      res.status(500).json({
        result: false,
        error: 'Failed to delete notification',
        code: 'DELETE_NOTIFICATION_ERROR'
      });
    }
  }
}
