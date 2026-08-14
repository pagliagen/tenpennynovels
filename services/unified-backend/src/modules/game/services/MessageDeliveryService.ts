import { OnGameMessage } from '@core/chat/models/OnGameMessage';
import { MessageService } from './MessageService';
import { logger } from '@shared/utils/logger';

/**
 * MessageDeliveryService
 *
 * Service for processing scheduled message deliveries.
 *
 * Features:
 * - Process scheduled deliveries (CRON job every 5 minutes)
 * - Mark messages as delivered
 * - Emit WebSocket notifications to recipients
 */
export class MessageDeliveryService {
  /**
   * Process scheduled deliveries
   *
   * Finds all on-game messages where scheduledDelivery <= now and deliveredAt is null.
   * Marks them as delivered and emits WebSocket notifications.
   *
   * Called by CRON job every 5 minutes.
   *
   * @returns Number of messages delivered
   */
  static async processScheduledDeliveries(): Promise<number> {
    try {
      const now = new Date();

      // Find messages ready for delivery
      const messages = await OnGameMessage.find({
        scheduledDelivery: { $lte: now },
        deliveredAt: null
      }).select('_id onGameThreadId senderId recipientId subject');

      if (messages.length === 0) {
        logger.debug('No scheduled deliveries to process');
        return 0;
      }

      logger.info('Processing scheduled deliveries', { count: messages.length });

      let deliveredCount = 0;

      // Process each message
      for (const message of messages) {
        try {
          // Mark as delivered
          await MessageService.deliverMessage(message._id);

          // TODO: Emit WebSocket notification to recipient
          // This will be implemented in Passo 5 (WebSocket Integration)
          // Format: io.to(`character:${recipientId}`).emit('ongame:message_delivered', { ... });

          deliveredCount++;
        } catch (error) {
          logger.error('Failed to deliver message', {
            error,
            messageId: message._id.toString()
          });
          // Continue processing other messages
        }
      }

      logger.info('Scheduled deliveries processed', {
        total: messages.length,
        delivered: deliveredCount,
        failed: messages.length - deliveredCount
      });

      return deliveredCount;
    } catch (error) {
      logger.error('Error processing scheduled deliveries', { error });
      throw error;
    }
  }

  /**
   * Get delivery statistics
   *
   * @returns Delivery stats (pending, delivered today, etc.)
   */
  static async getDeliveryStats(): Promise<{
    pendingDeliveries: number;
    deliveredToday: number;
    scheduledForToday: number;
  }> {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      const [pendingDeliveries, deliveredToday, scheduledForToday] = await Promise.all([
        // Pending deliveries (scheduledDelivery set but not delivered)
        OnGameMessage.countDocuments({
          scheduledDelivery: { $exists: true },
          deliveredAt: null
        }),

        // Delivered today
        OnGameMessage.countDocuments({
          deliveredAt: { $gte: todayStart, $lt: todayEnd }
        }),

        // Scheduled for today (including already delivered)
        OnGameMessage.countDocuments({
          scheduledDelivery: { $gte: todayStart, $lt: todayEnd }
        })
      ]);

      return {
        pendingDeliveries,
        deliveredToday,
        scheduledForToday
      };
    } catch (error) {
      logger.error('Error getting delivery stats', { error });
      throw error;
    }
  }
}
