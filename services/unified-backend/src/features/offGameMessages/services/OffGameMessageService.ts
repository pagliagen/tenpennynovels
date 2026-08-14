import mongoose from 'mongoose';
import { OffGameMessage } from '../models/OffGameMessage';
import { OffGameThreadService } from './OffGameThreadService';
import { Character } from '@core/character/models/Character';
import { MessageBackupService } from '@modules/game/services/MessageBackupService';
import { logger } from '@shared/utils/logger';
import { redis } from '@config/runtime/redis';

/**
 * OffGameMessageService
 *
 * Metà off-game di modules/game/services/MessageService.ts, estratta in
 * Fase 7.4 (consolidamento core). Logica invariata, solo relocata —
 * MessageBackupService resta in modules/game/services/ (infrastruttura
 * condivisa fra onGame e offGame, una feature può importare da modules/
 * liberamente, nessun vincolo di boundary in quella direzione).
 *
 * Features:
 * - Send off-game messages with real-time delivery
 * - Soft delete with backup creation
 */
export class OffGameMessageService {
  /**
   * Send off-game message (OOC chat)
   *
   * Validation:
   * - Sender must exist (any character status allowed)
   * - Recipient must exist
   *
   * @param params - Message parameters
   * @returns Created message
   */
  static async sendOffGameMessage(params: {
    senderId: mongoose.Types.ObjectId;
    recipientId: mongoose.Types.ObjectId;
    content: string;
    replyTo?: mongoose.Types.ObjectId;
  }): Promise<any> {
    try {
      // Validate sender exists
      const sender = await Character.findById(params.senderId);
      if (!sender) {
        throw new Error('Sender not found');
      }

      // Validate recipient exists
      const recipient = await Character.findById(params.recipientId);
      if (!recipient) {
        throw new Error('Recipient not found');
      }

      // Find or create thread
      const thread = await OffGameThreadService.findOrCreateThread(
        params.senderId,
        params.recipientId
      );

      // Create message
      const message = await OffGameMessage.create({
        offGameThreadId: thread._id,
        senderId: params.senderId,
        content: params.content,
        editHistory: [],
        readBy: [],
        replyTo: params.replyTo
      });

      // Update thread metadata
      await OffGameThreadService.updateThreadMetadata(thread._id, params.content);

      // Increment unread count for recipient
      await OffGameThreadService.incrementUnreadCount(thread._id, params.recipientId);

      logger.info('OffGame message sent', {
        messageId: message._id,
        senderId: params.senderId.toString(),
        recipientId: params.recipientId.toString()
      });

      // Publish moderation event (non-blocking)
      this.publishModerationEvent({
        messageId: message._id.toString(),
        threadId: thread._id.toString(),
        senderId: params.senderId.toString(),
        content: params.content,
        timestamp: Date.now()
      }).catch(err =>
        logger.error('Failed to publish OffGame moderation event', { error: err, messageId: message._id })
      );

      return message;
    } catch (error) {
      logger.error('Error sending OffGame message', { error, params });
      throw error;
    }
  }

  /**
   * Delete off-game message (soft delete with backup)
   *
   * Simple soft delete (deletedAt timestamp), only the sender can delete.
   *
   * @param messageId - Message ID
   * @param characterId - Character deleting the message
   */
  static async deleteMessage(
    messageId: mongoose.Types.ObjectId,
    characterId: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      const message = await OffGameMessage.findById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      // Check if character is sender
      if (!message.senderId.equals(characterId)) {
        throw new Error('Only sender can delete off-game messages');
      }

      message.markDeleted();
      await message.save();

      // Create backup
      await MessageBackupService.createBackup(message, 'offgame', characterId);

      logger.info('OffGame message marked deleted', {
        messageId: messageId.toString(),
        characterId: characterId.toString()
      });
    } catch (error) {
      logger.error('Error deleting message', {
        error,
        messageId: messageId.toString(),
        characterId: characterId.toString()
      });
      throw error;
    }
  }

  /**
   * Publish moderation event to Redis for AI processing
   *
   * @param eventData - Event payload
   */
  private static async publishModerationEvent(eventData: any): Promise<void> {
    const channel = 'embedding:offgame_message:created';

    try {
      await redis.publish(channel, JSON.stringify(eventData));
      logger.debug('Published offgame moderation event', {
        messageId: eventData.messageId,
        channel
      });
    } catch (error) {
      logger.error('Failed to publish offgame moderation event', {
        error,
        messageId: eventData.messageId
      });
      // Non-fatal: don't throw, just log
    }
  }
}
