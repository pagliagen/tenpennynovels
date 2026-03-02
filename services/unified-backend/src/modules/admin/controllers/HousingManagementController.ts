import { Request, Response } from 'express';
import { HousingProperty, EstateTransaction, Location, CharacterFinances, db } from '@database/models';
import { logger } from '../utils/logger';
import { listResponse, successResponse, errorResponse, createResponse, updateResponse, deleteResponse, getRequestId } from '../utils/apiResponse';

// Access mongoose from the centralized connection
const mongoose = db.getMongoose();

export class HousingManagementController {
  
  /**
   * Get all properties with admin overview
   * GET /admin/housing/properties
   */
  static async getAllProperties(req: Request, res: Response): Promise<void> {
    try {
      const { 
        page = 1, 
        pageSize = 25, 
        district, 
        propertyType, 
        ownershipType, 
        isAvailable,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      // Build filter
      let filter: any = {};
      if (district) filter.district = district;
      if (propertyType) filter.propertyType = propertyType;
      if (ownershipType) filter.ownershipType = ownershipType;
      if (isAvailable !== undefined) filter.isAvailable = isAvailable === 'true';

      // Calculate pagination
      const skip = (Number(page) - 1) * Number(pageSize);
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Get properties with population
      const properties = await HousingProperty.find(filter)
        .populate('locationId', 'name description')
        .populate('currentTenantId', 'name')
        .populate('ownerId', 'name')
        .sort(sort)
        .skip(skip)
        .limit(Number(pageSize));

      // Get total count for pagination
      const totalProperties = await HousingProperty.countDocuments(filter);

      // Calculate pagination info
      const totalPages = Math.ceil(totalProperties / Number(pageSize));
      const hasMore = Number(page) < totalPages;

      const pagination = {
        currentPage: Number(page),
        totalPages,
        totalItems: totalProperties,
        limit: Number(pageSize),
        hasMore
      };

      res.json(listResponse(
        properties,
        pagination,
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Error fetching all properties:', error);
      res.status(500).json(errorResponse(
        'Impossibile recuperare le proprietà',
        'PROPERTIES_FETCH_FAILED',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Create new property
   * POST /admin/housing/properties
   */
  static async createProperty(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        description,
        district,
        propertyType,
        ownershipType = 'available',
        monthlyRent,
        purchasePrice,
        monthlyMaintenance = 0,
        deposit,
        features = {},
        condition = 'fair',
        socialClassRestriction,
        minimumIncome,
        address
      } = req.body;

      // Try to use transactions if available, fallback to regular operations for development
      let property, location;
      let session: any;
      
      try {
        session = await mongoose.startSession();
        
        const result = await session.withTransaction(async () => {
          return await createPropertyWithSession(session);
        });
        
        property = result!.property;
        location = result!.location;
        
      } catch (transactionError: any) {
        if (transactionError.message?.includes('Transaction numbers are only allowed on a replica set member or mongos')) {
          logger.warn('MongoDB transactions not supported, using regular operations');
          const result = await createPropertyWithSession(null);
          property = result!.property;
          location = result!.location;
        } else {
          throw transactionError;
        }
      } finally {
        session?.endSession();
      }

      async function createPropertyWithSession(session: any) {
        // First create the Location
        const location = new Location({
          name,
          slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          description,
          district,
          locationLevel: 'location',
          settings: {
            visible: false, // Housing properties are not publicly visible
            chat: true,
            shop: false,
            private: true // Always private
          },
          createdBy: req.user!.userId
        });

        await location.save(session ? { session } : {});

        // Then create the HousingProperty
        const property = new HousingProperty({
          locationId: location._id,
          propertyType,
          district,
          address,
          ownershipType,
          monthlyRent,
          purchasePrice,
          monthlyMaintenance,
          deposit,
          features: {
            furnished: features.furnished || false,
            hasKitchen: features.hasKitchen || false,
            hasPrivateBathroom: features.hasPrivateBathroom || false,
            hasGarden: features.hasGarden || false,
            hasBalcony: features.hasBalcony || false,
            fireplace: features.fireplace || false,
            gaslighting: features.gaslighting || false,
            waterSupply: features.waterSupply || 'none',
            roomCount: features.roomCount || 1
          },
          condition,
          isAvailable: ownershipType === 'available' || ownershipType === 'rental',
          socialClassRestriction,
          minimumIncome
        });

        await property.save(session ? { session } : {});

        // Audit log creation
        logger.info('Property created by admin', {
          propertyId: property._id,
          locationId: location._id,
          adminUserId: req.user!.userId,
          propertyType,
          district
        });

        return { property, location };
      }
      
      res.json(createResponse(
        {
          property: property.toJSON(),
          location: location.toJSON()
        },
        'Property created successfully',
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Property creation failed:', error);
      res.status(400).json(errorResponse(
        error instanceof Error ? error.message : 'Creazione proprietà fallita',
        'PROPERTY_CREATION_FAILED',
        undefined,
        400,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update property
   * PUT /admin/housing/properties/:propertyId
   */
  static async updateProperty(req: Request<{ propertyId: string }>, res: Response): Promise<void> {
    try {
      const { propertyId } = req.params;
      const updates = req.body;

      const property = await HousingProperty.findById(propertyId);
      if (!property) {
        res.status(404).json(errorResponse(
          'Proprietà non trovata',
          'PROPERTY_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Update allowed fields
      const allowedUpdates = [
        'monthlyRent', 'purchasePrice', 'monthlyMaintenance', 'deposit',
        'condition', 'isAvailable', 'socialClassRestriction', 'minimumIncome',
        'address', 'features'
      ];

      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          (property as any)[field] = updates[field];
        }
      });

      await property.save();

      // Audit log update
      logger.info('Property updated by admin', {
        propertyId,
        adminUserId: req.user!.userId,
        updates: Object.keys(updates)
      });

      res.json(updateResponse(
        { property: property.toJSON() },
        'Property updated successfully',
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Property update failed:', error);
      res.status(400).json(errorResponse(
        error instanceof Error ? error.message : 'Aggiornamento proprietà fallito',
        'PROPERTY_UPDATE_FAILED',
        undefined,
        400,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete property
   * DELETE /admin/housing/properties/:propertyId
   */
  static async deleteProperty(req: Request<{ propertyId: string }>, res: Response): Promise<void> {
    try {
      const { propertyId } = req.params;

      const property = await HousingProperty.findById(propertyId);
      if (!property) {
        res.status(404).json(errorResponse(
          'Proprietà non trovata',
          'PROPERTY_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if property has active tenant or owner
      if (property.currentTenantId || property.ownerId) {
        res.status(400).json(errorResponse(
          'Non è possibile eliminare la proprietà con inquilino o proprietario attivo',
          'PROPERTY_IN_USE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Soft delete by setting availability to false and adding deleted flag
      property.isAvailable = false;
      property.ownershipType = 'available';
      await property.save();

      // Also update the associated location
      if (property.locationId) {
        await Location.findByIdAndUpdate(property.locationId, {
          settings: { visible: false, chat: false, shop: false, private: true }
        });
      }

      // Audit log deletion
      logger.info('Property deleted by admin', {
        propertyId,
        adminUserId: req.user!.userId,
        district: property.district,
        propertyType: property.propertyType
      });

      res.json(deleteResponse(
        'Property deleted successfully',
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Property deletion failed:', error);
      res.status(500).json(errorResponse(
        'Impossibile eliminare la proprietà',
        'PROPERTY_DELETION_FAILED',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Mass rent adjustments
   * PUT /admin/housing/rent-adjustments
   */
  static async adjustRents(req: Request, res: Response): Promise<void> {
    try {
      const { 
        adjustment, // { type: 'percentage' | 'fixed', value: number }
        filters // { district?, propertyType?, ownershipType? }
      } = req.body;

      if (!adjustment || (!adjustment.value && adjustment.value !== 0)) {
        res.status(400).json(errorResponse(
          'Parametri di adeguamento richiesti',
          'INVALID_ADJUSTMENT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Build filter for properties to adjust
      let filter: any = { monthlyRent: { $exists: true, $gt: 0 } };
      if (filters.district) filter.district = filters.district;
      if (filters.propertyType) filter.propertyType = filters.propertyType;
      if (filters.ownershipType) filter.ownershipType = filters.ownershipType;

      const properties = await HousingProperty.find(filter);
      
      if (properties.length === 0) {
        res.status(404).json(errorResponse(
          'Nessuna proprietà trovata corrispondente ai criteri',
          'NO_PROPERTIES_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      let updatedCount = 0;
      const adjustmentResults = [];

      for (const property of properties) {
        const oldRent = property.monthlyRent || 0;
        let newRent = oldRent;

        if (adjustment.type === 'percentage') {
          newRent = Math.round(oldRent * (1 + adjustment.value / 100));
        } else if (adjustment.type === 'fixed') {
          newRent = Math.max(0, oldRent + adjustment.value);
        }

        if (newRent !== oldRent) {
          property.monthlyRent = newRent;
          await property.save();
          
          adjustmentResults.push({
            propertyId: property._id,
            district: property.district,
            propertyType: property.propertyType,
            oldRent,
            newRent
          });
          
          updatedCount++;
        }
      }

      // Audit log mass adjustment
      logger.info('Mass rent adjustment by admin', {
        adminUserId: req.user!.userId,
        adjustment,
        filters,
        updatedCount,
        totalProperties: properties.length
      });

      res.json(updateResponse(
        {
          updatedCount,
          totalProperties: properties.length,
          adjustments: adjustmentResults
        },
        `Rent adjusted for ${updatedCount} properties`,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Mass rent adjustment failed:', error);
      res.status(500).json(errorResponse(
        'Impossibile adeguare gli affitti',
        'RENT_ADJUSTMENT_FAILED',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Process evictions
   * POST /admin/housing/evictions
   */
  static async processEvictions(req: Request, res: Response): Promise<void> {
    try {
      const { gracePeriodDays = 14, dryRun = false } = req.body;

      // Find properties with overdue rent
      const cutoffDate = new Date(Date.now() - gracePeriodDays * 24 * 60 * 60 * 1000);
      
      const overdueProperties = await HousingProperty.find({
        ownershipType: 'rental',
        currentTenantId: { $exists: true },
        rentPaidUntil: { $lt: cutoffDate }
      }).populate('currentTenantId', 'name')
        .populate('locationId', 'name');

      if (overdueProperties.length === 0) {
        res.json(successResponse(
          { evictedCount: 0, properties: [] },
          'No properties require eviction',
          getRequestId(req)
        ));
        return;
      }

      const evictionResults = [];

      if (!dryRun) {
        for (const property of overdueProperties) {
          try {
            const tenantId = property.currentTenantId;
            
            // Record eviction transaction
            const evictionTransaction = new EstateTransaction({
              transactionType: 'eviction_fee',
              propertyId: property._id,
              characterId: tenantId,
              amount: property.monthlyRent || 0,
              description: `Eviction from ${property.district} property for non-payment`,
              status: 'completed'
            });
            await evictionTransaction.save();

            // Add to rental history
            property.addToRentalHistory(
              tenantId!,
              property.leaseStart!,
              property.monthlyRent || 0,
              'eviction',
              new Date(),
              `Evicted for non-payment after ${gracePeriodDays} day grace period`
            );

            // Clear tenancy
            property.currentTenantId = undefined;
            property.ownershipType = 'rental';
            property.isAvailable = true;
            property.leaseStart = undefined;
            property.leaseEnd = undefined;
            property.rentPaidUntil = undefined;
            property.lastRentPayment = undefined;

            await property.save();

            // Update Location ownership
            if (property.locationId) {
              const location = await Location.findById(property.locationId);
              if (location) {
                location.access = { characterAccess: [], corporationAccess: [] };
                location.settings.private = false;
                await location.save();
              }
            }

            evictionResults.push({
              propertyId: property._id,
              tenantName: (property.currentTenantId as any)?.name,
              district: property.district,
              daysOverdue: Math.floor((Date.now() - property.rentPaidUntil!.getTime()) / (1000 * 60 * 60 * 24))
            });

          } catch (error: any) {
            logger.error('Individual eviction failed:', {
              propertyId: property._id,
              tenantId: property.currentTenantId,
              error
            });
          }
        }
      } else {
        // Dry run - just return what would be evicted
        overdueProperties.forEach(property => {
          evictionResults.push({
            propertyId: property._id,
            tenantName: (property.currentTenantId as any)?.name,
            district: property.district,
            daysOverdue: Math.floor((Date.now() - property.rentPaidUntil!.getTime()) / (1000 * 60 * 60 * 24))
          });
        });
      }

      // Audit log evictions
      logger.info(`${dryRun ? 'Eviction dry run' : 'Evictions processed'} by admin`, {
        adminUserId: req.user!.userId,
        gracePeriodDays,
        evictedCount: evictionResults.length,
        dryRun
      });

      res.json(updateResponse(
        {
          evictedCount: evictionResults.length,
          properties: evictionResults,
          dryRun
        },
        `${dryRun ? 'Eviction preview:' : 'Evictions processed:'} ${evictionResults.length} properties`,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Eviction processing failed:', error);
      res.status(500).json(errorResponse(
        'Impossibile elaborare gli sfratti',
        'EVICTION_PROCESSING_FAILED',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Housing market reports
   * GET /admin/housing/reports
   */
  static async getHousingReports(req: Request, res: Response): Promise<void> {
    try {
      const { reportType = 'overview', district, period = 'month' } = req.query;

      const reports: any = {};

      if (reportType === 'overview' || reportType === 'all') {
        // Occupancy rates by district
        const occupancyReport = await HousingProperty.aggregate([
          {
            $group: {
              _id: '$district',
              totalProperties: { $sum: 1 },
              occupiedProperties: {
                $sum: { $cond: [{ $ne: ['$currentTenantId', null] }, 1, 0] }
              },
              averageRent: { $avg: '$monthlyRent' }
            }
          },
          {
            $addFields: {
              occupancyRate: {
                $multiply: [
                  { $divide: ['$occupiedProperties', '$totalProperties'] },
                  100
                ]
              }
            }
          },
          { $sort: { _id: 1 } }
        ]);

        reports.occupancyByDistrict = occupancyReport;
      }

      if (reportType === 'financial' || reportType === 'all') {
        // Revenue analytics
        const startDate = new Date();
        if (period === 'month') {
          startDate.setMonth(startDate.getMonth() - 1);
        } else if (period === 'quarter') {
          startDate.setMonth(startDate.getMonth() - 3);
        } else if (period === 'year') {
          startDate.setFullYear(startDate.getFullYear() - 1);
        }

        const revenueReport = await EstateTransaction.aggregate([
          {
            $match: {
              transactionDate: { $gte: startDate },
              status: 'completed',
              transactionType: { $in: ['rental_payment', 'rent_deposit', 'purchase'] }
            }
          },
          {
            $group: {
              _id: '$transactionType',
              totalRevenue: { $sum: '$amount' },
              transactionCount: { $sum: 1 }
            }
          }
        ]);

        reports.revenue = {
          period,
          startDate,
          transactions: revenueReport
        };
      }

      if (reportType === 'market' || reportType === 'all') {
        // Market statistics
        const marketStats = await HousingProperty.aggregate([
          {
            $group: {
              _id: '$propertyType',
              count: { $sum: 1 },
              averageRent: { $avg: '$monthlyRent' },
              averagePurchasePrice: { $avg: '$purchasePrice' },
              availableCount: {
                $sum: { $cond: ['$isAvailable', 1, 0] }
              }
            }
          },
          { $sort: { _id: 1 } }
        ]);

        reports.marketStatistics = marketStats;
      }

      res.json(successResponse(
        {
          reportType,
          generatedAt: new Date(),
          ...reports
        },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Housing reports generation failed:', error);
      res.status(500).json(errorResponse(
        'Impossibile generare report immobiliari',
        'REPORTS_GENERATION_FAILED',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get housing statistics
   * GET /admin/housing/stats
   */
  static async getHousingStats(req: Request, res: Response): Promise<void> {
    try {
      // Overall statistics
      const totalProperties = await HousingProperty.countDocuments();
      const occupiedProperties = await HousingProperty.countDocuments({ 
        currentTenantId: { $exists: true } 
      });
      const ownedProperties = await HousingProperty.countDocuments({ 
        ownershipType: 'owned' 
      });
      const availableProperties = await HousingProperty.countDocuments({ 
        isAvailable: true 
      });

      // Rent statistics
      const rentStats = await HousingProperty.aggregate([
        { $match: { monthlyRent: { $exists: true, $gt: 0 } } },
        {
          $group: {
            _id: null,
            averageRent: { $avg: '$monthlyRent' },
            minRent: { $min: '$monthlyRent' },
            maxRent: { $max: '$monthlyRent' },
            totalRentableValue: { $sum: '$monthlyRent' }
          }
        }
      ]);

      // Overdue rent count
      const overdueCount = await HousingProperty.countDocuments({
        ownershipType: 'rental',
        currentTenantId: { $exists: true },
        rentPaidUntil: { $lt: new Date() }
      });

      // Recent transactions
      const recentTransactions = await EstateTransaction.find()
        .sort({ transactionDate: -1 })
        .limit(10)
        .populate('characterId', 'name')
        .populate('propertyId', 'district propertyType');

      res.json(successResponse(
        {
          overview: {
            totalProperties,
            occupiedProperties,
            ownedProperties,
            availableProperties,
            occupancyRate: totalProperties > 0 ? (occupiedProperties / totalProperties * 100) : 0,
            overdueRentCount: overdueCount
          },
          rentStatistics: rentStats[0] || {
            averageRent: 0,
            minRent: 0,
            maxRent: 0,
            totalRentableValue: 0
          },
          recentTransactions
        },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Housing stats fetch failed:', error);
      res.status(500).json(errorResponse(
        'Impossibile recuperare le statistiche immobiliari',
        'STATS_FETCH_FAILED',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Trigger manual rent collection (for testing and admin use)
   * POST /admin/housing/rent-collection
   */
  static async triggerRentCollection(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Manual rent collection triggered by admin', {
        adminId: req.user!.userId,
        adminUsername: req.user!.username
      });

      // Import and call the rent collection function
      const { triggerRentCollection } = await import('@modules/game/cron/rentCollection');
      const result = await triggerRentCollection();

      res.json(updateResponse(
        {
          processedCount: result.processedCount,
          errorCount: result.errorCount,
          timestamp: new Date().toISOString()
        },
        'Rent collection completed successfully',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Manual rent collection failed:', error);
      res.status(500).json(errorResponse(
        error instanceof Error ? error.message : 'Riscossione affitto fallita',
        'RENT_COLLECTION_FAILED',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get district information
   * GET /admin/housing/districts
   */
  static async getDistricts(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Fetching district information for management');

      // Get district statistics
      const districtStats = await HousingProperty.aggregate([
        {
          $group: {
            _id: '$district',
            totalProperties: { $sum: 1 },
            availableProperties: {
              $sum: { $cond: [{ $eq: ['$ownershipType', 'available'] }, 1, 0] }
            },
            averageRent: { $avg: '$monthlyRent' },
            averagePurchasePrice: { $avg: '$purchasePrice' }
          }
        },
        {
          $project: {
            name: '$_id',
            totalProperties: 1,
            availableProperties: 1,
            averageRent: { $round: ['$averageRent', 2] },
            averagePurchasePrice: { $round: ['$averagePurchasePrice', 2] },
            _id: 0
          }
        },
        { $sort: { name: 1 } }
      ]);

      res.json(successResponse(
        {
          districts: districtStats
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('District fetch failed:', error);
      res.status(500).json(errorResponse(
        'Impossibile recuperare le informazioni del distretto',
        'DISTRICTS_FETCH_FAILED',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}