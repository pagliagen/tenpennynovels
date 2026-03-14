import { SocialClassConfig } from '@database/models';
import { SocialClass } from '@shared/types/socialClass';
import { logger } from '../logger';

// Social class configuration data from database
export interface SocialClassConfigData {
  name: string;
  minFinanceSkill: number;
  maxFinanceSkill: number;
  weeklyCredit: number;
  initialWealth: {
    minCash: number;
    maxCash: number;
    hasPrivateApartment: boolean;
    apartmentType?: string;
  };
  displayOrder: number;
  description: string;
}

export class FinancialUtils {
  private static socialClassCache: SocialClassConfigData[] | null = null;
  
  /**
   * Load social class configurations from database with caching
   */
  private static async loadSocialClasses(): Promise<SocialClassConfigData[]> {
    if (this.socialClassCache === null) {
      const configs = await SocialClassConfig.find({})
        .sort({ displayOrder: 1 })
        .lean();
        
      this.socialClassCache = configs;
    }
    
    return this.socialClassCache;
  }
  
  /**
   * Calculate social class from FINANZA skill value
   * Returns both the SocialClass type and the full database configuration
   */
  static async calculateSocialClass(finanzaValue: number): Promise<{
    socialClass: SocialClass;
    config: SocialClassConfigData;
  } | null> {
    try {
      const socialClasses = await this.loadSocialClasses();

      // Find the appropriate social class based on FINANZA skill value
      const config = socialClasses.find(sc =>
        finanzaValue >= sc.minFinanceSkill && finanzaValue <= sc.maxFinanceSkill
      );

      if (!config) return null;

      return {
        socialClass: config.name as SocialClass,
        config
      };
    } catch (error: any) {
      logger.error('Error calculating social class:', error);
      return null;
    }
  }
  
  /**
   * Get all social classes (for reference)
   */
  static async getAllSocialClasses(): Promise<SocialClassConfigData[]> {
    return await this.loadSocialClasses();
  }
  
  /**
   * Clear cache (useful for testing or when configurations change)
   */
  static clearCache(): void {
    this.socialClassCache = null;
  }
  
  /**
   * Initialize character finances based on social class
   */
  static async initializeCharacterFinances(characterId: string, socialClass: SocialClassConfigData): Promise<void> {
    try {
      const { CharacterFinances } = require('../../../database/models');
      
      // Generate random initial cash within the social class range
      const initialCash = Math.floor(
        Math.random() * (socialClass.initialWealth.maxCash - socialClass.initialWealth.minCash + 1)
      ) + socialClass.initialWealth.minCash;
      
      // Check if character finances already exist
      const existingFinances = await CharacterFinances.findOne({ characterId });
      
      if (!existingFinances) {
        // Create new character finances
        const finances = new CharacterFinances({
          characterId,
          socialClass: socialClass.name,
          cash: initialCash,
          bankDeposit: 0,
          creditLine: socialClass.weeklyCredit,
          maxCreditLine: socialClass.weeklyCredit,
          creditResetDate: this.getNextSundayMidnight(),
          properties: socialClass.initialWealth.hasPrivateApartment ? 
            [{ 
              type: socialClass.initialWealth.apartmentType || 'Basic Apartment',
              location: 'London',
              value: initialCash * 2 // Rough estimate
            }] : []
        });
        
        await finances.save();
        logger.info(`Character finances initialized for character ${characterId} with social class ${socialClass.name}`);
      } else {
        // Update existing finances if social class changed
        existingFinances.socialClass = socialClass.name;
        existingFinances.maxCreditLine = socialClass.weeklyCredit;
        
        // Only reset credit line if it's higher than the new max
        if (existingFinances.creditLine > socialClass.weeklyCredit) {
          existingFinances.creditLine = socialClass.weeklyCredit;
        }
        
        await existingFinances.save();
        logger.info(`Character finances updated for character ${characterId} with new social class ${socialClass.name}`);
      }
    } catch (error: any) {
      logger.error('Error initializing character finances:', error);
    }
  }
  
  /**
   * Get next Sunday at midnight for credit reset
   */
  static getNextSundayMidnight(): Date {
    const now = new Date();
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7; // 0 = Sunday, so if it's Sunday, get next Sunday
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(0, 0, 0, 0); // Midnight
    return nextSunday;
  }
}