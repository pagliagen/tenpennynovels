import { Request, Response } from 'express';
import { HousingProperty, EstateTransaction, CharacterFinances, Location, db } from '@database/models';
import { logger } from '../utils/logger';
import { successResponse, errorResponse, createResponse, getRequestId } from '../utils/apiResponse';

// Access mongoose from the centralized connection
const mongoose = db.getMongoose();

export class HousingController {
  
  /**
   * Get available properties in district
   * GET /game/housing/available/:district
   */
  static async getAvailableProperties(req: Request<{ district: string }>, res: Response): Promise<void> {
    try {
      const { district } = req.params;
      
      // For now, return static test data to verify routing
      const properties = district === 'Whitechapel' ? [
        {
          _id: '507f1f77bcf86cd799439011',
          district: 'Whitechapel',
          propertyType: 'basic_room',
          ownershipType: 'rental',
          monthlyRent: 25,
          deposit: 25,
          features: {
            furnished: false,
            hasKitchen: false,
            hasPrivateBathroom: false,
            roomCount: 1
          },
          affordability: {
            canAfford: true,
            monthlyCashFlow: true,
            depositRequired: 25
          }
        }
      ] : [
        {
          _id: '507f1f77bcf86cd799439012',
          district: 'Mayfair',
          propertyType: 'luxury_suite',
          ownershipType: 'rental',
          monthlyRent: 150,
          deposit: 150,
          features: {
            furnished: true,
            hasKitchen: true,
            hasPrivateBathroom: true,
            roomCount: 3
          },
          affordability: {
            canAfford: false,
            monthlyCashFlow: false,
            depositRequired: 150
          }
        }
      ];
      
      res.json(successResponse(
        {
          properties,
          characterFinances: {
            availableFunds: 100,
            monthlyCreditLine: 50
          }
        },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Error fetching available properties:', error);
      res.status(500).json(errorResponse(
        'Impossibile recuperare le proprietà disponibili',
        'PROPERTIES_FETCH_FAILED',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get all districts with property counts
   * GET /game/housing/districts
   */
  static async getDistricts(req: Request, res: Response): Promise<void> {
    try {
      // For now, return static test data to verify routing
      const districts = [
        {
          _id: 'Whitechapel',
          totalProperties: 15,
          averageRent: 25,
          propertyTypes: ['basic_room', 'furnished_room']
        },
        {
          _id: 'Mayfair', 
          totalProperties: 8,
          averageRent: 150,
          propertyTypes: ['luxury_suite', 'mansion']
        }
      ];

      res.json(successResponse(
        { districts },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Error fetching districts:', error);
      res.status(500).json(errorResponse(
        'Impossibile recuperare i distretti',
        'DISTRICTS_FETCH_FAILED',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Rent apartment/property
   * POST /game/housing/rent
   */
  static async rentProperty(req: Request, res: Response): Promise<void> {
    const { propertyId, leaseDuration = 12 } = req.body; // leaseDuration in months
    const characterId = req.character!.characterId;
    
    try {
      // Start transaction
      const session = await mongoose.startSession();
      
      await session.withTransaction(async () => {
        // Get property and validate availability
        const property = await HousingProperty.findById(propertyId).session(session);
        if (!property || !property.isAvailable) {
          throw new Error('Property not available');
        }
        
        // Get character finances
        const finances = await CharacterFinances.findOne({ characterId }).session(session);
        if (!finances) {
          throw new Error('Character finances not found');
        }
        
        // Calculate costs
        const firstMonthRent = property.monthlyRent || 0;
        const deposit = property.deposit || property.monthlyRent || 0;
        const totalUpfront = firstMonthRent + deposit;
        
        // Check affordability
        const availableFunds = finances.cash + finances.bankDeposit;
        if (availableFunds < totalUpfront) {
          throw new Error('Insufficient funds for rental');
        }
        
        // Process payment
        await HousingController.processRentalPayment(finances, totalUpfront, 'rental_start', session);
        
        // Update property
        const leaseStart = new Date();
        const leaseEnd = new Date(leaseStart.getTime() + (leaseDuration * 30 * 24 * 60 * 60 * 1000));
        
        property.currentTenantId = new mongoose.Types.ObjectId(characterId);
        property.ownershipType = 'rental';
        property.isAvailable = false;
        property.leaseStart = leaseStart;
        property.leaseEnd = leaseEnd;
        property.rentPaidUntil = new Date(leaseStart.getTime() + (30 * 24 * 60 * 60 * 1000)); // First month
        property.lastRentPayment = new Date();
        
        await property.save({ session });
        
        // Update Location ownership
        const location = await Location.findById(property.locationId).session(session);
        
        if (location) {
          // Set character as owner of the location
          if (!location.access) {
            location.access = { characterAccess: [], corporationAccess: [] };
          }
          location.access.ownerId = new mongoose.Types.ObjectId(characterId);
          location.access.ownerType = 'character';
          location.settings.private = true;
          
          await location.save({ session });
        }
        
        // Record transaction
        const transaction = new EstateTransaction({
          transactionType: 'rent_deposit',
          propertyId,
          characterId,
          amount: totalUpfront,
          currency: 'pence',
          paymentMethod: 'bank_transfer',
          paymentSource: 'character_deposit',
          transactionDate: new Date(),
          description: `Rental deposit and first month for ${property.district} property`,
          status: 'completed',
          rentalPeriod: {
            startDate: leaseStart,
            endDate: leaseEnd
          }
        });
        
        await transaction.save({ session });
        
        // Add to rental history
        property.rentalHistory.push({
          tenantId: new mongoose.Types.ObjectId(characterId),
          startDate: leaseStart,
          finalRent: property.monthlyRent || 0,
          reason: 'lease_end' // Will be updated when lease actually ends
        });
      });
      
      session.endSession();
      
      logger.info('Property rental completed', {
        characterId,
        propertyId,
        leaseDuration
      });
      
      res.json(createResponse(
        { propertyId, leaseDuration },
        'Affitto proprietà completato con successo',
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Property rental failed', {
        characterId,
        propertyId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(400).json(errorResponse(
        error instanceof Error ? error.message : 'Rental failed',
        'RENTAL_FAILED',
        undefined,
        400,
        getRequestId(req)
      ));
    }
  }

  /**
   * Purchase property
   * POST /game/housing/purchase
   */
  static async purchaseProperty(req: Request, res: Response): Promise<void> {
    const { propertyId } = req.body;
    const characterId = req.character!.characterId;
    
    try {
      const session = await mongoose.startSession();
      
      await session.withTransaction(async () => {
        // Get property and validate availability
        const property = await HousingProperty.findById(propertyId).session(session);
        if (!property || !property.isAvailable || !property.purchasePrice) {
          throw new Error('Property not available for purchase');
        }
        
        // Get character finances
        const finances = await CharacterFinances.findOne({ characterId }).session(session);
        if (!finances) {
          throw new Error('Character finances not found');
        }
        
        const purchasePrice = property.purchasePrice;
        const availableFunds = finances.cash + finances.bankDeposit;
        
        if (availableFunds < purchasePrice) {
          throw new Error('Insufficient funds for purchase');
        }
        
        // Process payment
        await HousingController.processRentalPayment(finances, purchasePrice, 'purchase', session);
        
        // Update property
        property.ownerId = new mongoose.Types.ObjectId(characterId);
        property.ownershipType = 'owned';
        property.isAvailable = false;
        property.currentTenantId = undefined;
        
        await property.save({ session });
        
        // Update Location ownership
        const location = await Location.findById(property.locationId).session(session);
        if (location) {
          if (!location.access) {
            location.access = { characterAccess: [], corporationAccess: [] };
          }
          location.access.ownerId = new mongoose.Types.ObjectId(characterId);
          location.access.ownerType = 'character';
          location.settings.private = true;
          
          await location.save({ session });
        }
        
        // Record transaction
        await (EstateTransaction as any).createPurchase(
          propertyId,
          new mongoose.Types.ObjectId(characterId),
          purchasePrice,
          `Purchase of ${property.district} property`
        );
        
        // Add to ownership history
        property.addToOwnershipHistory(
          new mongoose.Types.ObjectId(characterId),
          new Date(),
          purchasePrice,
          'purchase'
        );
      });
      
      session.endSession();
      
      res.json(createResponse(
        { propertyId },
        'Proprietà acquistata con successo',
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Property purchase failed', {
        characterId,
        propertyId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      res.status(400).json(errorResponse(
        error instanceof Error ? error.message : 'Purchase failed',
        'PURCHASE_FAILED',
        undefined,
        400,
        getRequestId(req)
      ));
    }
  }

  /**
   * Pay monthly rent
   * POST /game/housing/:propertyId/pay-rent
   */
  static async payRent(req: Request<{ propertyId: string }>, res: Response): Promise<void> {
    const { propertyId } = req.params;
    const characterId = req.character!.characterId;
    const { monthsAdvance = 1 } = req.body;
    
    try {
      // Get property and validate tenancy
      const property = await HousingProperty.findOne({
        _id: propertyId,
        currentTenantId: characterId
      });
      
      if (!property) {
        res.status(404).json(errorResponse(
          'Proprietà non trovata o non sei l\'inquilino',
          'PROPERTY_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }
      
      // Calculate rent amount
      const totalRent = (property.monthlyRent || 0) * monthsAdvance;
      
      // Get character finances and process payment
      const finances = await CharacterFinances.findOne({ characterId });
      if (!finances) {
        res.status(404).json(errorResponse(
          'Finanze del personaggio non trovate',
          'FINANCES_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }
      
      // Check affordability (cash + credit line)
      const availableFunds = finances.cash + finances.creditLine.currentAvailable;
      if (availableFunds < totalRent) {
        res.status(400).json(errorResponse(
          'Fondi insufficienti per pagare l\'affitto',
          'INSUFFICIENT_FUNDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }
      
      // Process payment
      await HousingController.processRentalPayment(finances, totalRent, 'rent_payment');
      
      // Update rent paid until date
      const currentPaidUntil = property.rentPaidUntil || new Date();
      const newPaidUntil = new Date(currentPaidUntil.getTime() + (monthsAdvance * 30 * 24 * 60 * 60 * 1000));
      
      property.rentPaidUntil = newPaidUntil;
      property.lastRentPayment = new Date();
      await property.save();
      
      // Record transaction
      await (EstateTransaction as any).createRentPayment(
        new mongoose.Types.ObjectId(propertyId),
        new mongoose.Types.ObjectId(characterId),
        totalRent,
        {
          startDate: currentPaidUntil,
          endDate: newPaidUntil
        },
        `Rent payment for ${monthsAdvance} month(s)`
      );
      
      res.json(successResponse(
        {
          amountPaid: totalRent,
          rentPaidUntil: newPaidUntil,
          remainingBalance: finances.cash
        },
        'Pagamento affitto effettuato con successo',
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Rent payment failed:', error);
      res.status(500).json(errorResponse(
        'Impossibile elaborare il pagamento dell\'affitto',
        'RENT_PAYMENT_FAILED',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Manage property guests
   * PUT /game/housing/:propertyId/guests
   */
  static async manageGuests(req: Request<{ propertyId: string }>, res: Response): Promise<void> {
    const { propertyId } = req.params;
    const { action, guestCharacterId, permissions, duration } = req.body;
    const characterId = req.character!.characterId;
    
    try {
      // Validate property ownership/tenancy
      const property = await HousingProperty.findOne({
        _id: propertyId,
        $or: [
          { currentTenantId: characterId },
          { ownerId: characterId }
        ]
      });
      
      if (!property) {
        res.status(404).json(errorResponse(
          'Proprietà non trovata o permessi insufficienti',
          'PROPERTY_ACCESS_DENIED',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }
      
      if (action === 'grant') {
        // Grant guest access
        const expiresAt = duration === 'temporary' ? 
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : // 7 days
          undefined;
        
        property.grantGuestAccess(
          new mongoose.Types.ObjectId(guestCharacterId),
          permissions || ['view'],
          duration || 'temporary'
        );
        
        // Also update Location access
        const location = await Location.findById(property.locationId);
        
        if (location) {
          location.grantCharacterAccess(
            new mongoose.Types.ObjectId(guestCharacterId),
            permissions || ['view'],
            new mongoose.Types.ObjectId(characterId),
            duration || 'temporary',
            expiresAt
          );
          await location.save();
        }
        
      } else if (action === 'revoke') {
        // Revoke guest access
        property.revokeGuestAccess(new mongoose.Types.ObjectId(guestCharacterId));
        
        // Also revoke Location access
        const location = await Location.findById(property.locationId);
        
        if (location) {
          location.revokeCharacterAccess(new mongoose.Types.ObjectId(guestCharacterId));
          await location.save();
        }
      }
      
      await property.save();
      
      res.json(successResponse(
        { guestAccess: property.guestAccess },
        `Accesso ospite ${action === 'grant' ? 'concesso' : 'revocato'} con successo`,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Guest management failed:', error);
      res.status(500).json(errorResponse(
        'Impossibile gestire l\'accesso ospite',
        'GUEST_MANAGEMENT_FAILED',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get character's properties
   * GET /game/housing/my-properties
   */
  static async getMyProperties(req: Request, res: Response): Promise<void> {
    const characterId = req.character!.characterId;
    
    try {
      const properties = await HousingProperty.find({
        $or: [
          { currentTenantId: characterId },
          { ownerId: characterId }
        ]
      }).populate('locationId', 'name description');
      
      // Add rent status information
      const propertiesWithStatus = properties.map(property => {
        const propertyObj = property.toJSON();
        
        // If locationId is not populated, add fallback
        if (!propertyObj.locationId || !propertyObj.locationId.name) {
          propertyObj.locationId = {
            name: propertyObj.district || 'Unknown Location',
            description: 'Location details unavailable'
          };
        }
        
        return {
          ...propertyObj,
          rentStatus: property.ownershipType === 'rental' ? {
            isOverdue: property.isRentOverdue(),
            daysOverdue: property.getDaysOverdue(),
            nextPaymentDue: property.rentPaidUntil
          } : null
        };
      });
      
      res.json(successResponse(
        { properties: propertiesWithStatus },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Error fetching character properties:', error);
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
   * Get property details
   * GET /game/housing/:propertyId
   */
  static async getPropertyDetails(req: Request<{ propertyId: string }>, res: Response): Promise<void> {
    const { propertyId } = req.params;
    const characterId = req.character!.characterId;
    
    try {
      const property = await HousingProperty.findById(propertyId)
        .populate('locationId', 'name description')
        .populate('currentTenantId', 'name')
        .populate('ownerId', 'name');
      
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
      
      // Check if character has access to view this property
      const hasAccess = property.isAvailable ||
                       property.currentTenantId?.equals(characterId) ||
                       property.ownerId?.equals(characterId) ||
                       property.guestAccess.some((g: any) => g.characterId.equals(characterId));
      
      if (!hasAccess) {
        res.status(403).json(errorResponse(
          'Accesso negato a questa proprietà',
          'PROPERTY_ACCESS_DENIED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }
      
      // Get recent transactions if user is tenant/owner
      let transactions = [];
      if (property.currentTenantId?.equals(characterId) || property.ownerId?.equals(characterId)) {
        transactions = await (EstateTransaction as any).findByProperty(new mongoose.Types.ObjectId(propertyId), 10);
      }
      
      res.json(successResponse(
        { 
          property: property.toJSON(),
          transactions,
          rentStatus: property.ownershipType === 'rental' ? {
            isOverdue: property.isRentOverdue(),
            daysOverdue: property.getDaysOverdue(),
            nextPaymentDue: property.rentPaidUntil
          } : null
        },
        undefined,
        getRequestId(req)
      ));
      
    } catch (error: any) {
      logger.error('Error fetching property details:', error);
      res.status(500).json(errorResponse(
        'Impossibile recuperare i dettagli della proprietà',
        'PROPERTY_DETAILS_FETCH_FAILED',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  // Helper method for payment processing
  private static async processRentalPayment(
    finances: any, 
    amount: number, 
    type: 'rental_start' | 'rent_payment' | 'purchase',
    session?: any
  ): Promise<void> {
    // Determine payment source priority: cash first, then bank, then credit
    let remaining = amount;
    
    // Use cash first
    if (finances.cash >= remaining) {
      finances.cash -= remaining;
      remaining = 0;
    } else if (finances.cash > 0) {
      remaining -= finances.cash;
      finances.cash = 0;
    }
    
    // Use bank deposit
    if (remaining > 0 && finances.bankDeposit >= remaining) {
      finances.bankDeposit -= remaining;
      remaining = 0;
    } else if (remaining > 0 && finances.bankDeposit > 0) {
      remaining -= finances.bankDeposit;
      finances.bankDeposit = 0;
    }
    
    // Use credit line if needed
    if (remaining > 0) {
      if (finances.creditLine.currentAvailable >= remaining) {
        finances.creditLine.currentAvailable -= remaining;
        remaining = 0;
      } else {
        throw new Error('Insufficient funds including credit line');
      }
    }
    
    await finances.save({ session });
  }
}