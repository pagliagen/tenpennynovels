import cron from 'node-cron';
import { MessageBackupService } from '../services/MessageBackupService';
import { logger } from '@shared/utils/logger';

/**
 * Message Backup Cleanup CRON Job
 *
 * Cleans up expired message backups daily at 3:00 AM.
 * Hard deletes MessageBackup documents where retentionUntil < now.
 *
 * Retention policy:
 * - On-game messages: 90 days (3 months)
 * - Off-game messages: 30 days (1 month)
 *
 * Schedule: Daily at 3:00 AM (0 3 * * *)
 */

// Schedule CRON job - daily at 3:00 AM
cron.schedule('0 3 * * *', async () => {
  try {
    logger.info('Starting message backup cleanup job');

    const deletedCount = await MessageBackupService.cleanupExpired();

    logger.info('Message backup cleanup job completed', {
      deletedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Message backup cleanup job failed', { error });
  }
});

logger.info('Message backup cleanup CRON job initialized (daily at 3:00 AM)');
