import cron from 'node-cron';
import { CharacterFinances } from '../models/CharacterFinances';
import { logger } from '@shared/utils/logger';

/**
 * Service Cancellation Cleanup CRON Job
 *
 * Continuative services (servitù, comunicazioni, trasporti, sicurezza) occupy their
 * VC cost indefinitely once subscribed — there is no monthly renewal to process.
 * This job only removes subscriptions the player has already cancelled, once the
 * already-paid-for monthly cycle has elapsed (activeServices[].pointsFreeAt <= now).
 * Services that were never cancelled are never touched.
 *
 * Schedule: Daily at midnight, Europe/London (0 0 * * *)
 */

export async function removeExpiredCancelledServices(): Promise<{ charactersUpdated: number; servicesRemoved: number }> {
  const now = new Date();
  let charactersUpdated = 0;
  let servicesRemoved = 0;

  const financesWithExpiredCancellations = await CharacterFinances.find({
    'activeServices.cancelledAt': { $exists: true },
    'activeServices.pointsFreeAt': { $lte: now }
  });

  for (const finances of financesWithExpiredCancellations) {
    const before = finances.activeServices.length;
    finances.activeServices = finances.activeServices.filter((entry: any) =>
      !(entry.cancelledAt && entry.pointsFreeAt && entry.pointsFreeAt <= now)
    ) as any;
    const removed = before - finances.activeServices.length;

    if (removed > 0) {
      await finances.save();
      charactersUpdated += 1;
      servicesRemoved += removed;
    }
  }

  return { charactersUpdated, servicesRemoved };
}

cron.schedule('0 0 * * *', async () => {
  try {
    logger.info('Starting service cancellation cleanup job');

    const result = await removeExpiredCancelledServices();

    logger.info('Service cancellation cleanup job completed', result);
  } catch (error) {
    logger.error('Service cancellation cleanup job failed', { error });
  }
}, { timezone: 'Europe/London' });

logger.info('Service cancellation cleanup CRON job initialized (daily at midnight, Europe/London)');
