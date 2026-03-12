import { Request, Response } from 'express';
import { 
  ApiResponse, 
  PendingCharacter, 
  Character,
  CharacterReview, 
  ValidationChecks,
  ReviewStats,
  PaginationInfo
} from '../types/management';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { redis } from '@config/runtime/redis';
import { listResponse, successResponse, errorResponse, createResponse, updateResponse, getRequestId } from '../utils/apiResponse';

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

      const skip = (page - 1) * pageSize;

      // Build query filter
      let filter: any = {};
      if (statusFilter && ['draft', 'pending', 'approved'].includes(statusFilter)) {
        filter.playerStatus = statusFilter;
      }
      if (userId) {
        filter.userId = userId;
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
          .select('name surname fullName occupation playerStatus createdAt submittedAt approvedAt rejectedAt userId canAccessAdminPanel isGestore gameplayRoles characterPermissions adminPermissions age gender socialClass location')
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
          playerStatus: char.playerStatus || 'draft',
          isGestore: char.isGestore || false,
          gameplayRoles: char.gameplayRoles || [],
          characterPermissions: char.characterPermissions || [],
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
        page,
        totalPages,
        totalItems,
        pageSize,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed all characters', {
        ...auditInfo,
        page,
        pageSize,
        statusFilter: statusFilter || 'all',
        totalResults: transformedCharacters.length,
        totalItems,
        category: 'character_management'
      });

      res.json(listResponse(
        transformedCharacters as any,
        paginationInfo,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
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
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const priority = req.query.priority as string;
      const sortBy = req.query.sortBy as string || 'submittedAt';
      const sortOrder = req.query.sortOrder as string || 'desc';

      // TODO: Implement database query
      const mockCharacters: PendingCharacter[] = [
        {
          id: '1',
          name: 'John Smith',
          playerUsername: 'player1',
          playerEmail: 'player1@example.com',
          submittedAt: '2024-01-01T10:00:00Z',
          occupation: 'Doctor',
          socialClass: 'middle_class',
          age: 35,
          gender: 'male',
          stats: {
            forza: 60,
            destrezza: 70,
            intelligenza: 85,
            costituzione: 65,
            aspetto: 70,
            potere: 60,
            taglia: 65,
            educazione: 90,
            status_sociale: 75
          } as any,
          skills: {
            'First Aid': 80,
            'Medicine': 90,
            'Psychology': 60
          },
          background: 'A Victorian doctor practicing in London',
          description: 'Tall, well-dressed gentleman with a kind demeanor',
          equipment: ['Medical Bag', 'Stethoscope', 'Morphine'],
          aiGenerated: true,
          reviewPriority: 'normal'
        }
      ];

      const mockPagination: PaginationInfo = {
        page,
        totalPages: 1,
        totalItems: mockCharacters.length,
        pageSize: limit,
        hasNextPage: false,
        hasPrevPage: false
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed pending characters', {
        ...auditInfo,
        filters: { priority, sortBy, sortOrder },
        page,
        limit
      });

      res.json(listResponse(
        mockCharacters,
        mockPagination,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
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
      const { Item } = await import('@database/models/Item');
      const { Occupation } = await import('@database/models/Occupation');
      const { User } = await import('@database/models/User');
      
      // Get character with populated user data
      const character = await Character.findById(characterId)
        .populate({
          path: 'userId',
          select: 'username email displayName userRoles',
          options: { strictPopulate: false }
        })
        .lean()
        .exec() as any;

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
            .lean() as any;

          // If occupation has startingItems, populate them too
          if (occupationDetails?.benefits?.startingItems && occupationDetails.benefits.startingItems.length > 0) {
            const itemIds = occupationDetails.benefits.startingItems.map((item: any) => item.itemId);
            const startingItemsData = await Item.find({ 
              _id: { $in: itemIds } 
            }).select('name description category basePrice properties').lean() as any;
            
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
          }).select('name description category basePrice properties').lean() as any;
          
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
    } catch (error: any) {
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
    } catch (error: any) {
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
      const { Occupation } = await import('@database/models/Occupation');
      
      // Get character in PENDING_APPROVAL status - force fresh read
      const character = await Character.findOne({
        _id: characterId,
        playerStatus: 'pending'
      }).lean(false) as any;

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
        const { CharacterFinances, SocialClassConfig } = await import('@database/models');
        
        // Get character's Finanza skill value from Mongoose Map
        // Handle both Map and object formats, and granular SkillBreakdown objects
        let finanzaSkill = 1; // Default fallback
        
        if (character.skills instanceof Map) {
          const finanzaValue = character.skills.get('Finanza') || character.skills.get('FINANZA') || character.skills.get('finanza');
          if (typeof finanzaValue === 'object' && finanzaValue !== null && 'total' in finanzaValue) {
            finanzaSkill = (finanzaValue as any).total;
          } else if (typeof finanzaValue === 'number') {
            finanzaSkill = finanzaValue;
          }
        } else if (character.skills && typeof character.skills === 'object') {
          const finanzaValue = (character.skills as any)['Finanza'] || (character.skills as any)['FINANZA'] || (character.skills as any)['finanza'];
          if (typeof finanzaValue === 'object' && finanzaValue !== null && 'total' in finanzaValue) {
            finanzaSkill = finanzaValue.total;
          } else if (typeof finanzaValue === 'number') {
            finanzaSkill = finanzaValue;
          }
        }
        
        // Ensure finanzaSkill is a valid number
        finanzaSkill = Math.max(1, Math.min(99, finanzaSkill || 1));
        
        logger.info('Character FINANZA skill value for approval', {
          characterId: character._id.toString(),
          characterName: character.name,
          finanzaSkill,
          skillsType: character.skills instanceof Map ? 'Map' : typeof character.skills
        });
        
        // Find social class configuration based on FINANZA skill range
        const socialClassConfig = await SocialClassConfig.findOne({
          minFinanceSkill: { $lte: finanzaSkill },
          maxFinanceSkill: { $gte: finanzaSkill }
        });
        
        if (!socialClassConfig) {
          throw new Error(`No social class found for FINANZA skill: ${finanzaSkill}`);
        }
        
        const socialClassName = socialClassConfig!.name;
        
        // Calculate initial wealth (random between min and max)
        const minWealth = socialClassConfig!.initialWealth?.minCash || 240;
        const maxWealth = socialClassConfig!.initialWealth?.maxCash || 240;
        const baseWealth = Math.floor(Math.random() * (maxWealth - minWealth + 1)) + minWealth;
        
        // Create CharacterFinances record - Always delete existing and recreate for security
        await CharacterFinances.deleteOne({ characterId: character._id });
        
        // Create new CharacterFinances record
        const characterFinances = new CharacterFinances({
          characterId: character._id,
          socialClass: socialClassName,
          financeSkillValue: finanzaSkill,
          cash: Math.floor(baseWealth * 0.3), // 30% in cash
          bankDeposit: Math.floor(baseWealth * 0.7), // 70% in bank
          creditLine: {
            maxWeekly: socialClassConfig!.weeklyCredit, // Use configured weekly credit
            currentAvailable: socialClassConfig!.weeklyCredit,
            lastResetDate: new Date(),
            nextResetDate: CharacterApprovalController.getNextSunday()
          },
          properties: [],
          lastCalculated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        await characterFinances.save();
        
        logger.info('CharacterFinances created on approval', {
          characterId: character._id.toString(),
          characterName: character.name,
          socialClass: socialClassName,
          finanzaSkill,
          initialWealth: baseWealth,
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
      } catch (redisError: any) {
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
    } catch (error: any) {
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
      const period = req.query.period as 'day' | 'week' | 'month' | 'year' || 'week';

      // TODO: Implement database queries for stats
      const mockStats: ReviewStats = {
        period,
        stats: {
          totalReviewed: 45,
          approved: 38,
          rejected: 5,
          changesRequested: 2,
          approvalRate: 84.4,
          avgReviewTime: '2h 15m',
          byReviewer: [
            {
              reviewerId: 'admin1',
              reviewerName: 'Admin User',
              totalReviewed: 25,
              approved: 22,
              rejected: 2,
              changesRequested: 1,
              avgReviewTime: '1h 45m'
            }
          ],
          byCategory: {
            aiGenerated: 30,
            manualCreated: 15
          },
          commonRejectionReasons: [
            { reason: 'Inappropriate background', count: 3 },
            { reason: 'Stats too high', count: 2 }
          ]
        }
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed review statistics', {
        ...auditInfo,
        period
      });

      res.json(successResponse(
        mockStats,
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
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

      // TODO: Update priority in database

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
    } catch (error: any) {
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
    } catch (error: any) {
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

      const { Character, Occupation, CharacterFinances, SocialClassConfig } = await import('@database/models');
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
          }).lean(false) as any;

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
          let finanzaSkill = 1;
          if (character.skills && character.skills.size > 0) {
            const finanzaData = character.skills.get('FINANZA');
            if (finanzaData && typeof finanzaData === 'object' && 'value' in finanzaData) {
              finanzaSkill = finanzaData.value || 1;
            }
          }

          const socialClass = await SocialClassConfig.findOne({ skillValue: finanzaSkill });
          const initialBalance = socialClass?.initialBalance || 50;

          // Create finances record
          await CharacterFinances.create({
            characterId: character._id,
            currentBalance: initialBalance,
            initialBalance,
            totalEarned: initialBalance,
            totalSpent: 0,
            lastUpdated: new Date()
          });

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
            finanzaSkill,
            initialBalance
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
    } catch (error: any) {
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
          }).lean(false) as any;

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
    } catch (error: any) {
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
    } catch (error: any) {
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
    } catch (error: any) {
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

}