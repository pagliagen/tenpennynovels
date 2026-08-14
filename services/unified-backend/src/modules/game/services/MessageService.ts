import mongoose from 'mongoose';
import { OnGameMessage } from '@database/models/OnGameMessage';
import { Character } from '@database/models/Character';
import { OnGameThreadService } from './OnGameThreadService';
// boundary-allow: MessageService è infrastruttura condivisa fra il sistema
// postale onGame (core) e la feature offGameMessages — vedi
// features/offGameMessages/manifest.ts per il dettaglio del debito.
import { OffGameMessage, OffGameThreadService } from '@features/offGameMessages/api';
import { MessageBackupService } from './MessageBackupService';
import { logger } from '@shared/utils/logger';
import { redis } from '@config/runtime/redis';

/**
 * MessageService
 *
 * Main service for message operations (on-game and off-game).
 *
 * Features:
 * - Send on-game messages with delivery config snapshot
 * - Send off-game messages with real-time delivery
 * - Schedule delivery for delayed messages
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
      this.publishModerationEvent('offgame', {
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
   * Schedule delivery for on-game message
   *
   * Used by CRON job to set scheduledDelivery field
   *
   * @param messageId - Message ID
   * @param deliveryDate - Scheduled delivery date
   */
  static async scheduleDelivery(
    messageId: mongoose.Types.ObjectId,
    deliveryDate: Date
  ): Promise<void> {
    try {
      await OnGameMessage.findByIdAndUpdate(messageId, {
        scheduledDelivery: deliveryDate
      });

      logger.debug('OnGame message delivery scheduled', {
        messageId: messageId.toString(),
        deliveryDate: deliveryDate.toISOString()
      });
    } catch (error) {
      logger.error('Error scheduling message delivery', { error, messageId: messageId.toString() });
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
   * Delete message (soft delete with backup)
   *
   * OnGame: Per-user soft delete (sender or recipient can delete independently)
   * OffGame: Simple soft delete (deletedAt timestamp)
   *
   * @param messageId - Message ID
   * @param characterId - Character deleting the message
   * @param messageContext - 'ongame' or 'offgame'
   */
  static async deleteMessage(
    messageId: mongoose.Types.ObjectId,
    characterId: mongoose.Types.ObjectId,
    messageContext: 'ongame' | 'offgame'
  ): Promise<void> {
    try {
      if (messageContext === 'ongame') {
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
      } else {
        // OffGame: Simple soft delete
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
      }
    } catch (error) {
      logger.error('Error deleting message', {
        error,
        messageId: messageId.toString(),
        characterId: characterId.toString(),
        messageContext
      });
      throw error;
    }
  }

  /**
   * Publish moderation event to Redis for AI processing
   *
   * @param type - Message type ('ongame' | 'offgame')
   * @param eventData - Event payload
   */
  private static async publishModerationEvent(
    type: 'ongame' | 'offgame',
    eventData: any
  ): Promise<void> {
    const channel = type === 'ongame'
      ? 'embedding:ongame_message:created'
      : 'embedding:offgame_message:created';

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
