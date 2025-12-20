import cron from 'node-cron';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';

/**
 * Automated Rent Collection System
 * Processes daily rent collection for all rental properties
 * Runs every day at 6:00 AM
 */

interface OverdueProperty {
  _id: mongoose.Types.ObjectId;
  name: string;
  monthlyRent: number;
  currentTenantId: mongoose.Types.ObjectId;
  rentPaidUntil: Date;
  district: string;
  propertyType: string;
}

/**
 * Process overdue rent for a single property
 */
async function processOverdueRent(property: OverdueProperty): Promise<void> {
  try {
    const { HousingProperty, EstateTransaction, CharacterFinances } = await import('../../../../packages/database/models');
    
    const tenantId = property.currentTenantId;
    const propertyId = property._id;
    const monthlyRent = property.monthlyRent;
    
    logger.info('Processing overdue rent', {
      propertyId: propertyId.toString(),
      tenantId: tenantId.toString(),
      monthlyRent,
      rentPaidUntil: property.rentPaidUntil
    });
    
    // Get tenant's financial information
    const tenantFinances = await CharacterFinances.findOne({ characterId: tenantId });
    
    if (!tenantFinances) {
      logger.warn('Tenant finances not found for overdue rent', { 
        tenantId: tenantId.toString(),
        propertyId: propertyId.toString()
      });
      return;
    }
    
    // Check if tenant can afford the rent
    const totalAvailable = tenantFinances.cash + tenantFinances.bankDeposit;
    if (totalAvailable >= monthlyRent) {
      // Auto-pay rent
      const session = await mongoose.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Deduct rent from tenant's balance
          await CharacterFinances.updateOne(
            { characterId: tenantId },
            { 
              $inc: { currentBalance: -monthlyRent },
              $push: {
                transactionHistory: {
                  type: 'debit',
                  amount: monthlyRent,
                  description: `Monthly rent for ${property.name}`,
                  category: 'housing_rent',
                  relatedId: propertyId,
                  balance: totalAvailable - monthlyRent,
                  createdAt: new Date()
                }
              }
            },
            { session }
          );
          
          // Update property rent paid until next month
          const nextMonthDate = new Date();
          nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
          
          await HousingProperty.updateOne(
            { _id: propertyId },
            { 
              rentPaidUntil: nextMonthDate,
              lastRentPayment: new Date()
            },
            { session }
          );
          
          // Create estate transaction record
          const transaction = new EstateTransaction({
            transactionType: 'rental_payment',
            propertyId: propertyId,
            characterId: tenantId,
            amount: monthlyRent,
            currency: 'pence',
            description: `Monthly rent payment for ${property.name}`,
            paymentMethod: 'automatic_deduction',
            status: 'completed',
            metadata: {
              district: property.district,
              propertyType: property.propertyType,
              isAutomaticPayment: true
            }
          });
          
          await transaction.save({ session });
          
          logger.info('Rent auto-payment successful', {
            propertyId: propertyId.toString(),
            tenantId: tenantId.toString(),
            amount: monthlyRent,
            newBalance: totalAvailable - monthlyRent,
            rentPaidUntil: nextMonthDate
          });
        });
      } catch (transactionError: any) {
        // Handle transaction error - fallback to non-transactional if needed
        if (transactionError?.message?.includes('Transaction numbers are only allowed on a replica set member or mongos')) {
          logger.warn('MongoDB transactions not supported, using regular operations for rent collection');
          await processRentWithoutTransaction(property, tenantFinances, monthlyRent);
        } else {
          throw transactionError;
        }
      } finally {
        await session.endSession();
      }
      
    } else {
      // Tenant cannot afford rent - mark as overdue
      const daysOverdue = Math.floor((Date.now() - property.rentPaidUntil.getTime()) / (1000 * 60 * 60 * 24));

      // Fetch configuration values from database
      const { ConfigurationService } = await import('../../../../packages/shared/src/services/ConfigurationService');
      const { getRedisClient } = await import('../config/redis');
      const redis = getRedisClient();
      const configService = new ConfigurationService(redis, logger);

      const evictionNoticeDays = await configService.getConfig('housing_eviction_notice_days') || 30;

      if (daysOverdue >= evictionNoticeDays) {
        // Evict tenant after notice period
        await evictTenant(property, tenantFinances);
      } else if (daysOverdue >= 7) {
        // Send warning after 7 days
        await sendRentWarning(property, tenantFinances, daysOverdue);
      }
      
      logger.warn('Tenant cannot afford rent', {
        propertyId: propertyId.toString(),
        tenantId: tenantId.toString(),
        currentBalance: totalAvailable,
        rentAmount: monthlyRent,
        daysOverdue
      });
    }
    
  } catch (error: any) {
    logger.error('Error processing overdue rent', {
      propertyId: property._id.toString(),
      tenantId: property.currentTenantId.toString(),
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Process rent payment without transactions (fallback for development)
 */
async function processRentWithoutTransaction(
  property: OverdueProperty, 
  tenantFinances: any, 
  monthlyRent: number
): Promise<void> {
  const { HousingProperty, EstateTransaction, CharacterFinances } = await import('../../../../packages/database/models');
  
  // Deduct rent from tenant's balance
  await CharacterFinances.updateOne(
    { characterId: property.currentTenantId },
    { 
      $inc: { currentBalance: -monthlyRent },
      $push: {
        transactionHistory: {
          type: 'debit',
          amount: monthlyRent,
          description: `Monthly rent for ${property.name}`,
          category: 'housing_rent',
          relatedId: property._id,
          balance: tenantFinances.currentBalance - monthlyRent,
          createdAt: new Date()
        }
      }
    }
  );
  
  // Update property rent paid until next month
  const nextMonthDate = new Date();
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  
  await HousingProperty.updateOne(
    { _id: property._id },
    { 
      rentPaidUntil: nextMonthDate,
      lastRentPayment: new Date()
    }
  );
  
  // Create estate transaction record
  const transaction = new EstateTransaction({
    transactionType: 'rental_payment',
    propertyId: property._id,
    characterId: property.currentTenantId,
    amount: monthlyRent,
    currency: 'pence',
    description: `Monthly rent payment for ${property.name}`,
    paymentMethod: 'automatic_deduction',
    status: 'completed',
    metadata: {
      district: property.district,
      propertyType: property.propertyType,
      isAutomaticPayment: true
    }
  });
  
  await transaction.save();
  
  logger.info('Rent auto-payment successful (non-transactional)', {
    propertyId: property._id.toString(),
    tenantId: property.currentTenantId.toString(),
    amount: monthlyRent,
    newBalance: tenantFinances.currentBalance - monthlyRent,
    rentPaidUntil: nextMonthDate
  });
}

/**
 * Evict tenant who hasn't paid rent past the notice period
 */
async function evictTenant(property: OverdueProperty, tenantFinances: any): Promise<void> {
  try {
    const { HousingProperty, EstateTransaction } = await import('../../../../packages/database/models');

    // Fetch eviction fee from configuration
    const { ConfigurationService } = await import('../../../../packages/shared/src/services/ConfigurationService');
    const { getRedisClient } = await import('../config/redis');
    const redis = getRedisClient();
    const configService = new ConfigurationService(redis, logger);

    const evictionFee = await configService.getConfig('housing_eviction_fee_pence') || 50;
    
    // Remove tenant from property
    await HousingProperty.updateOne(
      { _id: property._id },
      {
        $unset: { 
          currentTenantId: 1,
          rentPaidUntil: 1
        },
        isAvailable: true,
        lastEvictionDate: new Date()
      }
    );
    
    // Create eviction transaction
    const evictionTransaction = new EstateTransaction({
      transactionType: 'eviction_fee',
      propertyId: property._id,
      characterId: property.currentTenantId,
      amount: evictionFee,
      currency: 'pence',
      description: `Eviction fee for ${property.name}`,
      status: 'completed',
      metadata: {
        district: property.district,
        propertyType: property.propertyType,
        daysOverdue: Math.floor((Date.now() - property.rentPaidUntil.getTime()) / (1000 * 60 * 60 * 24))
      }
    });
    
    await evictionTransaction.save();
    
    logger.info('Tenant evicted for non-payment', {
      propertyId: property._id.toString(),
      tenantId: property.currentTenantId.toString(),
      daysOverdue: Math.floor((Date.now() - property.rentPaidUntil.getTime()) / (1000 * 60 * 60 * 24)),
      evictionFee
    });
    
  } catch (error: any) {
    logger.error('Error evicting tenant', {
      propertyId: property._id.toString(),
      tenantId: property.currentTenantId.toString(),
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Send rent warning to tenant (placeholder for future notification system)
 */
async function sendRentWarning(property: OverdueProperty, tenantFinances: any, daysOverdue: number): Promise<void> {
  logger.info('Rent warning should be sent', {
    propertyId: property._id.toString(),
    tenantId: property.currentTenantId.toString(),
    daysOverdue,
    rentAmount: property.monthlyRent,
    currentBalance: tenantFinances.currentBalance
  });
  
  // TODO: Integrate with messaging system to send in-game notifications
  // This could use the OnGame messaging system or location chat
}

/**
 * Daily rent collection cron job
 * Runs every day at 6:00 AM
 */
function startRentCollectionCron(): void {
  // Daily rent collection check (every day at 6:00 AM)
  cron.schedule('0 6 * * *', async () => {
    logger.info('Starting daily rent collection process');
    
    try {
      const { HousingProperty } = await import('../../../../packages/database/models');
      
      // Find properties with overdue rent
      const overdueProperties = await HousingProperty.find({
        rentPaidUntil: { $lt: new Date() },
        ownershipType: 'rental',
        currentTenantId: { $exists: true }
      }).select('name monthlyRent currentTenantId rentPaidUntil district propertyType');
      
      if (overdueProperties.length === 0) {
        logger.info('No overdue rent found');
        return;
      }
      
      logger.info(`Processing rent for ${overdueProperties.length} overdue properties`);
      
      let processedCount = 0;
      let errorCount = 0;
      
      for (const property of overdueProperties) {
        try {
          await processOverdueRent(property as OverdueProperty);
          processedCount++;
        } catch (error: any) {
          errorCount++;
          logger.error('Error processing property rent', {
            propertyId: property._id.toString(),
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      logger.info('Daily rent collection completed', {
        totalProperties: overdueProperties.length,
        processedCount,
        errorCount
      });
      
    } catch (error: any) {
      logger.error('Daily rent collection failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  logger.info('Rent collection cron job scheduled (daily at 6:00 AM)');
}

/**
 * Manual rent collection trigger (for testing and admin use)
 */
export async function triggerRentCollection(): Promise<{ processedCount: number; errorCount: number }> {
  logger.info('Manual rent collection triggered');
  
  try {
    const { HousingProperty } = await import('../../../../packages/database/models');
    
    // Find properties with overdue rent
    const overdueProperties = await HousingProperty.find({
      rentPaidUntil: { $lt: new Date() },
      ownershipType: 'rental',
      currentTenantId: { $exists: true }
    }).select('name monthlyRent currentTenantId rentPaidUntil district propertyType');
    
    if (overdueProperties.length === 0) {
      logger.info('No overdue rent found for manual collection');
      return { processedCount: 0, errorCount: 0 };
    }
    
    logger.info(`Manually processing rent for ${overdueProperties.length} overdue properties`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const property of overdueProperties) {
      try {
        await processOverdueRent(property as OverdueProperty);
        processedCount++;
      } catch (error: any) {
        errorCount++;
        logger.error('Error processing property rent in manual collection', {
          propertyId: property._id.toString(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    logger.info('Manual rent collection completed', {
      totalProperties: overdueProperties.length,
      processedCount,
      errorCount
    });
    
    return { processedCount, errorCount };
    
  } catch (error: any) {
    logger.error('Manual rent collection failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    return { processedCount: 0, errorCount: 1 };
  }
}

export { startRentCollectionCron };