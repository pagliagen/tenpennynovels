import cron from 'node-cron';
import { logger } from '../modules/game/logger';
import { ChatSceneService } from '../modules/game/services/ChatSceneService';

/**
 * Scene Closing Cron Job
 *
 * Ogni 5 minuti marca come "closed" le ChatScene aperte senza attività da
 * più di 60 minuti (vedi ChatSceneService.closeStaleScenes per la logica
 * di segmentazione completa).
 *
 * Schedule: every 5 minutes
 */

async function closeStaleScenes(): Promise<void> {
  try {
    await ChatSceneService.closeStaleScenes();
  } catch (error) {
    logger.error('[SceneClosing] Cron job error:', error);
  }
}

const job = cron.schedule('*/5 * * * *', closeStaleScenes);

logger.info('[SceneClosing] Cron job scheduled (*/5 * * * * UTC)');

export default job;
