import { SocialClassConfig } from '../../../../packages/database/models';

export interface SocialClass {
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
  private static socialClassCache: SocialClass[] | null = null;
  
  /**
   * Load social class configurations from database with caching
   */
  private static async loadSocialClasses(): Promise<SocialClass[]> {
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
   */
  static async calculateSocialClass(finanzaValue: number): Promise<SocialClass | null> {
    try {
      const socialClasses = await this.loadSocialClasses();
      
      // Find the appropriate social class based on FINANZA skill value
      const socialClass = socialClasses.find(sc => 
        finanzaValue >= sc.minFinanceSkill && finanzaValue <= sc.maxFinanceSkill
      );
      
      return socialClass || null;
    } catch (error: any) {
      console.error('Error calculating social class:', error);
      return null;
    }
  }
  
  /**
   * Get all social classes (for reference)
   */
  static async getAllSocialClasses(): Promise<SocialClass[]> {
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
  static async initializeCharacterFinances(characterId: string, socialClass: SocialClass): Promise<void> {
    try {
      const { CharacterFinances } = require('../../../../packages/database/models');
      
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
        console.log(`Character finances initialized for character ${characterId} with social class ${socialClass.name}`);
      } else {
        // Update existing finances if social class changed
        existingFinances.socialClass = socialClass.name;
        existingFinances.maxCreditLine = socialClass.weeklyCredit;
        
        // Only reset credit line if it's higher than the new max
        if (existingFinances.creditLine > socialClass.weeklyCredit) {
          existingFinances.creditLine = socialClass.weeklyCredit;
        }
        
        await existingFinances.save();
        console.log(`Character finances updated for character ${characterId} with new social class ${socialClass.name}`);
      }
    } catch (error: any) {
      console.error('Error initializing character finances:', error);
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
  
  /**
   * Log financial transaction
   */
  static async logTransaction(
    characterId: string,
    type: 'credit_purchase' | 'cash_purchase' | 'credit_reset' | 'salary' | 'transfer_in' | 'transfer_out' | 'admin_grant',
    amount: number,
    description: string,
    itemId?: string
  ): Promise<void> {
    try {
      const { FinancialTransaction } = require('../../../../packages/database/models');
      
      const transaction = new FinancialTransaction({
        characterId,
        type,
        amount,
        description,
        itemId,
        timestamp: new Date()
      });
      
      await transaction.save();
    } catch (error: any) {
      console.error('Error logging financial transaction:', error);
    }
  }
}