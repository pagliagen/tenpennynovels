import mongoose from 'mongoose';
import { MessageBackup } from '@database/models/MessageBackup';
import { logger } from '@shared/utils/logger';

/**
 * MessageBackupService
 *
 * Service for message backup operations (moderation and recovery).
 *
 * Features:
 * - Create backup snapshot of deleted messages
 * - Tiered retention: 3 months for on-game, 1 month for off-game
 * - List backups for moderation (master-only)
 * - Cleanup expired backups (CRON job)
 */
export class MessageBackupService {
  /**
   * Create backup from deleted message
   *
   * Snapshot includes full message data (immutable).
   * retentionUntil is auto-calculated by MessageBackup pre-save hook:
   * - OnGame: deletedAt + 90 days
   * - OffGame: deletedAt + 30 days
   *
   * @param message - Message document (OnGameMessage or OffGameMessage)
   * @param messageContext - 'ongame' or 'offgame'
   * @param deletedBy - Character ID who deleted the message
   * @returns Created backup
   */
  static async createBackup(
    message: any,
    messageContext: 'ongame' | 'offgame',
    deletedBy: mongoose.Types.ObjectId
  ): Promise<any> {
    try {
      // Determine threadId based on context
      const threadId = messageContext === 'ongame'
        ? message.onGameThreadId
        : message.offGameThreadId;

      // Create backup with full message snapshot
      const backup = await MessageBackup.create({
        messageContext,
        originalMessageId: message._id,
        threadId,
        messageData: message.toObject(), // Full JSON snapshot
        deletedAt: new Date(),
        deletedBy
        // retentionUntil will be auto-calculated by pre-save hook
      });

      logger.info('Message backup created', {
        backupId: backup._id,
        messageContext,
        originalMessageId: message._id.toString(),
        retentionUntil: backup.retentionUntil.toISOString()
      });

      return backup;
    } catch (error) {
      logger.error('Error creating message backup', {
        error,
        messageContext,
        messageId: message._id.toString()
      });
      throw error;
    }
  }

  /**
   * List backups for moderation
   *
   * MASTER-ONLY: Only masters/moderators can access backups
   *
   * @param filters - Optional filters
   * @returns Backup list with pagination
   */
  static async listBackups(filters: {
    threadId?: mongoose.Types.ObjectId;
    messageContext?: 'ongame' | 'offgame';
    deletedBy?: mongoose.Types.ObjectId;
    page?: number;
    limit?: number;
  }): Promise<{ backups: any[]; total: number; page: number; totalPages: number }> {
    try {
      const query: any = {};

      if (filters.threadId) {
        query.threadId = filters.threadId;
      }

      if (filters.messageContext) {
        query.messageContext = filters.messageContext;
      }

      if (filters.deletedBy) {
        query.deletedBy = filters.deletedBy;
      }

      const page = filters.page || 1;
      const limit = filters.limit || 25;

      const total = await MessageBackup.countDocuments(query);
      const backups = await MessageBackup.find(query)
        .sort({ deletedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('deletedBy', 'name surname')
        .lean();

      return {
        backups,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error listing message backups', { error, filters });
      throw error;
    }
  }

  /**
   * Cleanup expired backups
   *
   * Hard delete backups where retentionUntil < now.
   * Called by CRON job (daily at 3:00 AM).
   *
   * @returns Number of backups deleted
   */
  static async cleanupExpired(): Promise<number> {
    try {
      const now = new Date();
      const result = await MessageBackup.deleteMany({
        retentionUntil: { $lt: now }
      });

      const deletedCount = result.deletedCount || 0;

      logger.info('Expired message backups cleaned up', {
        deletedCount,
        timestamp: now.toISOString()
      });

      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up expired message backups', { error });
      throw error;
    }
  }

  /**
   * Get backup by ID
   *
   * MASTER-ONLY: Only masters/moderators can access backups
   *
   * @param backupId - Backup ID
   * @returns Backup document with full message snapshot
   */
  static async getBackup(backupId: mongoose.Types.ObjectId): Promise<any> {
    try {
      const backup = await MessageBackup.findById(backupId)
        .populate('deletedBy', 'name surname')
        .lean();

      if (!backup) {
        throw new Error('Backup not found');
      }

      return backup;
    } catch (error) {
      logger.error('Error getting message backup', { error, backupId: backupId.toString() });
      throw error;
    }
  }
}
