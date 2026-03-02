import cron from 'node-cron';
import { logger } from '../utils/logger';
import { FinancialUtils } from '../utils/financialUtils';

export class CreditLineResetService {
  private static isInitialized = false;

  /**
   * Initialize the credit line reset service with cron job
   */
  static async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('CreditLineResetService already initialized, skipping');
      return;
    }

    try {
      // Fetch cron schedule from database
      const { ConfigurationService } = await import('@shared/services/ConfigurationService');
      const { redis } = await import('@config/runtime');
      const redisClient = redis.getClient();
      const configService = new ConfigurationService(redisClient as any, logger);

      const creditResetSchedule = await configService.getConfig('cron_schedule_credit_reset') || '0 0 0 * * SUN';

      logger.info(`✅ Initializing Credit Line Reset cron with schedule: ${creditResetSchedule}`);

      // Schedule job with dynamic schedule (default: every Sunday at midnight)
      cron.schedule(creditResetSchedule, async () => {
        logger.info('Starting weekly credit line reset process');
        await this.resetWeeklyCreditLines();
      }, {
        timezone: 'Europe/London' // UK timezone for Victorian London setting
      });

      this.isInitialized = true;
      logger.info('✅ CreditLineResetService initialized successfully');

    } catch (error: any) {
      logger.error('Failed to initialize CreditLineResetService', error);
      throw error;
    }
  }
  
  /**
   * Reset credit lines for all characters
   */
  static async resetWeeklyCreditLines(): Promise<void> {
    try {
      const { CharacterFinances } = require('../../database/models');
      
      // Get all character finances
      const allFinances = await CharacterFinances.find({});
      
      let resetCount = 0;
      const resetResults = [];
      
      for (const finance of allFinances) {
        try {
          // Reset credit line to maximum
          const oldCreditLine = finance.creditLine;
          finance.creditLine = finance.maxCreditLine;
          finance.creditResetDate = FinancialUtils.getNextSundayMidnight();
          
          await finance.save();
          
          // Log the transaction
          await FinancialUtils.logTransaction(
            finance.characterId.toString(),
            'credit_reset',
            finance.maxCreditLine,
            `Weekly credit line reset from £${oldCreditLine} to £${finance.maxCreditLine}`
          );
          
          resetResults.push({
            characterId: finance.characterId.toString(),
            oldCreditLine,
            newCreditLine: finance.maxCreditLine,
            socialClass: finance.socialClass
          });
          
          resetCount++;
          
        } catch (error: any) {
          logger.error('Failed to reset credit line for character', {
            characterId: finance.characterId.toString(),
            error: (error as Error).message
          });
        }
      }
      
      logger.info('Weekly credit line reset completed', {
        totalCharacters: allFinances.length,
        successfulResets: resetCount,
        failedResets: allFinances.length - resetCount,
        resetResults: resetResults.slice(0, 10) // Log first 10 for debugging
      });
      
    } catch (error: any) {
      logger.error('Critical error during weekly credit line reset', error);
    }
  }
  
  /**
   * Manual trigger for credit line reset (for testing or admin purposes)
   */
  static async triggerManualReset(): Promise<{ success: boolean; message: string; resetCount?: number }> {
    try {
      logger.info('Manual credit line reset triggered');
      await this.resetWeeklyCreditLines();
      
      // Get count for response
      const { CharacterFinances } = require('../../database/models');
      const count = await CharacterFinances.countDocuments();
      
      return {
        success: true,
        message: 'Credit lines reset successfully',
        resetCount: count
      };
    } catch (error: any) {
      logger.error('Manual credit line reset failed', error);
      return {
        success: false,
        message: `Reset failed: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * Get next reset date for all characters
   */
  static async getNextResetDate(): Promise<Date> {
    return FinancialUtils.getNextSundayMidnight();
  }
  
  /**
   * Get service status
   */
  static getStatus(): { isInitialized: boolean; nextResetDate: Date } {
    return {
      isInitialized: this.isInitialized,
      nextResetDate: FinancialUtils.getNextSundayMidnight()
    };
  }
}