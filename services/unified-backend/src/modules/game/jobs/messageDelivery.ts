import cron from 'node-cron';
import { MessageDeliveryService } from '../services/MessageDeliveryService';
import { logger } from '@shared/utils/logger';

/**
 * Message Delivery CRON Job
 *
 * Processes scheduled on-game message deliveries every 5 minutes.
 * Finds messages where scheduledDelivery <= now and marks them as delivered.
 *
 * Schedule: Every 5 minutes (* /5 * * * *)
 */

// Schedule CRON job - every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    logger.debug('Starting scheduled message delivery job');

    const deliveredCount = await MessageDeliveryService.processScheduledDeliveries();

    if (deliveredCount > 0) {
      logger.info('Message delivery job completed', { deliveredCount });
    }
  } catch (error) {
    logger.error('Message delivery job failed', { error });
  }
});

logger.info('Message delivery CRON job initialized (every 5 minutes)');
