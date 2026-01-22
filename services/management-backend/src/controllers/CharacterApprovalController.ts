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
import { getRedisClient } from '../config/redis';

export class CharacterApprovalController {
  /**
   * Get all characters with pagination and optional filtering
   * GET /admin/characters
   */
  static async getAllCharacters(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 25;
      const status = req.query.status as string;
      
      const skip = (page - 1) * pageSize;
      
      // Build query filter
      let filter: any = {};
      if (status && ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DELETED'].includes(status)) {
        filter.status = status;
      }

      // Use local model with proper imports
      const { Character } = await import('../models/Character');
      
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
          .select('name surname occupation status createdAt submittedAt approvedAt rejectedAt userId')
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
          id: char._id.toString(),
          characterName: char.name || 'Unnamed',
          characterSurname: char.surname || '',
          userId: userIdString,
          username: username,
          email: email,
          occupation: char.occupation || 'None',
          status: char.status || 'DRAFT',
          createdAt: char.createdAt ? char.createdAt.toISOString() : new Date().toISOString(),
          submittedAt: char.submittedAt ? char.submittedAt.toISOString() : null,
          approvedAt: char.approvedAt ? char.approvedAt.toISOString() : null,
          rejectedAt: char.rejectedAt ? char.rejectedAt.toISOString() : null
        };
      });

      const totalPages = Math.ceil(totalItems / pageSize);
      const hasMore = page < totalPages;

      const paginationInfo: PaginationInfo = {
        currentPage: page,
        totalPages,
        totalItems,
        limit: pageSize,
        hasMore
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed all characters', {
        ...auditInfo,
        page,
        pageSize,
        statusFilter: status || 'all',
        totalResults: transformedCharacters.length,
        totalItems,
        category: 'character_management'
      });

      const response: ApiResponse<{ characters: Character[]; pagination: PaginationInfo }> = {
        success: true,
        data: {
          characters: transformedCharacters as any,
          pagination: paginationInfo
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error in getAllCharacters method:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params
      });
      
      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Impossibile recuperare i personaggi',
        code: 'FETCH_ALL_CHARACTERS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
          socialClass: 'middle',
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
        currentPage: page,
        totalPages: 1,
        totalItems: mockCharacters.length,
        limit,
        hasMore: false
      };

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed pending characters', {
        ...auditInfo,
        filters: { priority, sortBy, sortOrder },
        page,
        limit
      });

      const response: ApiResponse<{ characters: PendingCharacter[]; pagination: PaginationInfo }> = {
        success: true,
        data: {
          characters: mockCharacters,
          pagination: mockPagination
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching pending characters:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare i personaggi in attesa',
        code: 'FETCH_PENDING_CHARACTERS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Get complete character details with populated references
   * GET /admin/characters/:characterId
   */
  static async getCharacterDetails(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.params.characterId;
      
      // Use local and shared models with proper imports
      const { Character } = await import('../../../../packages/database/models/Character');
      const { Item } = await import('../../../../packages/database/models/Item');
      const { Occupation } = await import('../../../../packages/database/models/Occupation');
      const { User } = await import('../../../../packages/database/models/User');
      
      // Get character with populated user data
      const character = await Character.findById(characterId)
        .populate({
          path: 'userId',
          select: 'username email displayName canAccessAdminPanel userRoles characterRoles',
          options: { strictPopulate: false }
        })
        .lean()
        .exec() as any;

      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
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
            }).select('name description category basePrice rarity properties').lean() as any;
            
            occupationStartingItems = occupationDetails.benefits.startingItems.map((startingItem: any) => {
              const itemData = startingItemsData.find((item: any) => item._id.toString() === startingItem.itemId.toString());
              if (itemData) {
                return {
                  id: itemData._id.toString(),
                  name: itemData.name,
                  description: itemData.description,
                  category: itemData.category,
                  basePrice: itemData.basePrice,
                  rarity: itemData.rarity,
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
          }).select('name description category basePrice rarity properties').lean() as any;
          
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
                rarity: itemData.rarity,
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
        status: character.status || 'DRAFT',
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
        motivations: character.motivations || '',
        fears: character.fears || '',
        backgroundResponses: character.backgroundResponses || [],
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
        characterStatus: transformedCharacter.status,
        hasOccupationDetails: !!occupationDetails,
        characterEquipmentCount: equipmentDetails.length,
        occupationStartingItemsCount: occupationStartingItems.length,
        totalEquipmentCount: allEquipment.length,
        category: 'character_management'
      });

      const response: ApiResponse<any> = {
        success: true,
        data: {
          character: transformedCharacter
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching character details:', { 
        error: error instanceof Error ? error.message : String(error), 
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        characterId: req.params.characterId,
        query: req.query,
        params: req.params
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare i dettagli del personaggio',
        code: 'FETCH_CHARACTER_DETAILS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * Submit approval decision for a character
   * POST /admin/characters/:characterId/approve
   */
  static async submitCharacterReview(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.params.characterId;
      const { action, note } = req.body;

      // Validate review data
      if (!action || !['approve', 'reject'].includes(action)) {
        const response: ApiResponse = {
          success: false,
          error: 'Azione di revisione non valida. Deve essere "approve" o "reject"',
          code: 'INVALID_REVIEW_ACTION',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      if (!note || note.trim().length === 0) {
        const response: ApiResponse = {
          success: false,
          error: 'La nota di revisione è richiesta',
          code: 'REVIEW_NOTE_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Use local and shared models with proper imports
      const { Character } = await import('../../../../packages/database/models/Character');
      const { Occupation } = await import('../../../../packages/database/models/Occupation');
      
      // Get character in PENDING_APPROVAL status - force fresh read
      const character = await Character.findOne({
        _id: characterId,
        status: 'PENDING_APPROVAL'
      }).lean(false) as any;

      if (!character) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non trovato o non in attesa di approvazione',
          code: 'CHARACTER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      if (!auditInfo) {
        const response: ApiResponse = {
          success: false,
          error: 'Autenticazione richiesta',
          code: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
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
        const { CharacterFinances, SocialClassConfig } = await import('../../../../packages/database/models');
        
        // Get character's Finanza skill value from Mongoose Map
        const finanzaSkill = character.skills?.get('Finanza') || 1;
        
        // DEBUG: Log skill reading with Mongoose Map methods
        const debugData = {
          characterId: character._id.toString(),
          characterName: character.name,
          hasSkills: !!character.skills,
          finanzaSkill,
          allFinanzaVariants: {
            'Finanza': character.skills?.get('Finanza'),
            'FINANZA': character.skills?.get('FINANZA'),
            'finanza': character.skills?.get('finanza')
          },
          skillKeys: character.skills ? Array.from(character.skills.keys()).slice(0, 10) : []
        };
        
        logger.info('DEBUG: Character skills MAP reading - ' + JSON.stringify(debugData, null, 2));
        
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
        character.status = 'APPROVED';
        character.approvedAt = new Date();
        character.approvedBy = auditInfo!.adminId; // Set who approved
        character.gameplayRoles = ['personaggio']; // Assign default gameplay role
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
        character.status = 'DRAFT';
        character.rejectedAt = new Date();
        character.rejectedBy = auditInfo.adminId; // Set who rejected
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
        await getRedisClient().publish('character:review_completed', eventJson);
        
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

      const response: ApiResponse<any> = {
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error submitting character review:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        characterId: req.params.characterId,
        requestBody: req.body,
        auditInfo: AdminAuthMiddleware.getAuditInfo(req)
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile inviare la revisione del personaggio',
        code: 'SUBMIT_CHARACTER_REVIEW_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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

      const response: ApiResponse<ReviewStats> = {
        success: true,
        data: mockStats,
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error fetching review stats:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        query: req.query,
        params: req.params
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare le statistiche di revisione',
        code: 'FETCH_REVIEW_STATS_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
  static async updateReviewPriority(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.params.characterId;
      const { priority } = req.body;

      if (!priority || !['high', 'normal', 'low'].includes(priority)) {
        const response: ApiResponse = {
          success: false,
          error: 'Valore di priorità non valido',
          code: 'INVALID_PRIORITY',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
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

      const response: ApiResponse<{ characterId: string; priority: string }> = {
        success: true,
        data: {
          characterId,
          priority
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error updating review priority:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        characterId: req.params.characterId,
        requestBody: req.body,
        params: req.params
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile aggiornare la priorità di revisione',
        code: 'UPDATE_PRIORITY_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
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
      const { Character } = await import('../models/Character');

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

      const response: ApiResponse<{
        characters: any[];
        count: number;
        totalPending: number;
      }> = {
        success: true,
        data: {
          characters: transformedCharacters,
          count: transformedCharacters.length,
          totalPending
        },
        timestamp: new Date().toISOString()
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Error getting pending characters for review:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare i personaggi in attesa',
        code: 'GET_PENDING_CHARACTERS_ERROR',
        timestamp: new Date().toISOString()
      };

      res.status(500).json(response);
    }
  }
}