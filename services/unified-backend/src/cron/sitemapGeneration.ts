import cron from 'node-cron';
import { SitemapService } from '../services/SitemapService';
import { logger } from '@shared/utils/logger';

// Run daily at 03:00
cron.schedule('0 3 * * *', async () => {
  logger.info('[SitemapCron] Scheduled sitemap generation starting...');
  await SitemapService.generate();
});

logger.info('[SitemapCron] Scheduled daily at 03:00');
