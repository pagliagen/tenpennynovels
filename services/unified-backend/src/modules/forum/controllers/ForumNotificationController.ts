import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ForumNotification } from '../models/ForumNotification';
import { successResponse, errorResponse } from '../utils/apiResponse';

/**
 * ForumNotificationController
 * Handles forum notifications (new posts, follows, reactions, replies)
 */

export class ForumNotificationController {
  /**
   * GET /forum/notifications
   * Get notifications for authenticated character
   * Query: ?unreadOnly=true&limit=20&offset=0
   */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      const { unreadOnly, limit = 20, offset = 0 } = req.query;

      // Build filter
      const filter: any = { characterId };
      if (unreadOnly === 'true') {
        filter.isRead = false;
      }

      // Fetch notifications
      const notifications = await ForumNotification.find(filter)
        .sort({ createdAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit))
        .lean();

      // Get counts
      const unreadCount = await ForumNotification.countDocuments({ characterId, isRead: false });
      const totalCount = await ForumNotification.countDocuments({ characterId });

      res.status(200).json(successResponse({
        notifications,
        unreadCount,
        totalCount,
        limit: Number(limit),
        offset: Number(offset)
      }));
    } catch (error: any) {
      console.error('[ForumNotificationController] List error:', error);
      res.status(500).json(errorResponse('Failed to fetch notifications', 'LIST_NOTIFICATIONS_ERROR'));
    }
  }

  /**
   * GET /forum/notifications/:notificationId
   * Get single notification and mark as read
   */
  static async get(req: Request<{ notificationId: string }>, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        res.status(400).json(errorResponse('Invalid notification ID', 'INVALID_NOTIFICATION_ID'));
        return;
      }

      const objectId = new mongoose.Types.ObjectId(notificationId);

      // Find notification (must belong to character)
      const notification = await ForumNotification.findOne({
        _id: objectId,
        characterId
      });

      if (!notification) {
        res.status(404).json(errorResponse('Notification not found', 'NOTIFICATION_NOT_FOUND'));
        return;
      }

      // Mark as read if not already
      if (!notification.isRead) {
        await ForumNotification.findByIdAndUpdate(objectId, { isRead: true });
        notification.isRead = true;
      }

      res.status(200).json(successResponse({ notification }));
    } catch (error: any) {
      console.error('[ForumNotificationController] Get error:', error);
      res.status(500).json(errorResponse('Failed to fetch notification', 'GET_NOTIFICATION_ERROR'));
    }
  }

  /**
   * PUT /forum/notifications/:notificationId/read
   * Mark notification as read
   */
  static async markRead(req: Request<{ notificationId: string }>, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        res.status(400).json(errorResponse('Invalid notification ID', 'INVALID_NOTIFICATION_ID'));
        return;
      }

      const objectId = new mongoose.Types.ObjectId(notificationId);

      // Update notification (must belong to character)
      const result = await ForumNotification.updateOne(
        { _id: objectId, characterId },
        { $set: { isRead: true } }
      );

      if (result.matchedCount === 0) {
        res.status(404).json(errorResponse('Notification not found', 'NOTIFICATION_NOT_FOUND'));
        return;
      }

      res.status(200).json(successResponse({
        read: true
      }, 'Notification marked as read'));
    } catch (error: any) {
      console.error('[ForumNotificationController] Mark read error:', error);
      res.status(500).json(errorResponse('Failed to mark notification as read', 'MARK_READ_ERROR'));
    }
  }

  /**
   * PUT /forum/notifications/read-all
   * Mark all notifications as read for authenticated character
   */
  static async markAllRead(req: Request, res: Response): Promise<void> {
    try {
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      // Update all unread notifications
      const result = await ForumNotification.updateMany(
        { characterId, isRead: false },
        { $set: { isRead: true } }
      );

      res.status(200).json(successResponse({
        markedCount: result.modifiedCount
      }, `Marked ${result.modifiedCount} notifications as read`));
    } catch (error: any) {
      console.error('[ForumNotificationController] Mark all read error:', error);
      res.status(500).json(errorResponse('Failed to mark all as read', 'MARK_ALL_READ_ERROR'));
    }
  }

  /**
   * DELETE /forum/notifications/:notificationId
   * Delete a notification
   */
  static async delete(req: Request<{ notificationId: string }>, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        res.status(400).json(errorResponse('Invalid notification ID', 'INVALID_NOTIFICATION_ID'));
        return;
      }

      const objectId = new mongoose.Types.ObjectId(notificationId);

      // Delete notification (must belong to character)
      const result = await ForumNotification.deleteOne({
        _id: objectId,
        characterId
      });

      if (result.deletedCount === 0) {
        res.status(404).json(errorResponse('Notification not found', 'NOTIFICATION_NOT_FOUND'));
        return;
      }

      res.status(200).json(successResponse({
        deleted: true
      }, 'Notification deleted'));
    } catch (error: any) {
      console.error('[ForumNotificationController] Delete error:', error);
      res.status(500).json(errorResponse('Failed to delete notification', 'DELETE_NOTIFICATION_ERROR'));
    }
  }
}
