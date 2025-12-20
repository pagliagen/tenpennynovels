import { CharacterSessionManager } from '../utils/characterSessionManager';
import { logger } from '../utils/logger';

export class SessionCleanupJob {
  private static interval: NodeJS.Timeout | null = null;
  private static readonly CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes

  /**
   * Start the session cleanup job
   */
  static start(): void {
    if (this.interval) {
      logger.warn('Session cleanup job is already running');
      return;
    }

    logger.info('Starting session cleanup job', {
      intervalMinutes: this.CLEANUP_INTERVAL / 60000
    });

    // Run immediately
    this.runCleanup();

    // Schedule recurring cleanup
    this.interval = setInterval(() => {
      this.runCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Stop the session cleanup job
   */
  static stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Session cleanup job stopped');
    }
  }

  /**
   * Run the cleanup process
   */
  private static async runCleanup(): Promise<void> {
    try {
      const cleanedCount = await CharacterSessionManager.cleanupExpiredSessions();
      
      if (cleanedCount > 0) {
        logger.info('Session cleanup completed', { 
          expiredSessions: cleanedCount 
        });
      }
    } catch (error: any) {
      logger.error('Session cleanup failed:', error);
    }
  }

  /**
   * Force run cleanup (for manual triggers)
   */
  static async forceCleanup(): Promise<number> {
    try {
      const cleanedCount = await CharacterSessionManager.cleanupExpiredSessions();
      logger.info('Manual session cleanup completed', { 
        expiredSessions: cleanedCount 
      });
      return cleanedCount;
    } catch (error: any) {
      logger.error('Manual session cleanup failed:', error);
      return 0;
    }
  }
}