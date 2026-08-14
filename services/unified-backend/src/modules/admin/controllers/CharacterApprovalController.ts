import { Request, Response } from 'express';
import type { SocialClass } from '@shared/types/socialClass';
import {
  ApiResponse,
  PendingCharacter,
  CharacterReview,
  CharacterStats,
  ValidationChecks,
  ReviewStats,
  PaginationInfo
} from '../types/management';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { redis } from '@config/runtime/redis';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '@shared/utils/apiResponse';


export class CharacterApprovalController {
  /**
   * Get all characters with pagination and optional filtering
   * GET /admin/characters
   */
  static async getAllCharacters(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 25;
      const statusFilter = req.query.status as string;
      const userId = req.query.userId as string;
      const characterType = req.query.characterType as string;

      const skip = (page - 1) * pageSize;

      // Build query filter
      let filter: any = {};
      if (statusFilter && ['draft', 'pending', 'approved'].includes(statusFilter)) {
        filter.playerStatus = statusFilter;
      }
      if (userId) {
        filter.userId = userId;
      }
      if (characterType === 'bot') {
        filter.isBot = true;
      } else if (characterType && ['pg_principale', 'pg_master', 'png'].includes(characterType)) {
        filter.characterType = characterType;
        filter.isBot = { $ne: true };
      }

      // Use local model with proper imports
      const { Character } = await import('@database/models/Character');
      
      // Get total count for pagination with error handling
      let totalItems;
      try {
        totalItems = await Character.countDocuments(filter);
      } catch (countError) {
        logger.error('Error counting characters:', { error: countError instanceof Error ? countError.message : String(countError), filter });  
        throw new Error('Impossibile contare i personaggi');
      }
      
      // Get paginated characters with populated user data and stats
      let characters;
      try {
        characters = await Character.find(filter)
          .populate({
            path: 'userId',
            select: 'username email',
            options: { strictPopulate: false }
          })
          .populate({
            path: 'referentCharacterId',
            select: 'name',
            options: { strictPopulate: false }
          })
          .populate({
            path: 'currentLocation',
            select: 'name slug',
            options: { strictPopulate: false }
          })
          .select('name surname fullName occupation playerStatus createdAt submittedAt approvedAt rejectedAt userId canAccessAdminPanel isGestore gameplayRoles characterPermissions adminPermissions age gender socialClass location characterType referentCharacterId avatar isBot currentLocation')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .lean()
          .exec();
      } catch (findError) {
        logger.error('Error fetching characters from database:', { error: findError instanceof Error ? findError.message : String(findError), filter, skip, pageSize });
        throw new Error('Impossibile recuperare i personaggi dal database');
      }

      // Transform data to match frontend expectations with safe property access
      const transformedCharacters = characters.map((char: any) => {
        // Safe access to user data
        const userData = char.userId || {};
        const userIdString = userData._id ? userData._id.toString() :
                            (typeof char.userId === 'string' ? char.userId : 'unknown');
        const username = userData.username || 'Unknown User';
        const email = userData.email || 'No Email';

        return {
          _id: char._id.toString(),
          name: char.name || 'Unnamed',
          surname: char.surname || '',
          fullName: char.fullName || `${char.name || ''} ${char.surname || ''}`.trim(),
          userId: userIdString,
          user: {
            _id: userIdString,
            username: username,
            email: email
          },
          age: char.age || 0,
          gender: char.gender || 'other',
          occupation: char.occupation || null,
          socialClass: char.socialClass || null,
          location: char.location || null,
          avatar: char.avatar || '',
          playerStatus: char.playerStatus || 'draft',
          isGestore: char.isGestore || false,
          gameplayRoles: char.gameplayRoles || [],
          characterPermissions: char.characterPermissions || [],
          characterType: char.characterType || 'pg_principale',
          isBot: char.isBot || false,
          currentLocation: char.currentLocation ? {
            _id: char.currentLocation._id?.toString() || char.currentLocation.toString(),
            name: char.currentLocation.name || null,
            slug: char.currentLocation.slug || null
          } : null,
          referentCharacterId: char.referentCharacterId?._id ? char.referentCharacterId._id.toString() : null,
          referent: char.referentCharacterId?.name ? {
            _id: char.referentCharacterId._id.toString(),
            name: char.referentCharacterId.name
          } : undefined,
          metadata: {
            createdAt: char.createdAt ? char.createdAt.toISOString() : new Date().toISOString(),
            submittedAt: char.submittedAt ? char.submittedAt.toISOString() : null,
            approvedAt: char.approvedAt ? char.approvedAt.toISOString() : null,
            rejectedAt: char.rejectedAt ? char.rejectedAt.toISOString() : null,
            isNPC: false,
            isPublic: true,
            updatedAt: new Date().toISOString(),
            createdBy: userIdString
          }
        };
      });

      const totalPages = Math.ceil(totalItems / pageSize);

      const paginationInfo: PaginationInfo = {
        currentPage: page,
        totalPages,
        totalItems,
        pageSize,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed all characters', {
        ...auditInfo,
        currentPage: page,
        pageSize,
        statusFilter: statusFilter || 'all',
        totalResults: transformedCharacters.length,
        totalItems,
        category: 'character_management'
      });

      res.json(listResponse(
        transformedCharacters,
        paginationInfo,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error in getAllCharacters method:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params
      });
      
      res.status(500).json(errorResponse(
        error instanceof Error ? error.message : 'Impossibile recuperare i personaggi',
        'FETCH_ALL_CHARACTERS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get list of pending characters awaiting approval
   * GET /admin/characters/pending
   */
  static async getPendingCharacters(req: Request, res: Response): Promise<void> {
    try {
      const { Character: CharacterModel } = await import('@database/models/Character');
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const priority = req.query.priority as string;
      const sortBy = req.query.sortBy as string || 'submittedAt';
      const sortOrder = req.query.sortOrder as string || 'desc';

      const filter: { playerStatus: 'pending'; reviewPriority?: 'high' | 'normal' | 'low' } = {
        playerStatus: 'pending',
      };
      if (priority && priority !== 'all' && ['high', 'normal', 'low'].includes(priority)) {
        filter.reviewPriority = priority as 'high' | 'normal' | 'low';
      }

      const sortField =
        sortBy === 'submittedAt' || sortBy === 'createdAt' || sortBy === 'name' ? sortBy : 'submittedAt';

      const characters = await CharacterModel.find(filter)
        .populate('userId', 'username email')
        .populate('occupation', 'name')
        .sort({ [sortField]: sortOrder === 'asc' ? 1 : -1 })
        .limit(limit)
        .lean();

      const pendingCharacters: PendingCharacter[] = characters.map((char) => {
        const { username: playerUsername, email: playerEmail } =
          CharacterApprovalController.populatedUserFields(char.userId);
        return {
          id: char._id.toString(),
          name: char.name,
          playerUsername,
          playerEmail,
          submittedAt: char.submittedAt?.toISOString() || new Date().toISOString(),
          occupation: CharacterApprovalController.occupationNameFromPopulate(char.occupation),
          socialClass: CharacterApprovalController.normalizeSocialClass(char.socialClass),
          age: typeof char.age === 'number' ? char.age : 0,
          gender: CharacterApprovalController.narrowGender(char.gender),
          stats: CharacterApprovalController.mapDbStatsToCharacterStats(char.stats),
          skills: CharacterApprovalController.flattenSkillsForPending(char.skills as Record<string, number | object> | undefined),
          background: char.privateDescription || '',
          description: char.physicalDescription || '',
          equipment: [],
          aiGenerated: Boolean(char.aiGenerated),
          reviewPriority: CharacterApprovalController.narrowReviewPriority(char.reviewPriority),
        };
      });

      const totalPending = await CharacterModel.countDocuments(filter);
      const pagination: PaginationInfo = {
        currentPage: page,
        totalPages: Math.ceil(totalPending / limit),
        totalItems: totalPending,
        pageSize: limit,
        hasNextPage: page * limit < totalPending,
        hasPreviousPage: page > 1
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed pending characters', {
        ...auditInfo,
        filters: { priority, sortBy, sortOrder },
        currentPage: page,
        limit
      });

      res.json(listResponse(
        pendingCharacters,
        pagination,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching pending characters:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare i personaggi in attesa',
        'FETCH_PENDING_CHARACTERS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get complete character details with populated references
   * GET /admin/characters/:characterId
   */
  static async getCharacterDetails(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const characterId = req.params.characterId;
      
      // Use local and shared models with proper imports
      const { Character } = await import('@database/models/Character');
      // boundary-allow: debito dichiarato, CharacterApprovalController.ts resta fuori dalla feature oggetti (Fase 6.4) fino al consolidamento del core (Fase 7)
      const { Item } = await import('@features/oggetti/models/Item');
      // boundary-allow: debito dichiarato, CharacterApprovalController.ts resta fuori dalla feature occupazioni (Fase 6.2) fino al consolidamento del core (Fase 7)
      const { Occupation } = await import('@features/occupazioni/models/Occupation');
      const { User } = await import('@database/models/User');
      
      // Get character with populated user data
      const character = await Character.findById(characterId)
        .populate({
          path: 'userId',
          select: 'username email displayName userRoles',
          options: { strictPopulate: false }
        })
        .lean()
        .exec();

      if (!character) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Populate occupation details if occupation ID is present
      let occupationDetails = null;
      let occupationStartingItems: any[] = [];
      if (character.occupation) {
        try {
          occupationDetails = await Occupation.findById(character.occupation)
            .select('name description category dailySalary benefits workingConditions')
            .lean();

          // If occupation has startingItems, populate them too
          if (occupationDetails?.benefits?.startingItems && occupationDetails.benefits.startingItems.length > 0) {
            const itemIds = occupationDetails.benefits.startingItems.map((item: any) => item.itemId);
            const startingItemsData = await Item.find({ 
              _id: { $in: itemIds } 
            }).select('name description category basePrice properties').lean();
            
            occupationStartingItems = occupationDetails.benefits.startingItems.map((startingItem: any) => {
              const itemData = startingItemsData.find((item: any) => item._id.toString() === startingItem.itemId.toString());
              if (itemData) {
                return {
                  id: itemData._id.toString(),
                  name: itemData.name,
                  description: itemData.description,
                  category: itemData.category,
                  basePrice: itemData.basePrice,
                  quantity: startingItem.quantity || 1,
                  properties: itemData.properties,
                  source: 'occupation'
                };
              }
              return {
                id: startingItem.itemId.toString(),
                name: 'Unknown Starting Item',
                description: 'Item not found in database',
                category: 'unknown',
                quantity: startingItem.quantity || 1,
                source: 'occupation',
                note: `Item ID: ${startingItem.itemId}`
              };
            });
          }
        } catch (occErr) {
          logger.warn('Failed to populate occupation details:', { 
            occupationId: character.occupation,
            error: occErr instanceof Error ? occErr.message : String(occErr)
          });
        }
      }

      // Populate equipment items if equipment IDs are present
      let equipmentDetails: any[] = [];
      if (character.equipment && character.equipment.length > 0) {
        try {
          const equipmentItems = await Item.find({ 
            _id: { $in: character.equipment } 
          }).select('name description category basePrice properties').lean();
          
          // Create detailed equipment array with quantity info
          equipmentDetails = character.equipment.map((itemId: string) => {
            const itemData = equipmentItems.find((item: any) => item._id.toString() === itemId);
            if (itemData) {
              return {
                id: itemData._id.toString(),
                name: itemData.name,
                description: itemData.description,
                category: itemData.category,
                basePrice: itemData.basePrice,
                quantity: 1, // Default quantity for character equipment
                properties: itemData.properties,
                source: 'character'
              };
            }
            return {
              id: itemId,
              name: `Unknown Item`,
              description: 'Item not found in database',
              category: 'unknown',
              source: 'character',
              note: `Item ID: ${itemId}`
            };
          });
        } catch (itemErr) {
          logger.warn('Failed to populate equipment details:', { 
            equipment: character.equipment,
            error: itemErr instanceof Error ? itemErr.message : String(itemErr)
          });
        }
      }

      // Combine character equipment with occupation starting items
      const allEquipment = [...equipmentDetails, ...occupationStartingItems];

      // Transform character data with populated references
      const userData = character.userId || {};
      const userIdString = userData._id ? userData._id.toString() : 
                          (typeof character.userId === 'string' ? character.userId : 'unknown');

      const transformedCharacter = {
        id: character._id.toString(),
        characterName: character.name || 'Unnamed',
        characterSurname: character.surname || '',
        age: character.age,
        apparentAge: character.apparentAge,
        physicalDescription: character.physicalDescription || '',
        birthPlace: character.birthPlace || '',
        publicDescription: character.publicDescription || '',
        privateDescription: character.privateDescription || '',
        gender: character.gender,
        
        // User details
        userId: userIdString,
        username: userData.username || 'Unknown User',
        email: userData.email || 'No Email',
        
        // Occupation details (populated or ID)
        occupation: occupationDetails || character.occupation,
        
        // Status and workflow
        playerStatus: character.playerStatus || 'draft',
        createdAt: character.createdAt ? character.createdAt.toISOString() : new Date().toISOString(),
        submittedAt: character.submittedAt ? character.submittedAt.toISOString() : null,
        approvedAt: character.approvedAt ? character.approvedAt.toISOString() : null,
        rejectedAt: character.rejectedAt ? character.rejectedAt.toISOString() : null,
        lastActive: character.lastActive ? character.lastActive.toISOString() : null,
        
        // Game data
        gameplayRoles: Array.isArray(character.gameplayRoles) ? character.gameplayRoles : [],
        currentLocation: character.currentLocation ? character.currentLocation.toString() : null,
        isActive: character.isActive || false,
        
        // Character sheet data
        stats: character.stats || null,
        derived: character.derived || null,
        skills: character.skills || {},

        // Character description and background
        backgroundCompleted: character.backgroundCompleted || false,

        // Equipment (populated with full item details + occupation starting items)
        equipment: allEquipment,
        
        // Appearance
        avatar: character.avatar || null,
        profileImage: character.profileImage || null,
        audioTheme: character.audioTheme || null,
        prestavolto: character.prestavolto || null,
        
        // Review data
        reviewHistory: character.reviewHistory || [],
        approvedBy: character.approvedBy ? character.approvedBy.toString() : null,
        rejectedBy: character.rejectedBy ? character.rejectedBy.toString() : null,
        rejectionReason: character.rejectionReason || null
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed complete character details', {
        ...auditInfo,
        characterId,
        characterName: transformedCharacter.characterName,
        playerStatus: transformedCharacter.playerStatus,
        hasOccupationDetails: !!occupationDetails,
        characterEquipmentCount: equipmentDetails.length,
        occupationStartingItemsCount: occupationStartingItems.length,
        totalEquipmentCount: allEquipment.length,
        category: 'character_management'
      });

      res.json(successResponse(
        transformedCharacter,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching character details:', { 
        error: error instanceof Error ? error.message : String(error), 
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        characterId: req.params.characterId,
        query: req.query,
        params: req.params
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare i dettagli del personaggio',
        'FETCH_CHARACTER_DETAILS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update character fields including permissions
   * PATCH /admin/characters/:characterId
   */
  static async updateCharacter(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const characterId = req.params.characterId;
      const updateData = req.body;

      // Use local model with proper imports
      const { Character } = await import('@database/models/Character');

      // Find character
      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Build update object with only allowed fields
      const allowedFields = [
        'name', 'surname', 'age', 'gender', 'playerStatus',
        'biography', 'occupation', 'location', 'socialClass',
        'avatar', 'profileImage',  // Character appearance fields
        'canAccessAdminPanel', 'isGestore', 'gameplayRoles', 'characterPermissions', 'adminPermissions'
      ];

      const updates: any = {};
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updates[field] = updateData[field];
        }
      }

      // Apply updates
      Object.assign(character, updates);

      // Save character
      await character.save();

      // Populate user data for response
      await character.populate({
        path: 'userId',
        select: 'username email displayName',
        options: { strictPopulate: false }
      });

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin updated character', {
        ...auditInfo,
        characterId,
        updatedFields: Object.keys(updates),
        category: 'character_management'
      });

      res.json(updateResponse(
        character.toObject(),
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error updating character:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        characterId: req.params.characterId,
        body: req.body
      });

      res.status(500).json(errorResponse(
        error instanceof Error ? error.message : 'Impossibile aggiornare il personaggio',
        'UPDATE_CHARACTER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Change PNG referent character
   * PATCH /admin/characters/:characterId/change-referent
   */
  static async changeReferent(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const { newReferentId } = req.body;

      if (!newReferentId) {
        res.status(400).json(errorResponse(
          'newReferentId obbligatorio',
          'MISSING_REFERENT_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const { Character } = await import('@database/models/Character');

      // 1. Verify character exists and is PNG or Master
      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      if (character.characterType !== 'png' && character.characterType !== 'pg_master') {
        res.status(400).json(errorResponse(
          'Solo PNG e Master possono cambiare referente',
          'INVALID_CHARACTER_TYPE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // 2. Verify new referent exists and is pg_principale
      const newReferent = await Character.findById(newReferentId);
      if (!newReferent) {
        res.status(404).json(errorResponse(
          'PG principale non trovato',
          'REFERENT_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      if (newReferent.characterType !== 'pg_principale') {
        res.status(400).json(errorResponse(
          'Il referente deve essere un PG principale',
          'INVALID_REFERENT_TYPE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (newReferent.playerStatus !== 'approved') {
        res.status(400).json(errorResponse(
          'Il PG principale deve essere approvato',
          'REFERENT_NOT_APPROVED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // 3. Update PNG: referentCharacterId AND userId (owner follows referent)
      const oldUserId = character.userId;
      const newUserId = newReferent.userId;

      character.referentCharacterId = newReferent._id;
      character.userId = newUserId;

      await character.save();

      // 4. Log the change
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin changed PNG referent', {
        ...auditInfo,
        characterId: character._id.toString(),
        characterName: character.fullName,
        oldUserId: oldUserId.toString(),
        newUserId: newUserId.toString(),
        newReferentId,
        newReferentName: newReferent.fullName,
        category: 'character_management'
      });

      // 5. Return updated character with populated referent
      const updatedCharacter = await Character.findById(characterId)
        .populate('userId', 'username email')
        .populate('referentCharacterId', 'name')
        .lean();

      res.status(200).json(successResponse(
        updatedCharacter,
        'Referente aggiornato con successo',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error changing PNG referent:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        characterId: req.params.characterId,
        newReferentId: req.body.newReferentId
      });

      res.status(500).json(errorResponse(
        'Errore nel cambio referente',
        'CHANGE_REFERENT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Extract the FINANZA skill value from a character's skills, handling both
   * Map and plain-object formats and granular SkillBreakdown objects.
   */
  private static extractFinanzaSkill(character: any): number {
    let finanzaSkill = 1; // Default fallback

    if (character.skills instanceof Map) {
      const finanzaValue = character.skills.get('Finanza') || character.skills.get('FINANZA') || character.skills.get('finanza');
      if (typeof finanzaValue === 'object' && finanzaValue !== null && 'total' in finanzaValue) {
        finanzaSkill = (finanzaValue as { total: number }).total;
      } else if (typeof finanzaValue === 'number') {
        finanzaSkill = finanzaValue;
      }
    } else if (character.skills && typeof character.skills === 'object') {
      const finanzaValue = (character.skills as Record<string, unknown>)['Finanza'] || (character.skills as Record<string, unknown>)['FINANZA'] || (character.skills as Record<string, unknown>)['finanza'];
      if (typeof finanzaValue === 'object' && finanzaValue !== null && 'total' in finanzaValue) {
        finanzaSkill = (finanzaValue as { total: number }).total;
      } else if (typeof finanzaValue === 'number') {
        finanzaSkill = finanzaValue;
      }
    }

    return Math.max(1, Math.min(99, finanzaSkill || 1));
  }

  /**
   * Create (or recreate) a character's CharacterFinances record based on their
   * FINANZA skill value. Shared by both single and bulk approval, so both paths
   * write the same schema shape (cash/bankDeposit/creditLine — not a made-up shape).
   */
  private static async buildInitialFinances(characterId: any, finanzaSkill: number) {
    const { CharacterFinances, SocialClassConfig } = await import('@database/models');

    const socialClassConfig = await SocialClassConfig.findOne({
      minFinanceSkill: { $lte: finanzaSkill },
      maxFinanceSkill: { $gte: finanzaSkill }
    });

    if (!socialClassConfig) {
      throw new Error(`No social class found for FINANZA skill: ${finanzaSkill}`);
    }

    const minWealth = socialClassConfig.initialWealth?.minCash || 240;
    const maxWealth = socialClassConfig.initialWealth?.maxCash || 240;
    const baseWealth = Math.floor(Math.random() * (maxWealth - minWealth + 1)) + minWealth;

    // Always delete existing and recreate for security
    await CharacterFinances.deleteOne({ characterId });

    const characterFinances = new CharacterFinances({
      characterId,
      socialClass: socialClassConfig.name,
      financeSkillValue: finanzaSkill,
      // The initial patrimonio assigned by social class starts as bank deposit, not cash.
      // The character only carries cash they've withdrawn via the (not yet implemented) "Banca" feature.
      cash: 0,
      bankDeposit: baseWealth,
      creditLine: {
        maxWeekly: socialClassConfig.weeklyCredit,
        currentAvailable: socialClassConfig.weeklyCredit,
        lastResetDate: new Date(),
        nextResetDate: CharacterApprovalController.getNextSunday()
      },
      properties: [],
      lastCalculated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await characterFinances.save();
    return characterFinances;
  }

  /**
   * Submit approval decision for a character
   * POST /admin/characters/:characterId/approve
   */
  static async submitCharacterReview(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const characterId = req.params.characterId;
      const { action, note } = req.body;

      // Validate review data
      if (!action || !['approve', 'reject'].includes(action)) {
        res.status(400).json(errorResponse(
          'Azione di revisione non valida. Deve essere "approve" o "reject"',
          'INVALID_REVIEW_ACTION',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Note is required only for reject, optional for approve
      if (action === 'reject' && (!note || note.trim().length === 0)) {
        res.status(400).json(errorResponse(
          'La nota di revisione è richiesta per il rifiuto',
          'REVIEW_NOTE_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Use local and shared models with proper imports
      const { Character } = await import('@database/models/Character');
      // boundary-allow: debito dichiarato, CharacterApprovalController.ts resta fuori dalla feature occupazioni (Fase 6.2) fino al consolidamento del core (Fase 7)
      const { Occupation } = await import('@features/occupazioni/models/Occupation');
      
      // Get character in PENDING_APPROVAL status - force fresh read
      const character = await Character.findOne({
        _id: characterId,
        playerStatus: 'pending'
      }).lean(false);

      if (!character) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato o non in attesa di approvazione',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        res.status(401).json(errorResponse(
          'Autenticazione richiesta',
          'AUTHENTICATION_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      let result = {};

      if (action === 'approve') {
        // APPROVE: Set character status and assign starting equipment
        let startingItems = [];
        if (character.occupation) {
          const occupation = await Occupation.findById(character.occupation);
          if (occupation && occupation.benefits && occupation.benefits.startingItems) {
            startingItems = occupation.benefits.startingItems.map((item: any) => item.itemId);
          }
        }

        // Create CharacterFinances record based on FINANZA skill
        const finanzaSkill = CharacterApprovalController.extractFinanzaSkill(character);

        logger.info('Character FINANZA skill value for approval', {
          characterId: character._id.toString(),
          characterName: character.name,
          finanzaSkill,
          skillsType: character.skills instanceof Map ? 'Map' : typeof character.skills
        });

        const characterFinances = await CharacterApprovalController.buildInitialFinances(character._id, finanzaSkill);

        logger.info('CharacterFinances created on approval', {
          characterId: character._id.toString(),
          characterName: character.name,
          socialClass: characterFinances.socialClass,
          finanzaSkill,
          cash: characterFinances.cash,
          bankDeposit: characterFinances.bankDeposit,
          creditLine: characterFinances.creditLine.maxWeekly
        });

        // Update character: assign equipment and set status to APPROVED
        character.equipment = startingItems;
        character.playerStatus = 'approved';
        character.approvedAt = new Date();
        character.approvedBy = auditInfo!.adminId; // Set who approved
        character.approvedByName = auditInfo!.adminUsername; // Set approver username
        character.gameplayRoles = ['player']; // Default gameplay role for approved character
        character.reviewNote = note; // Store approval note
        
        // Add to review history
        const reviewEntry = {
          action: 'approve',
          reviewedBy: auditInfo!.adminId,
          reviewedByUsername: auditInfo!.adminUsername,
          note: note,
          reviewedAt: new Date()
        };
        
        character.reviewHistory = character.reviewHistory || [];
        character.reviewHistory.push(reviewEntry);
        
        await character.save();

        logger.info('Character approved with starting items', {
          characterId,
          characterName: character.name,
          occupationId: character.occupation,
          startingItemsCount: startingItems.length,
          startingItems,
          note
        });

        result = {
          characterId,
          action: 'approve',
          startingItemsAssigned: startingItems.length,
          note
        };

      } else if (action === 'reject') {
        // REJECT: Change status back to DRAFT with rejection reason
        character.playerStatus = 'draft';
        character.rejectedAt = new Date();
        character.rejectedBy = auditInfo.adminId; // Set who rejected
        character.rejectedByName = auditInfo.adminUsername; // Set rejector username
        character.rejectionReason = note; // Store rejection reason
        character.reviewNote = note; // Store rejection reason (legacy field)
        
        // Add to review history
        const reviewEntry = {
          action: 'reject',
          reviewedBy: auditInfo!.adminId,
          reviewedByUsername: auditInfo!.adminUsername,
          note: note,
          reviewedAt: new Date()
        };
        
        character.reviewHistory = character.reviewHistory || [];
        character.reviewHistory.push(reviewEntry);
        
        await character.save();

        logger.info('Character rejected and returned to draft', {
          characterId,
          characterName: character.name,
          rejectionReason: note
        });

        result = {
          characterId,
          action: 'reject',
          rejectionReason: note
        };
      }

      logger.info('Character review submitted', {
        ...auditInfo,
        characterId,
        action,
        note,
        category: 'character_management'
      });

      // Send Redis event for real-time notifications and off-game messaging
      try {
        const reviewEvent = {
          characterId,
          characterName: character.name || 'Unknown',
          action,
          note: note || '',
          reviewedBy: auditInfo!.adminId,
          reviewedByUsername: auditInfo!.adminUsername,
          timestamp: new Date().toISOString(),
          // Include cookies for HTTP calls
          adminCookies: {
            auth_token: req.cookies?.auth_token,
            character_context: req.cookies?.character_context
          }
        };

        // Validate the event object before serializing
        if (!reviewEvent.characterId || !reviewEvent.action || !reviewEvent.reviewedByUsername) {
          logger.error('Invalid review event data - missing required fields', {
            hasCharacterId: !!reviewEvent.characterId,
            hasAction: !!reviewEvent.action,
            hasReviewedByUsername: !!reviewEvent.reviewedByUsername,
            reviewEvent
          });
          throw new Error('Invalid review event data');
        }

        const eventJson = JSON.stringify(reviewEvent);
        await redis.getClient().publish('character:review_completed', eventJson);
        
        logger.info('Character review event published to Redis', {
          event: 'character:review_completed',
          characterId,
          action,
          reviewedBy: auditInfo!.adminUsername,
          eventSize: eventJson.length
        });
      } catch (redisError: unknown) {
        logger.error('Failed to publish character review event to Redis', {
          error: redisError instanceof Error ? redisError.message : String(redisError),
          stack: redisError instanceof Error ? redisError.stack : undefined,
          characterId,
          action
        });
        // Continue execution - Redis failure shouldn't break the approval process
      }

      res.json(createResponse(
        result,
        action === 'approve' ? 'Personaggio approvato con successo' : 'Personaggio respinto',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error submitting character review:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        characterId: req.params.characterId,
        requestBody: req.body,
        auditInfo: AdminAuthMiddleware.getAuditInfo(req)
      });
      
      res.status(500).json(errorResponse(
        'Impossibile inviare la revisione del personaggio',
        'SUBMIT_CHARACTER_REVIEW_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }


  /**
   * Get character approval statistics
   * GET /admin/characters/review-stats
   */
  static async getReviewStats(req: Request, res: Response): Promise<void> {
    try {
      const { Character: CharacterModel } = await import('@database/models/Character');
      const rawPeriod = req.query.period;
      const period: 'day' | 'week' | 'month' | 'year' =
        rawPeriod === 'day' || rawPeriod === 'week' || rawPeriod === 'month' || rawPeriod === 'year'
          ? rawPeriod
          : 'week';

      const now = new Date();
      const startDate = new Date();
      switch (period) {
        case 'day':
          startDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      type PlayerStatusBucket = { _id: string | null; count: number };
      const statusCounts = await CharacterModel.aggregate<PlayerStatusBucket>([
        { $match: { submittedAt: { $gte: startDate, $lte: now } } },
        { $group: { _id: '$playerStatus', count: { $sum: 1 } } },
      ]);

      const countByPlayerStatus: Record<string, number> = {};
      for (const row of statusCounts) {
        if (row._id !== undefined && row._id !== null) {
          countByPlayerStatus[row._id] = row.count;
        }
      }

      const approved = countByPlayerStatus.approved ?? 0;
      const pending = countByPlayerStatus.pending ?? 0;
      const draft = countByPlayerStatus.draft ?? 0;

      const rejected = await CharacterModel.countDocuments({
        rejectedAt: { $gte: startDate, $lte: now },
      });

      const totalReviewed = approved + rejected;
      const approvalRate = totalReviewed > 0 ? (approved / totalReviewed) * 100 : 0;

      const stats: ReviewStats = {
        period,
        stats: {
          totalReviewed,
          approved,
          rejected,
          changesRequested: 0,
          approvalRate: Math.round(approvalRate * 10) / 10,
          avgReviewTime: 'N/A',
          byReviewer: [],
          byCategory: {
            pending,
            approved,
            rejected,
            draft,
          },
          commonRejectionReasons: [],
        },
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed review statistics', {
        ...auditInfo,
        period
      });

      res.json(successResponse(
        stats,
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error fetching review stats:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare le statistiche di revisione',
        'FETCH_REVIEW_STATS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  private static readonly SOCIAL_CLASSES: readonly SocialClass[] = [
    'destitute',
    'poor',
    'modest',
    'lower_middle',
    'middle_class',
    'wealthy',
    'affluent',
    'elite',
  ];

  private static normalizeSocialClass(value: unknown): SocialClass {
    if (typeof value === 'string' && CharacterApprovalController.SOCIAL_CLASSES.includes(value as SocialClass)) {
      return value as SocialClass;
    }
    return 'modest';
  }

  private static mapDbStatsToCharacterStats(
    stats:
      | {
          strength: number;
          constitution: number;
          size: number;
          dexterity: number;
          appearance: number;
          intelligence: number;
          power: number;
          education: number;
        }
      | undefined
  ): CharacterStats {
    const z = (n: unknown) => (typeof n === 'number' && !Number.isNaN(n) ? n : 0);
    if (!stats) {
      return { str: 0, dex: 0, int: 0, con: 0, app: 0, pow: 0, siz: 0, edu: 0 };
    }
    return {
      str: z(stats.strength),
      dex: z(stats.dexterity),
      int: z(stats.intelligence),
      con: z(stats.constitution),
      app: z(stats.appearance),
      pow: z(stats.power),
      siz: z(stats.size),
      edu: z(stats.education),
    };
  }

  private static flattenSkillsForPending(skills: Record<string, number | object> | undefined): Record<string, number> {
    if (!skills) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(skills)) {
      if (typeof v === 'number') out[k] = v;
    }
    return out;
  }

  private static narrowGender(value: unknown): 'male' | 'female' {
    return value === 'female' ? 'female' : 'male';
  }

  private static populatedUserFields(ref: unknown): { username: string; email: string } {
    if (ref && typeof ref === 'object') {
      const o = ref as { username?: unknown; email?: unknown };
      return {
        username: typeof o.username === 'string' ? o.username : 'Unknown',
        email: typeof o.email === 'string' ? o.email : 'Unknown',
      };
    }
    return { username: 'Unknown', email: 'Unknown' };
  }

  private static occupationNameFromPopulate(ref: unknown): string {
    if (ref && typeof ref === 'object' && 'name' in ref) {
      const n = (ref as { name?: unknown }).name;
      return typeof n === 'string' ? n : 'Unknown';
    }
    return 'Unknown';
  }

  private static narrowReviewPriority(value: unknown): 'high' | 'normal' | 'low' {
    if (value === 'high' || value === 'low') return value;
    return 'normal';
  }

  /**
   * Helper method to calculate next Sunday for credit line reset
   */
  private static getNextSunday(): Date {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek; // Next Sunday
    
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    nextSunday.setHours(0, 0, 0, 0); // Reset to beginning of day
    
    return nextSunday;
  }

  /**
   * Update character review priority
   * PATCH /admin/characters/:characterId/priority
   */
  static async updateReviewPriority(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { Character: CharacterModel } = await import('@database/models/Character');
      const characterId = req.params.characterId;
      const { priority } = req.body;

      if (!priority || !['high', 'normal', 'low'].includes(priority)) {
        res.status(400).json(errorResponse(
          'Valore di priorità non valido',
          'INVALID_PRIORITY',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Update priority in database
      const character = await CharacterModel.findByIdAndUpdate(
        characterId,
        { reviewPriority: priority },
        { new: true }
      );

      if (!character) {
        res.status(404).json(errorResponse(
          'Character not found',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Character review priority updated', {
        ...auditInfo,
        characterId,
        newPriority: priority,
        category: 'character_management'
      });

      res.json(updateResponse(
        { characterId, priority },
        'Priorità di revisione aggiornata con successo',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error updating review priority:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        characterId: req.params.characterId,
        requestBody: req.body,
        params: req.params
      });
      
      res.status(500).json(errorResponse(
        'Impossibile aggiornare la priorità di revisione',
        'UPDATE_PRIORITY_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get pending characters for current admin to review
   * GET /admin/characters/pending-for-me
   */
  static async getPendingCharactersForMe(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;

      // Use local model with proper imports
      const { Character } = await import('@database/models/Character');

      const characters = await Character.find({
        state: 'PENDING_APPROVAL'
      })
      .sort({ createdAt: 1 }) // Oldest first
      .limit(limit)
      .select('characterName characterSurname occupation createdAt userId')
      .populate('userId', 'username')
      .lean();

      // Get total pending count
      const totalPending = await Character.countDocuments({ state: 'PENDING_APPROVAL' });

      // Transform data
      const transformedCharacters = characters.map((c: any) => ({
        id: c._id.toString(),
        characterName: c.characterName,
        characterSurname: c.characterSurname,
        username: c.userId?.username || 'N/A',
        occupation: c.occupation || 'N/A',
        submittedAt: c.createdAt,
        daysWaiting: Math.floor((Date.now() - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      }));

      res.json(successResponse(
        {
          characters: transformedCharacters,
          count: transformedCharacters.length,
          totalPending
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error getting pending characters for review:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare i personaggi in attesa',
        'GET_PENDING_CHARACTERS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Bulk approve multiple characters
   * POST /admin/characters/bulk-approve
   */
  static async bulkApproveCharacters(req: Request, res: Response): Promise<void> {
    try {
      const { characterIds } = req.body;

      if (!Array.isArray(characterIds) || characterIds.length === 0) {
        res.status(400).json(errorResponse(
          'characterIds array is required',
          'INVALID_INPUT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const { Character, Occupation } = await import('@database/models');
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        res.status(401).json(errorResponse(
          'Autenticazione richiesta',
          'UNAUTHORIZED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      // Process all characters with Promise.allSettled
      const results = await Promise.allSettled(
        characterIds.map(async (characterId: string) => {
          // Find character in PENDING_APPROVAL status
          const character = await Character.findOne({
            _id: characterId,
            playerStatus: 'pending'
          }).lean(false);

          if (!character) {
            throw new Error(`Character not found or not pending: ${characterId}`);
          }

          // Get starting items from occupation
          let startingItems = [];
          if (character.occupation) {
            const occupation = await Occupation.findById(character.occupation);
            if (occupation && occupation.benefits && occupation.benefits.startingItems) {
              startingItems = occupation.benefits.startingItems.map((item: any) => item.itemId);
            }
          }

          // Get Finanza skill for initial finances
          const finanzaSkill = CharacterApprovalController.extractFinanzaSkill(character);

          // Create finances record (same shape as single approval — cash/bankDeposit/creditLine)
          await CharacterApprovalController.buildInitialFinances(character._id, finanzaSkill);

          // Update character status - USE TOP-LEVEL FIELDS (not metadata)
          character.playerStatus = 'approved';
          character.approvedAt = new Date();
          character.approvedBy = auditInfo.adminId;
          character.approvedByName = auditInfo.adminUsername;
          character.gameplayRoles = ['player'];
          character.equipment = startingItems; // Use equipment, not inventory

          // Add to review history (was missing in bulk operations)
          const reviewEntry = {
            action: 'approve',
            reviewedBy: auditInfo.adminId,
            reviewedByUsername: auditInfo.adminUsername,
            note: 'Bulk approval',
            reviewedAt: new Date()
          };
          character.reviewHistory = character.reviewHistory || [];
          character.reviewHistory.push(reviewEntry);

          await character.save();

          logger.info('Character approved in bulk', {
            ...auditInfo,
            characterId: character._id,
            characterName: `${character.characterName} ${character.characterSurname}`,
            finanzaSkill
          });

          return character;
        })
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failedCount = results.filter(r => r.status === 'rejected').length;

      // Extract error details for logging and response
      const detailedResults = results.map((r, i) => {
        if (r.status === 'fulfilled') {
          return {
            characterId: characterIds[i],
            result: true
          };
        } else {
          const errorMessage = r.reason instanceof Error
            ? r.reason.message
            : (typeof r.reason === 'string' ? r.reason : String(r.reason));

          // Log individual failure for debugging
          logger.warn('Character approval failed in bulk operation', {
            characterId: characterIds[i],
            error: errorMessage,
            stack: r.reason instanceof Error ? r.reason.stack : undefined
          });

          return {
            characterId: characterIds[i],
            result: false,
            error: errorMessage
          };
        }
      });

      logger.info('Bulk approve characters completed', {
        ...auditInfo,
        totalCharacters: characterIds.length,
        successful: successCount,
        failed: failedCount
      });

      res.json(successResponse(
        {
          success: successCount,
          failed: failedCount,
          results: detailedResults
        },
        'Bulk approve completed',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error in bulk approve characters:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json(errorResponse(
        'Failed to bulk approve characters',
        'BULK_APPROVE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Bulk reject multiple characters
   * POST /admin/characters/bulk-reject
   */
  static async bulkRejectCharacters(req: Request, res: Response): Promise<void> {
    try {
      const { characterIds, reason } = req.body;

      if (!Array.isArray(characterIds) || characterIds.length === 0) {
        res.status(400).json(errorResponse(
          'characterIds array is required',
          'INVALID_INPUT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Rejection reason is required',
          'REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const { Character } = await import('@database/models/Character');
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        res.status(401).json(errorResponse(
          'Autenticazione richiesta',
          'UNAUTHORIZED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      // Process all characters with Promise.allSettled
      const results = await Promise.allSettled(
        characterIds.map(async (characterId: string) => {
          const character = await Character.findOne({
            _id: characterId,
            playerStatus: 'pending'
          }).lean(false);

          if (!character) {
            throw new Error(`Character not found or not pending: ${characterId}`);
          }

          // Update status to DRAFT with rejection note - USE TOP-LEVEL FIELDS (not metadata)
          character.playerStatus = 'draft';
          character.rejectedAt = new Date();
          character.rejectedBy = auditInfo.adminId;
          character.rejectedByName = auditInfo.adminUsername;
          character.rejectionReason = reason.trim();

          // Add to review history (was missing in bulk operations)
          const reviewEntry = {
            action: 'reject',
            reviewedBy: auditInfo.adminId,
            reviewedByUsername: auditInfo.adminUsername,
            note: reason.trim(),
            reviewedAt: new Date()
          };
          character.reviewHistory = character.reviewHistory || [];
          character.reviewHistory.push(reviewEntry);

          await character.save();

          logger.info('Character rejected in bulk', {
            ...auditInfo,
            characterId: character._id,
            characterName: `${character.characterName} ${character.characterSurname}`,
            reason: reason.trim()
          });

          return character;
        })
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failedCount = results.filter(r => r.status === 'rejected').length;

      logger.info('Bulk reject characters completed', {
        ...auditInfo,
        totalCharacters: characterIds.length,
        successful: successCount,
        failed: failedCount,
        reason: reason.trim()
      });

      res.json(successResponse(
        {
          success: successCount,
          failed: failedCount,
          results: results.map((r, i) => ({
            characterId: characterIds[i],
            success: r.status === 'fulfilled',
            error: r.status === 'rejected' ? r.reason : undefined
          }))
        },
        'Bulk reject completed',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error in bulk reject characters:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json(errorResponse(
        'Failed to bulk reject characters',
        'BULK_REJECT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Bulk delete multiple characters
   * POST /admin/characters/bulk-delete
   */
  /**
   * Delete a single character (soft delete)
   */
  static async deleteCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;

      const { Character } = await import('@database/models/Character');
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        res.status(401).json(errorResponse(
          'Autenticazione richiesta',
          'UNAUTHORIZED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      // Find character
      const character = await Character.findById(characterId);

      if (!character) {
        res.status(404).json(errorResponse(
          `Character not found: ${characterId}`,
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Soft delete using plugin method
      await character.softDelete(
        auditInfo.adminId,
        auditInfo.adminCharacterName || 'Unknown Admin'
      );

      logger.warn('Character soft deleted', {
        ...auditInfo,
        characterId,
        characterName: character.name
      });

      res.json(successResponse(
        { characterId, deleted: true },
        'Character deleted successfully',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error deleting character:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json(errorResponse(
        'Failed to delete character',
        'DELETE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async bulkDeleteCharacters(req: Request, res: Response): Promise<void> {
    try {
      const { characterIds } = req.body;

      if (!Array.isArray(characterIds) || characterIds.length === 0) {
        res.status(400).json(errorResponse(
          'characterIds array is required',
          'INVALID_INPUT',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const { Character } = await import('@database/models/Character');
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        res.status(401).json(errorResponse(
          'Autenticazione richiesta',
          'UNAUTHORIZED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      // Process all characters with Promise.allSettled
      const results = await Promise.allSettled(
        characterIds.map(async (characterId: string) => {
          const character = await Character.findById(characterId);

          if (!character) {
            throw new Error(`Character not found: ${characterId}`);
          }

          // Soft delete using plugin method
          await character.softDelete(
            auditInfo.adminId,
            auditInfo.adminCharacterName || 'Unknown Admin'
          );

          logger.warn('Character soft deleted in bulk', {
            ...auditInfo,
            characterId,
            characterName: character.name
          });

          return character;
        })
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failedCount = results.filter(r => r.status === 'rejected').length;

      logger.info('Bulk delete characters completed', {
        ...auditInfo,
        totalCharacters: characterIds.length,
        successful: successCount,
        failed: failedCount
      });

      res.json(successResponse(
        {
          success: successCount,
          failed: failedCount,
          results: results.map((r, i) => ({
            characterId: characterIds[i],
            success: r.status === 'fulfilled',
            error: r.status === 'rejected' ? r.reason : undefined
          }))
        },
        'Bulk delete completed',
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Error in bulk delete characters:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json(errorResponse(
        'Failed to bulk delete characters',
        'BULK_DELETE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get Duplicate Face Claims - Admin endpoint
   * GET /admin/characters/face-claims/duplicates
   */
  static async getDuplicateFaceClaims(req: Request, res: Response): Promise<void> {
    try {
      const { Character } = await import('@database/models/Character');
      const duplicates = await Character.aggregate([
        { $match: { prestavolto: { $exists: true, $nin: [null, ''] }, isDeleted: { $ne: true } } },
        { $group: {
            _id: { $toLower: '$prestavolto' },
            prestavolto: { $first: '$prestavolto' },
            characters: { $push: { _id: '$_id', name: '$name', surname: '$surname', avatar: '$avatar', playerStatus: '$playerStatus', prestavoltoStatus: '$prestavoltoStatus', userId: '$userId', createdAt: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1, prestavolto: 1 } }
      ]);

      const faceClaimGroups = duplicates.map((group: any) => ({
        prestavolto: group.prestavolto,
        characters: group.characters,
        duplicateCount: group.count,
        hasApproved: group.characters.some((c: any) => c.prestavoltoStatus === 'approved'),
        hasPending: group.characters.some((c: any) => c.prestavoltoStatus === 'pending_duplicate')
      }));

      res.json({ success: true, data: { faceClaimGroups } });
    } catch (error: unknown) {
      logger.error('Get duplicate face claims error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, error: 'Impossibile recuperare i duplicati', code: 'GET_DUPLICATES_ERROR' });
    }
  }

  /**
   * Approve Face Claim - Admin endpoint
   * POST /admin/characters/:id/approve-faceclaim
   */
  static async approveFaceClaim(req: Request, res: Response): Promise<void> {
    try {
      const { Character } = await import('@database/models/Character');
      const { Types } = await import('mongoose');

      // Validate characterId to prevent SQL injection
      const characterId = req.params.id as string;
      if (!Types.ObjectId.isValid(characterId)) {
        res.status(400).json({ success: false, error: 'ID personaggio non valido', code: 'INVALID_CHARACTER_ID' });
        return;
      }

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json({ success: false, error: 'Personaggio non trovato', code: 'CHARACTER_NOT_FOUND' });
        return;
      }

      character.prestavoltoStatus = 'approved';
      character.prestavoltoApprovedBy = req.user!.userId;
      character.prestavoltoApprovedAt = new Date();
      await character.save();

      logger.info('Face claim approved', { characterId: character._id, prestavolto: character.prestavolto, approvedBy: req.user!.userId });
      res.json(successResponse({ character }, 'Face claim approved', getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Approve face claim error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, error: 'Impossibile approvare', code: 'APPROVE_FACECLAIM_ERROR' });
    }
  }

  /**
   * Reject Face Claim - Admin endpoint
   * POST /admin/characters/:id/reject-faceclaim
   */
  static async rejectFaceClaim(req: Request, res: Response): Promise<void> {
    try {
      const { Character } = await import('@database/models/Character');
      const { Types } = await import('mongoose');

      // Validate characterId to prevent SQL injection
      const characterId = req.params.id as string;
      if (!Types.ObjectId.isValid(characterId)) {
        res.status(400).json({ success: false, error: 'ID personaggio non valido', code: 'INVALID_CHARACTER_ID' });
        return;
      }

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json({ success: false, error: 'Personaggio non trovato', code: 'CHARACTER_NOT_FOUND' });
        return;
      }

      character.prestavolto = undefined;
      character.prestavoltoStatus = null;
      character.prestavoltoApprovedBy = undefined;
      character.prestavoltoApprovedAt = undefined;
      await character.save();

      logger.info('Face claim rejected', { characterId: character._id, rejectedBy: req.user!.userId });
      res.json(successResponse({ character }, 'Face claim rejected and cleared', getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Reject face claim error:', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ success: false, error: 'Impossibile rifiutare', code: 'REJECT_FACECLAIM_ERROR' });
    }
  }

}