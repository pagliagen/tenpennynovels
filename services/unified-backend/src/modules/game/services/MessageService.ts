import mongoose from 'mongoose';
import { OnGameMessage } from '@core/chat/models/OnGameMessage';
import { Character } from '@core/character/models/Character';
import { OnGameThreadService } from './OnGameThreadService';
import { MessageBackupService } from './MessageBackupService';
import { logger } from '@shared/utils/logger';
import { redis } from '@config/runtime/redis';

/**
 * MessageService
 *
 * Main service for on-game message operations (postal system). La metà
 * off-game si è spostata in features/offGameMessages/services/OffGameMessageService.ts
 * (Fase 7.4, split non più necessario per boundary compliance — questo file
 * resta in modules/, poteva già importare @features/offGameMessages/api
 * liberamente — voluto comunque per separare le responsabilità).
 *
 * Features:
 * - Send on-game messages with delivery config snapshot
 * - Mark messages as delivered
 * - Soft delete with backup creation
 */
export class MessageService {
  /**
   * Send on-game message (postal system)
   *
   * Validation:
   * - Sender must be APPROVED character
   * - Recipient must exist and be APPROVED
   * - Sender must have enough credits
   * - If reply, original message must allow replies
   *
   * @param params - Message parameters
   * @returns Created message
   */
  static async sendOnGameMessage(params: {
    senderId: mongoose.Types.ObjectId;
    recipientId: mongoose.Types.ObjectId;
    messageType: 'letter' | 'note' | 'telegram' | 'dispatch' | 'flyer';
    subject: string;
    content: string;
    deliveryConfig: {
      deliveryDelay: number;
      cost: number;
      canReply: boolean;
      displayName: string;
    };
    replyTo?: mongoose.Types.ObjectId;
  }): Promise<any> {
    try {
      // Validate sender is approved
      const sender = await Character.findById(params.senderId);
      if (!sender || sender.playerStatus !== 'approved') {
        throw new Error('Sender must be an approved character');
      }

      // Validate recipient exists and is approved
      const recipient = await Character.findById(params.recipientId);
      if (!recipient || recipient.playerStatus !== 'approved') {
        throw new Error('Recipient must be an approved character');
      }

      // Validate sender has enough credits
      if (sender.credits < params.deliveryConfig.cost) {
        throw new Error('Insufficient credits');
      }

      // If reply, validate original message allows replies
      if (params.replyTo) {
        const originalMessage = await OnGameMessage.findById(params.replyTo);
        if (!originalMessage) {
          throw new Error('Original message not found');
        }
        if (!originalMessage.deliveryConfig.canReply) {
          throw new Error('Original message does not allow replies');
        }
      }

      // Find or create thread
      const thread = await OnGameThreadService.findOrCreateThread(
        params.senderId,
        params.recipientId
      );

      // Calculate scheduled delivery time
      const scheduledDelivery = params.deliveryConfig.deliveryDelay > 0
        ? new Date(Date.now() + params.deliveryConfig.deliveryDelay)
        : undefined;

      // Create message
      const message = await OnGameMessage.create({
        onGameThreadId: thread._id,
        senderId: params.senderId,
        recipientId: params.recipientId,
        messageType: params.messageType,
        subject: params.subject,
        content: params.content,
        deliveryConfig: params.deliveryConfig, // Snapshot (immutable)
        sentAt: new Date(),
        scheduledDelivery,
        deliveredAt: params.deliveryConfig.deliveryDelay === 0 ? new Date() : undefined,
        deletedBy: {},
        replyTo: params.replyTo
      });

      // Deduct credits from sender
      sender.credits -= params.deliveryConfig.cost;
      await sender.save();

      // Update thread metadata
      await OnGameThreadService.updateThreadMetadata(
        thread._id,
        params.subject,
        params.content
      );

      // Increment unread count for recipient
      await OnGameThreadService.incrementUnreadCount(thread._id, params.recipientId);

      logger.info('OnGame message sent', {
        messageId: message._id,
        senderId: params.senderId.toString(),
        recipientId: params.recipientId.toString(),
        messageType: params.messageType,
        scheduledDelivery: scheduledDelivery?.toISOString()
      });

      // Publish moderation event (non-blocking)
      this.publishModerationEvent('ongame', {
        messageId: message._id.toString(),
        threadId: thread._id.toString(),
        senderId: params.senderId.toString(),
        recipientId: params.recipientId.toString(),
        messageType: params.messageType,
        subject: params.subject,
        content: params.content,
        timestamp: Date.now()
      }).catch(err =>
        logger.error('Failed to publish OnGame moderation event', { error: err, messageId: message._id })
      );

      return message;
    } catch (error) {
      logger.error('Error sending OnGame message', { error, params });
      throw error;
    }
  }

  /**
   * Mark on-game message as delivered
   *
   * Called by CRON job when scheduledDelivery time is reached
   *
   * @param messageId - Message ID
   */
  static async deliverMessage(messageId: mongoose.Types.ObjectId): Promise<void> {
    try {
      const message = await OnGameMessage.findById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      message.markDelivered();
      await message.save();

      logger.info('OnGame message delivered', {
        messageId: messageId.toString(),
        recipientId: message.recipientId.toString()
      });
    } catch (error) {
      logger.error('Error delivering message', { error, messageId: messageId.toString() });
      throw error;
    }
  }

  /**
   * Delete on-game message (soft delete with backup)
   *
   * Per-user soft delete: sender or recipient can delete independently.
   * Backup created only once both have deleted their side.
   *
   * @param messageId - Message ID
   * @param characterId - Character deleting the message
   */
  static async deleteMessage(
    messageId: mongoose.Types.ObjectId,
    characterId: mongoose.Types.ObjectId
  ): Promise<void> {
    try {
      const message = await OnGameMessage.findById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      // Check if character is sender or recipient
      const isSender = message.senderId.equals(characterId);
      const isRecipient = message.recipientId.equals(characterId);

      if (!isSender && !isRecipient) {
        throw new Error('Character is not sender or recipient');
      }

      // Mark as deleted by sender or recipient
      if (isSender) {
        message.markDeletedBySender();
      } else {
        message.markDeletedByRecipient();
      }

      await message.save();

      // If deleted by both, create backup
      if (message.deletedBy.sender && message.deletedBy.recipient) {
        await MessageBackupService.createBackup(message, 'ongame', characterId);
        logger.info('OnGame message backup created (deleted by both)', {
          messageId: messageId.toString()
        });
      }

      logger.info('OnGame message marked deleted', {
        messageId: messageId.toString(),
        characterId: characterId.toString(),
        isSender
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
  private static async publishModerationEvent(
    type: 'ongame',
    eventData: any
  ): Promise<void> {
    const channel = 'embedding:ongame_message:created';

    try {
      await redis.publish(channel, JSON.stringify(eventData));
      logger.debug(`Published ${type} moderation event`, {
        messageId: eventData.messageId,
        channel
      });
    } catch (error) {
      logger.error(`Failed to publish ${type} moderation event`, {
        error,
        messageId: eventData.messageId
      });
      // Non-fatal: don't throw, just log
    }
  }
}
