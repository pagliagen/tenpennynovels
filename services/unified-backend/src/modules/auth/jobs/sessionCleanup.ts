import { CharacterSessionManager } from '../utils/characterSessionManager';
import { logger } from '../utils/logger';
import { db } from '@database/models';

export class SessionCleanupJob {
  private static interval: NodeJS.Timeout | null = null;
  private static readonly CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes

  /**
   * Check if MongoDB connection is ready
   */
  private static isDatabaseReady(): boolean {
    return db.getConnection().readyState === 1; // 1 = connected
  }

  /**
   * Wait for MongoDB connection to be ready and verified
   */
  private static async waitForDatabase(maxWaitMs: number = 15000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      if (this.isDatabaseReady()) {
        // Double-check by trying to ping the database
        try {
          await db.getConnection().db?.admin().ping();
          return true;
        } catch (error) {
          // Connection not fully ready yet, continue waiting
          logger.debug('Database ping failed, waiting...');
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500)); // Check every 500ms
    }
    return false;
  }

  /**
   * Start the session cleanup job
   */
  static async start(): Promise<void> {
    if (this.interval) {
      logger.warn('Session cleanup job is already running');
      return;
    }

    logger.info('Starting session cleanup job', {
      intervalMinutes: this.CLEANUP_INTERVAL / 60000
    });

    // Wait for MongoDB connection to be fully ready and verified before starting
    const dbReady = await this.waitForDatabase(15000); // Wait up to 15 seconds
    
    if (dbReady) {
      logger.info('Database ready and verified, starting cleanup job');
      // Skip initial cleanup - let it run on the first scheduled interval instead
      // This ensures MongoDB is fully ready and all models are loaded
      logger.info('Initial cleanup skipped - will run on first scheduled interval');
    } else {
      logger.warn('Database not ready after waiting, will retry on next interval');
    }

    // Schedule recurring cleanup
    this.interval = setInterval(() => {
      if (this.isDatabaseReady()) {
        this.runCleanup();
      } else {
        logger.warn('Database not ready, skipping cleanup cycle');
      }
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
    if (!this.isDatabaseReady()) {
      logger.warn('Database not ready, cannot run manual cleanup');
      return 0;
    }

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