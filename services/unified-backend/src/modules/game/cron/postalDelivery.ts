import cron from 'node-cron';
import { OnGameMessage, OnGameMessageView, Character } from '@database/models';
import { logger } from '../utils/logger';
import { postalSystem } from '../utils/postalSystem';
import { app } from '../index';

class PostalDeliveryService {
  private static instance: PostalDeliveryService;
  private isInitialized = false;

  public static getInstance(): PostalDeliveryService {
    if (!PostalDeliveryService.instance) {
      PostalDeliveryService.instance = new PostalDeliveryService();
    }
    return PostalDeliveryService.instance;
  }

  public initialize(): void {
    if (this.isInitialized) {
      logger.warn('Postal delivery service already initialized');
      return;
    }

    const settings = postalSystem.getSettings();
    logger.info('Initializing postal delivery service with cron jobs');

    // Realtime messages check (every minute)
    cron.schedule(settings.cronJobIntervals.realtime_check, async () => {
      await this.processRealtimeMessages();
    }, {
      timezone: settings.defaultTimezone
    });

    // Scheduled delivery check (every 15 minutes)
    cron.schedule(settings.cronJobIntervals.scheduled_delivery, async () => {
      await this.processScheduledDeliveries();
    }, {
      timezone: settings.defaultTimezone
    });

    // Messenger boy check (every 5 minutes)
    cron.schedule(settings.cronJobIntervals.messenger_boy_check, async () => {
      await this.processMessengerBoyDeliveries();
    }, {
      timezone: settings.defaultTimezone
    });

    // Daily batch deliveries
    cron.schedule(settings.cronJobIntervals.daily_batch_morning, async () => {
      await this.processDailyBatchDeliveries('09:00');
    }, {
      timezone: settings.defaultTimezone
    });

    cron.schedule(settings.cronJobIntervals.daily_batch_afternoon, async () => {
      await this.processDailyBatchDeliveries('15:00');
    }, {
      timezone: settings.defaultTimezone
    });

    cron.schedule(settings.cronJobIntervals.daily_batch_evening, async () => {
      await this.processDailyBatchDeliveries('18:00');
    }, {
      timezone: settings.defaultTimezone
    });

    this.isInitialized = true;
    logger.info('Postal delivery service initialized successfully');
  }

  private async processRealtimeMessages(): Promise<void> {
    try {
      const now = new Date();
      
      // Find messages that should be delivered immediately
      const messages = await OnGameMessage.find({
        messageType: 'note',
        scheduledDelivery: { $lte: now },
        deliveredAt: { $exists: false }
      }).populate('from to', 'name avatar');

      if (messages.length === 0) return;

      logger.info(`Processing ${messages.length} realtime messages for delivery`);

      for (const message of messages) {
        await this.deliverMessage(message);
      }

    } catch (error: any) {
      logger.error('Error processing realtime messages:', error);
    }
  }

  private async processScheduledDeliveries(): Promise<void> {
    try {
      const now = new Date();
      
      // Find messages scheduled for delivery (telegrams, variable delay letters)
      const messages = await OnGameMessage.find({
        messageType: { $in: ['telegram', 'express_letter'] },
        scheduledDelivery: { $lte: now },
        deliveredAt: { $exists: false }
      }).populate('from to', 'name avatar');

      if (messages.length === 0) return;

      logger.info(`Processing ${messages.length} scheduled messages for delivery`);

      for (const message of messages) {
        await this.deliverMessage(message);
      }

    } catch (error: any) {
      logger.error('Error processing scheduled deliveries:', error);
    }
  }

  private async processMessengerBoyDeliveries(): Promise<void> {
    try {
      const now = new Date();
      
      // Find messenger boy deliveries ready
      const messages = await OnGameMessage.find({
        messageType: 'express_letter',
        scheduledDelivery: { $lte: now },
        deliveredAt: { $exists: false }
      }).populate('from to', 'name avatar');

      if (messages.length === 0) return;

      logger.info(`Processing ${messages.length} messenger boy deliveries`);

      for (const message of messages) {
        await this.deliverMessage(message, 'messenger_boy');
      }

    } catch (error: any) {
      logger.error('Error processing messenger boy deliveries:', error);
    }
  }

  private async processDailyBatchDeliveries(deliveryTime: string): Promise<void> {
    try {
      const now = new Date();
      
      // Find messages for this batch delivery time
      const messages = await OnGameMessage.find({
        messageType: { $in: ['letter', 'postcard', 'invitation', 'official_document'] },
        scheduledDelivery: { $lte: now },
        deliveredAt: { $exists: false }
      }).populate('from to', 'name avatar');

      if (messages.length === 0) return;

      logger.info(`Processing ${messages.length} daily batch deliveries for ${deliveryTime}`);

      for (const message of messages) {
        const messageConfig = postalSystem.getMessageType(message.messageType);
        if (messageConfig?.deliveryTiming?.dailyDeliveryTimes?.includes(deliveryTime)) {
          await this.deliverMessage(message, 'daily_batch');
        }
      }

    } catch (error: any) {
      logger.error(`Error processing daily batch deliveries for ${deliveryTime}:`, error);
    }
  }

  private async deliverMessage(message: any, deliveryMethod?: string): Promise<void> {
    try {
      const now = new Date();
      
      // Mark message as delivered
      message.deliveredAt = now;
      await message.save();

      // Update recipient inbox views
      await OnGameMessageView.updateMany(
        {
          messageId: message._id,
          viewType: 'inbox'
        },
        {
          $set: {
            deliveryStatus: 'delivered',
            deliveredAt: now
          }
        }
      );

      // Update sender outbox view
      await OnGameMessageView.updateOne(
        {
          messageId: message._id,
          viewType: 'outbox'
        },
        {
          $set: {
            deliveryStatus: 'delivered',
            deliveredAt: now
          }
        }
      );

      // Trigger WebSocket notifications
      await this.sendDeliveryNotifications(message, deliveryMethod);

      logger.info('Message delivered successfully', {
        messageId: message._id,
        messageType: message.messageType,
        deliveryMethod: deliveryMethod || 'standard',
        recipientCount: message.to.length
      });

    } catch (error: any) {
      logger.error('Error delivering message:', error);
      
      // Mark delivery as failed
      await OnGameMessageView.updateMany(
        {
          messageId: message._id,
          viewType: 'inbox'
        },
        {
          $set: {
            deliveryStatus: 'failed'
          },
          $inc: {
            deliveryAttempts: 1
          }
        }
      );
    }
  }

  private async sendDeliveryNotifications(message: any, deliveryMethod?: string): Promise<void> {
    try {
      // Get Socket.io instance from app
      const io = app.get('io');
      if (!io) {
        logger.warn('Socket.io instance not available for delivery notifications');
        return;
      }

      const messageConfig = postalSystem.getMessageType(message.messageType);
      const deliveryTypeText = this.getDeliveryTypeText(message.messageType, deliveryMethod);

      // Send notifications to recipients
      for (const recipient of message.to) {
        const notificationData = {
          messageId: message._id.toString(),
          fromCharacterId: message.from._id.toString(),
          fromCharacterName: message.from.name || 'Unknown',
          toCharacterIds: [recipient._id.toString()],
          messageType: message.messageType,
          subject: message.subject,
          content: message.content,
          sentAt: message.sentAt,
          deliveredAt: message.deliveredAt,
          icon: messageConfig?.icon || '📬',
          postageCharged: message.postageCharged || 0
        };

        const recipientRoom = `character_${recipient._id}`;
        io.to(recipientRoom).emit('ongame:message_delivered', notificationData);
        
        logger.debug('Delivery notification sent', {
          recipient: recipient._id,
          messageType: message.messageType,
          deliveryMethod: deliveryTypeText
        });
      }

      // Send delivery confirmation to sender (also triggers thread refresh)
      const senderNotificationData = {
        messageId: message._id.toString(),
        fromCharacterId: message.from._id.toString(),
        fromCharacterName: message.from.name || 'Unknown',
        toCharacterIds: message.to.map((r: any) => r._id.toString()),
        messageType: message.messageType,
        subject: message.subject,
        content: message.content,
        sentAt: message.sentAt,
        deliveredAt: message.deliveredAt,
        icon: messageConfig?.icon || '📬',
        postageCharged: message.postageCharged || 0
      };

      const senderRoom = `character_${message.from._id}`;
      io.to(senderRoom).emit('ongame:message_delivery_confirmed', senderNotificationData);

    } catch (error: any) {
      logger.error('Error sending delivery notifications:', error);
    }
  }

  private getDeliveryTypeText(messageType: string, deliveryMethod?: string): string {
    switch (messageType) {
      case 'note':
        return 'Consegna immediata';
      case 'telegram':
        return 'Telegramma';
      case 'express_letter':
        return deliveryMethod === 'messenger_boy' ? 'Ragazzino messaggero' : 'Lettera espressa';
      case 'letter':
        return 'Posta ordinaria';
      case 'postcard':
        return 'Cartolina';
      case 'invitation':
        return 'Invito formale';
      case 'official_document':
        return 'Documento ufficiale';
      default:
        return 'Posta';
    }
  }

  public async processFailedDeliveries(): Promise<void> {
    try {
      // Find messages with failed deliveries to retry
      const failedViews = await OnGameMessageView.find({
        deliveryStatus: 'failed',
        deliveryAttempts: { $lt: 3 } // Max 3 retry attempts
      }).populate('messageId');

      if (failedViews.length === 0) return;

      logger.info(`Retrying ${failedViews.length} failed deliveries`);

      for (const view of failedViews) {
        if (view.messageId) {
          await this.deliverMessage(view.messageId);
        }
      }

    } catch (error: any) {
      logger.error('Error processing failed deliveries:', error);
    }
  }

  public getStatus(): {
    initialized: boolean;
    cronJobs: Record<string, string>;
  } {
    return {
      initialized: this.isInitialized,
      cronJobs: postalSystem.getSettings().cronJobIntervals
    };
  }
}

export const postalDeliveryService = PostalDeliveryService.getInstance();