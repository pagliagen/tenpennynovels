import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { successResponse, errorResponse, getRequestId } from '../utils/apiResponse';
import { ForumNotification } from '@database/models/ForumNotification';

export class ForumNotificationController {
  static async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND', undefined, 401, getRequestId(req)));
        return;
      }

      const characterId = new mongoose.Types.ObjectId(character.characterId);
      const page = Math.max(1, parseInt(String(req.query.page ?? 1), 10));
      const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? 20), 10)));
      const skip = (page - 1) * pageSize;

      const [notifications, total] = await Promise.all([
        ForumNotification.find({ characterId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .lean(),
        ForumNotification.countDocuments({ characterId })
      ]);

      const totalPages = Math.ceil(total / pageSize);

      res.status(200).json(successResponse({
        notifications,
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      console.error('[ForumNotificationController] Get notifications error:', error);
      res.status(500).json(errorResponse('Failed to fetch notifications', 'GET_NOTIFICATIONS_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  static async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND', undefined, 401, getRequestId(req)));
        return;
      }

      const characterId = new mongoose.Types.ObjectId(character.characterId);
      const count = await ForumNotification.countDocuments({ characterId, isRead: false });

      res.status(200).json(successResponse({ unreadCount: count }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      console.error('[ForumNotificationController] Get unread count error:', error);
      res.status(500).json(errorResponse('Failed to fetch unread count', 'GET_UNREAD_COUNT_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * POST /forum/notifications/mark-read - Mark all notifications as read
   */
  static async markAllRead(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND', undefined, 401, getRequestId(req)));
        return;
      }

      const characterId = new mongoose.Types.ObjectId(character.characterId);
      const result = await ForumNotification.updateMany(
        { characterId, isRead: false },
        { $set: { isRead: true } }
      );
      res.status(200).json(successResponse({
        markedCount: result.modifiedCount
      }, `Marked ${result.modifiedCount} notifications as read`, getRequestId(req)));
    } catch (error: unknown) {
      console.error('[ForumNotificationController] Mark all read error:', error);
      res.status(500).json(errorResponse('Failed to mark all as read', 'MARK_ALL_READ_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  static async markRead(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND', undefined, 401, getRequestId(req)));
        return;
      }

      const characterId = new mongoose.Types.ObjectId(character.characterId);
      const { notificationIds, all } = req.body as { notificationIds?: string[]; all?: boolean };

      if (all) {
        const result = await ForumNotification.updateMany(
          { characterId, isRead: false },
          { $set: { isRead: true } }
        );
        res.status(200).json(successResponse({
          markedCount: result.modifiedCount
        }, `Marked ${result.modifiedCount} notifications as read`, getRequestId(req)));
      } else if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
        const validIds = notificationIds
          .filter(id => mongoose.Types.ObjectId.isValid(id))
          .map(id => new mongoose.Types.ObjectId(id));

        if (validIds.length === 0) {
          res.status(400).json(errorResponse('No valid notification IDs', 'INVALID_IDS', undefined, 400, getRequestId(req)));
          return;
        }

        const result = await ForumNotification.updateMany(
          { _id: { $in: validIds }, characterId },
          { $set: { isRead: true } }
        );

        res.status(200).json(successResponse({
          markedCount: result.modifiedCount
        }, `Marked ${result.modifiedCount} notifications as read`, getRequestId(req)));
      } else {
        res.status(400).json(errorResponse('notificationIds array or all: true required', 'MISSING_PARAMS', undefined, 400, getRequestId(req)));
      }
    } catch (error: unknown) {
      console.error('[ForumNotificationController] Mark read error:', error);
      res.status(500).json(errorResponse('Failed to mark as read', 'MARK_READ_ERROR', undefined, 500, getRequestId(req)));
    }
  }
}
