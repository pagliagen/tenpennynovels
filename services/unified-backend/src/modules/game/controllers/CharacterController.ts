import { Request, Response } from 'express';
import { Character, Occupation, Skill } from '@database/models';
import { logger } from '../utils/logger';
import { successResponse, errorResponse, createResponse, updateResponse, deleteResponse, getRequestId } from '../utils/apiResponse';
import { CharacterVisibilityFilter } from '@shared/utils/characterVisibility';
import { FinancialUtils } from '../utils/financialUtils';
import { CharacterCreationConfigService } from '@shared/services/CharacterCreationConfigService';

/**
 * CharacterController
 *
 * ✅ SPRINT 2 REFACTORING: Consolidation of CharacterController god object (1964 lines)
 *
 * Handles all character CRUD operations, retrieval, updates, and bot character creation.
 * This is the CLEAN version replacing the monolite CharacterController.
 */
export class CharacterController {
  /**
   * POST /characters/create
   * Create new character
   */
  static async createCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { concept, preferredOccupation, preferredBackground, preferredSocialClass } = req.body;
      const userId = req.user!.userId;

      // Create a basic character structure
      const character = new Character({
        userId,
        name: 'New Character',
        status: 'DRAFT',
        concept,
        preferredOccupation,
        preferredBackground,
        preferredSocialClass,
        stats: {
          strength: 50,
          dexterity: 50,
          intelligence: 50,
          constitution: 50,
          appearance: 50,
          power: 50,
          size: 50,
          education: 50
        },
        skills: {},
        gameplayRoles: ['personaggio'],
        isActive: false
      });

      await character.save();

      logger.info('Character created', {
        characterId: character.id,
        userId,
        concept
      });

      res.status(201).json(createResponse(
        {
          character: {
            id: character.id,
            name: character.name,
            status: character.status,
            stats: character.stats,
            skills: character.skills,
            occupation: character.occupation,
            background: character.background,
            description: character.description
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Character creation error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });

      res.status(500).json(errorResponse(
        'Impossibile creare il personaggio',
        'CHARACTER_CREATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /characters/my
   * Get user's characters
   */
  static async getMyCharacters(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      const characters = await (Character.find({
        userId,
        status: { $ne: 'DELETED' }
      }) as any)
        .select('id name status occupation isActive currentLocation gameplayRoles submittedAt lastActive')
        .sort({ createdAt: -1 });

      res.json(successResponse(
        {
          characters: characters.map((char: any) => ({
            id: char.id,
            name: char.name,
            status: char.status,
            occupation: char.occupation,
            isActive: char.isActive,
            currentLocation: char.currentLocation,
            gameplayRoles: char.gameplayRoles,
            submittedAt: char.submittedAt,
            lastActive: char.lastActive
          }))
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get characters error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare i personaggi',
        'GET_CHARACTERS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /characters/public-list
   * Get list of all characters (including isOwnCharacter flag for filtering)
   */
  static async getPublicCharactersList(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = req.user!.userId;

      // Get all characters that are not deleted (include all users' characters)
      const characters = await (Character.find({
        status: { $ne: 'DELETED' } // Exclude only deleted characters
      })
      .select('_id name surname avatar status userId lastActive')
      .sort({ name: 1 })
      .limit(200) as any); // Increased limit for complete list

      // Activity timeout: 5 minutes (same as global presence logic)
      const activityTimeout = 5 * 60 * 1000; // 5 minutes in milliseconds
      const cutoffTime = new Date(Date.now() - activityTimeout);

      // Transform for frontend
      const charactersList = characters.map((character: any) => {
        const isOnline = character.lastActive && character.lastActive >= cutoffTime;

        return {
          id: character._id.toString(),
          name: character.name,
          surname: character.surname,
          avatar: character.avatar,
          status: character.status,
          isOwnCharacter: character.userId.toString() === currentUserId,
          isOnline: Boolean(isOnline)
        };
      });

      logger.info('Public characters list requested', {
        requesterId: currentUserId,
        charactersFound: charactersList.length
      });

      res.json(successResponse(
        {
          characters: charactersList
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get public characters list error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare la lista dei personaggi',
        'GET_CHARACTERS_LIST_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * DELETE /characters/:characterId
   * Delete character (only if DRAFT)
   */
  static async deleteCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      const character = await (Character.findOne({
        _id: characterId,
        userId: userId,
        status: 'DRAFT'
      }) as any);

      if (!character) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato o non può essere eliminato',
          'CHARACTER_NOT_DELETABLE',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Soft delete (marks as deleted, keeps data for audit trail)
      await character.softDelete(userId);

      logger.info('Character soft deleted', {
        characterId,
        userId,
        name: character.name,
        deletedAt: character.deletedAt
      });

      res.json(deleteResponse(
        'Personaggio eliminato con successo',
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Character delete error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });

      res.status(500).json(errorResponse(
        'Impossibile eliminare il personaggio',
        'CHARACTER_DELETE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  // ========================================================================
  // BOT CHARACTER CREATION
  // ========================================================================

  /**
   * POST /characters/bot/create
   * Create bot character (basic)
   */
  static async createBotCharacter(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        surname,
        physicalDescription,
        publicDescription,
        privateDescription,
        background,
        stats,
        gender = 'male',
        bot_id
      } = req.body;

      // Validate required fields
      if (!name || !bot_id) {
        res.status(400).json(errorResponse(
          'name and bot_id are required',
          'MISSING_REQUIRED_FIELDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Get system bot user ID
      const systemBotUserId = process.env.SYSTEM_BOT_USER_ID;
      if (!systemBotUserId) {
        res.status(500).json(errorResponse(
          'SYSTEM_BOT_USER_ID not configured',
          'SYSTEM_BOT_NOT_CONFIGURED',
          undefined,
          500,
          getRequestId(req)
        ));
        return;
      }

      // Prepare default stats if not provided
      const defaultStats = {
        strength: 50,
        constitution: 50,
        size: 50,
        dexterity: 50,
        charm: 50,
        intelligence: 50,
        power: 50,
        education: 50
      };

      const characterStats = stats || defaultStats;

      // Calculate derived stats
      const configService = CharacterCreationConfigService.getInstance();
      const config = await configService.loadConfig();
      const { calculateAllDerivedStats } = await import('@shared/services/CharacterCreationConfigService');
      const derived = calculateAllDerivedStats(characterStats, config);

      // Create bot character with preapproved status
      const character = await Character.create({
        name,
        surname: surname || '',
        age: 30, // Default for bots
        apparentAge: 30,
        physicalDescription: physicalDescription || 'Un personaggio misterioso',
        birthPlace: 'London',
        publicDescription: publicDescription || 'Un personaggio non giocante',
        privateDescription: privateDescription || 'Personaggio bot gestito da AI',
        gender,
        userId: systemBotUserId,
        status: 'APPROVED', // Preapproved
        gameplayRoles: ['personaggio'],
        bot_id, // Link to bot in botai database
        stats: characterStats,
        derived,
        skills: new Map(),
        background: background || {},
        equipment: [],
        isActive: false,
        lastActive: new Date(),
        approvedBy: systemBotUserId,
        approvedAt: new Date()
      });

      logger.info(`Bot character created: ${character._id} (${character.name}) for bot_id ${bot_id}`);

      res.status(201).json(createResponse(
        { characterId: character._id.toString() },
        'Bot character created successfully',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Create bot character error:', error);
      res.status(500).json(errorResponse(
        'Failed to create bot character',
        'BOT_CHARACTER_CREATE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /characters/bot/complete
   * Create COMPLETE bot character with full stats, skills, occupation, background
   */
  static async createCompleteBotCharacter(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        surname,
        bot_id,
        stats,
        skills,
        occupation,
        background,
        demographics,
        gender = 'male',
        campaign_id
      } = req.body;

      // Validate required fields
      if (!name || !bot_id || !stats || !skills || !occupation) {
        res.status(400).json(errorResponse(
          'name, bot_id, stats, skills, and occupation are required',
          'MISSING_REQUIRED_FIELDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Get system bot user ID
      const systemBotUserId = process.env.SYSTEM_BOT_USER_ID;
      if (!systemBotUserId) {
        res.status(500).json(errorResponse(
          'SYSTEM_BOT_USER_ID not configured',
          'SYSTEM_BOT_NOT_CONFIGURED',
          undefined,
          500,
          getRequestId(req)
        ));
        return;
      }

      logger.info(`[CreateCompleteBot] Creating complete bot character: ${name}`);
      logger.info(`[CreateCompleteBot] Stats total: ${Object.values(stats).reduce((sum: number, val: any) => sum + val, 0)}`);
      logger.info(`[CreateCompleteBot] Skills count: ${Object.keys(skills).length}`);
      logger.info(`[CreateCompleteBot] Occupation: ${occupation.name}`);

      // Calculate derived stats
      const configService = CharacterCreationConfigService.getInstance();
      const config = await configService.loadConfig();
      const { calculateAllDerivedStats } = await import('@shared/services/CharacterCreationConfigService');
      const derived = calculateAllDerivedStats(stats, config);

      // Convert skills map to Map object with full breakdown
      const skillsMap = new Map();
      for (const [skillName, breakdown] of Object.entries(skills)) {
        const skillBreakdown = breakdown as any;
        skillsMap.set(skillName, {
          total: skillBreakdown.total,
          base: skillBreakdown.base,
          requiredBonus: skillBreakdown.requiredBonus || 0,
          manualPoints: skillBreakdown.manualPoints || 0,
          occupationBonus: skillBreakdown.occupationBonus || 0,
          category: skillBreakdown.category
        });
      }

      logger.info(`[CreateCompleteBot] Skills map created with ${skillsMap.size} skills`);

      // Prepare occupation reference
      let occupationRef;
      if (occupation._id) {
        occupationRef = {
          _id: occupation._id,
          name: occupation.name
        };
      }

      // Prepare complete background
      const completeBackground = background || {};

      // Prepare demographics with defaults
      const age = demographics?.age || 30;
      const height = demographics?.height || '170 cm';
      const weight = demographics?.weight || '70 kg';
      const eyeColor = demographics?.eyeColor || 'brown';
      const hairColor = demographics?.hairColor || 'brown';
      const physicalDescription = demographics?.physicalDescription || 'Un personaggio misterioso';
      const publicDescription = demographics?.publicDescription || physicalDescription;
      const privateDescription = demographics?.privateDescription || 'Personaggio bot gestito da AI';

      // Create complete bot character
      const character = await Character.create({
        name,
        surname: surname || '',
        age,
        apparentAge: age,
        height,
        weight,
        eyeColor,
        hairColor,
        physicalDescription,
        birthPlace: 'London',
        publicDescription,
        privateDescription,
        gender,
        userId: systemBotUserId,
        status: 'APPROVED', // Preapproved
        gameplayRoles: ['personaggio'],
        bot_id, // Link to bot in botai database
        stats,
        derived,
        skills: skillsMap,
        currentOccupation: occupationRef,
        background: completeBackground,
        equipment: [],
        isActive: false,
        lastActive: new Date(),
        approvedBy: systemBotUserId,
        approvedAt: new Date(),
        campaign_id: campaign_id || undefined
      });

      logger.info(`[CreateCompleteBot] ✅ Complete bot character created successfully: ${character._id} (${character.name})`);
      logger.info(`[CreateCompleteBot] Stats total: ${Object.values(character.stats).reduce((sum: number, val: any) => sum + val, 0)}`);
      logger.info(`[CreateCompleteBot] Skills count: ${character.skills.size}`);
      logger.info(`[CreateCompleteBot] Occupation: ${character.currentOccupation?.name || 'None'}`);

      res.status(201).json(createResponse(
        { characterId: character._id.toString() },
        'Complete bot character created successfully',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('[CreateCompleteBot] Error:', error);
      res.status(500).json(errorResponse(
        'Failed to create complete bot character',
        'COMPLETE_BOT_CHARACTER_CREATE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
  static async getCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      logger.info('Getting character', { characterId, userId });

      // Determina se l'utente è un master (controlla i ruoli dal token)
      const isMaster = req.character?.gameplayRoles?.includes('master') || 
                       req.character?.gameplayRoles?.includes('gestore') || false;

      logger.info('User roles check', { isMaster, gameplayRoles: req.character?.gameplayRoles });

      const character = await (Character.findOne({
        _id: characterId,
        status: { $ne: 'DELETED' }
      }) as any);

      logger.info('Character found', { found: !!character, characterName: character?.name });

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

      // Determina se è il proprietario del personaggio
      const isOwner = character.userId.toString() === userId;

      logger.info('Ownership check', { isOwner, characterUserId: character.userId.toString(), requestUserId: userId });

      // Converti il documento Mongoose in JSON per eliminare i metadati
      const characterJson = character.toJSON();

      // Converti skills Map in oggetto JavaScript (keys are ObjectId strings, not skill names)
      // Example: "699f40ffe64a58b319bbb170" → {total: 60, base: 10, manualPoints: 50, ...}
      if (character.skills && character.skills instanceof Map) {
        const skillsObj: any = {};
        character.skills.forEach((value: any, key: any) => {
          skillsObj[key] = value; // Preserve ObjectId key as-is
        });
        characterJson.skills = skillsObj;
      } else if (!characterJson.skills || Object.keys(characterJson.skills).length === 0) {
        // Se skills è vuoto o non esiste, inizializzalo come oggetto vuoto
        characterJson.skills = {};
      }

      // Aggiungi il nome dell'occupazione e professional skills se presente
      if (character.occupation) {
        const { Occupation, Skill } = require('../../../database/models');
        let occupation = null;
        
        // Verifica se l'occupazione è un ObjectId valido o una stringa
        // Nota: skillId nello schema è String, non ObjectId ref, quindi non serve populate
        try {
          // Prima prova a cercare per ID
          occupation = await Occupation.findById(character.occupation);
        } catch (error: any) {
          logger.warn('Failed to find occupation by ID, trying by name:', { occupation: character.occupation, error: error.message });
          // Se fallisce, prova a cercare per nome
          if (typeof character.occupation === 'string') {
            occupation = await Occupation.findOne({ name: character.occupation });
            if (occupation) {
              logger.info('Found occupation by name, updating character with correct ObjectId', { 
                characterId: character._id, 
                oldOccupation: character.occupation, 
                newOccupationId: occupation._id 
              });
              // Aggiorna il personaggio con l'ObjectId corretto
              character.occupation = occupation._id;
              await character.save();
            }
          }
        }
        
        if (occupation) {
          characterJson.occupationName = occupation.name;
          characterJson.occupationData = occupation.toJSON(); // Include all occupation data for the wizard (with populated skills)
          
          // Converti professional skills da ID a nomi per evidenziazione frontend
          if (occupation.benefits && occupation.benefits.professionalSkills) {
            const skillIds = occupation.benefits.professionalSkills;
            const skills = await Skill.find({ _id: { $in: skillIds } });
            characterJson.professionalSkillNames = skills.map((skill: any) => skill.name);
          }
        } else {
          logger.warn('Occupation not found for character', { characterId: character._id, occupation: character.occupation });
        }
      }

      // Popula gli oggetti dell'equipaggiamento con i dettagli completi
      if (characterJson.equipment && characterJson.equipment.length > 0) {
        const { Item } = require('../../../database/models');
        const equipmentItems = await Item.find({ _id: { $in: characterJson.equipment } });
        
        // Sostituisce gli ID con gli oggetti completi
        characterJson.equipment = equipmentItems.map((item: any) => ({
          id: item._id.toString(),
          itemId: item._id.toString(),
          name: item.name,
          description: item.description,
          category: item.category,
          rarity: item.rarity,
          quantity: 1 // Default quantity
        }));

        logger.info('Equipment populated', { 
          characterId, 
          equipmentCount: characterJson.equipment.length,
          items: characterJson.equipment.map((item: any) => item.name)
        });
      }

      // Applica le regole di visibilità
      let filteredCharacter;
      try {
        if (isOwner) {
          // Il proprietario può vedere tutti i dati - restituisci tutto il JSON
          logger.info('Returning full character data for owner', {
            characterId,
            hasBirthDate: !!characterJson.birthDate,
            hasBackground: !!characterJson.background,
            hasBackgroundGoals: !!characterJson.background?.goalsAndMotivations,
            hasBackgroundFears: !!characterJson.background?.fearsAndPhobias,
            hasStats: !!characterJson.stats,
            backgroundKeys: characterJson.background ? Object.keys(characterJson.background) : []
          });
          filteredCharacter = characterJson;
        } else {
          // Altri utenti vedono solo quello che sono autorizzati a vedere
          logger.info('Filtering character for other user', { isMaster });
          filteredCharacter = CharacterVisibilityFilter.filterCharacter(
            characterJson,
            userId,
            isMaster
          );
        }
        logger.info('Character filtering completed');
      } catch (filterError) {
        logger.error('Character filtering error', { 
          error: (filterError as Error).message,
          stack: (filterError as Error).stack,
          name: (filterError as Error).name,
          characterId: req.character?.characterId,
          params: req.params,
          query: req.query
        });
        throw filterError;
      }

      res.json(successResponse(
        {
          character: {
            ...filteredCharacter,
            isOwnCharacter: isOwner
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get character error:', { 
        message: err.message, 
        stack: err.stack,
        characterId: req.params.characterId,
        userId: req.user?.userId
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare il personaggio',
        'GET_CHARACTER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * GET /characters/:characterId?view=sheet
   * Get character sheet data with permissions for window display
   *
   * Returns enriched character data with permission flags for conditional rendering
   * in character sheet windows.
   */
  static async getCharacterSheet(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;

      logger.info('Getting character sheet', { characterId, userId });

      // Fetch character
      const character = await Character.findOne({
        _id: characterId,
        status: { $ne: 'DELETED' }
      }).populate('occupation').lean();

      if (!character) {
        return void res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
      }

      // Determine permissions
      const isOwner = character.userId.toString() === userId;
      const isMaster = req.character?.gameplayRoles?.includes('master') ||
                       req.character?.gameplayRoles?.includes('gestore') || false;

      const permissions = {
        isOwner,
        canViewPrivateBackground: isOwner || isMaster,
        canViewReviewHistory: isOwner || isMaster,
        canViewFullInventory: isOwner,
        canViewSkillBreakdown: isOwner,
        canEdit: isOwner && character.status === 'DRAFT'
      };

      // Serialize skills Map to object
      let serializedSkills: Record<string, any> = {};
      if (character.skills) {
        if (character.skills instanceof Map) {
          character.skills.forEach((value: any, key: string) => {
            serializedSkills[key] = value;
          });
        } else {
          serializedSkills = character.skills as Record<string, any>;
        }
      }

      // Fetch skill names from Skill model
      const skillIds = Object.keys(serializedSkills);
      const skills = await Skill.find({ _id: { $in: skillIds } }).select('_id name').lean();

      // Create skill ID to name mapping
      const skillNameMap: Record<string, string> = {};
      skills.forEach((skill: any) => {
        skillNameMap[skill._id.toString()] = skill.name;
      });

      // Add skill names to serialized skills
      serializedSkills = Object.fromEntries(
        Object.entries(serializedSkills).map(([skillId, skillData]) => [
          skillId,
          {
            ...(typeof skillData === 'object' ? skillData : { total: skillData }),
            name: skillNameMap[skillId] || skillId // Use skill name from DB or fallback to ID
          }
        ])
      );

      // Determine visible skills (for non-owners)
      const visibleSkills: string[] = isOwner
        ? Object.keys(serializedSkills)
        : Object.entries(serializedSkills)
            .filter(([_, skillData]: [string, any]) => {
              // Show professional skills (occupationBonus > 0) or skills above 40%
              return (skillData.occupationBonus > 0) || (skillData.total >= 40);
            })
            .map(([skillId]) => skillId);

      // Determine visible equipment (for non-owners)
      const visibleEquipment: string[] = isOwner
        ? (character.equipment || []).map((e: any) => e._id.toString())
        : (character.equipment || [])
            .filter((e: any) => e.visible !== false)
            .map((e: any) => e._id.toString());

      // Map background fields to frontend-expected structure
      const publicBackground = character.background?.briefHistory ||
                               character.publicDescription ||
                               character.description ||
                               undefined;

      const privateBackground = character.background?.significantEvents ||
                                character.privateDescription ||
                                undefined;

      const motivations = character.background?.goalsAndMotivations ||
                          character.motivations ||
                          undefined;

      const fears = character.background?.fearsAndPhobias ||
                    character.fears ||
                    undefined;

      const traumas = undefined; // Not in current schema

      const beliefSystem = character.background?.ideology ||
                           undefined;

      const bonds = character.background?.importantRelationships ||
                    undefined;

      const secrets = character.background?.secrets ||
                      undefined;

      // Build response
      const responseData = {
        character: {
          ...character,
          skills: serializedSkills,
          // Add frontend-expected background fields
          publicBackground,
          privateBackground,
          motivations,
          fears,
          traumas,
          beliefSystem,
          bonds,
          secrets
        },
        permissions,
        visibleSkills,
        visibleEquipment
      };

      logger.info('Character sheet retrieved', {
        characterId,
        isOwner,
        isMaster,
        visibleSkillsCount: visibleSkills.length,
        visibleEquipmentCount: visibleEquipment.length
      });

      res.status(200).json(successResponse(
        responseData,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Character sheet retrieval error:', {
        message: err.message,
        stack: err.stack,
        characterId: req.params.characterId,
        userId: req.user?.userId
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare la scheda del personaggio',
        'GET_CHARACTER_SHEET_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  static async getPublicCharacter(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const userId = req.user!.userId;
      
      // Determina se l'utente è un master (controlla i ruoli dal token)
      const isMaster = req.character?.gameplayRoles?.includes('master') || 
                       req.character?.gameplayRoles?.includes('gestore') || false;

      const character = await (Character.findOne({
        _id: characterId,
        status: { $ne: 'DELETED' } // Exclude only deleted characters
      }) as any);

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

      // Determina se è il proprietario del personaggio
      const isOwner = character.userId.toString() === userId;

      // Converti il documento Mongoose in JSON per eliminare i metadati
      const characterJson = character.toJSON();

      // Applica le regole di visibilità
      let filteredCharacter;
      if (isOwner) {
        // Il proprietario può vedere tutti i dati - restituisci tutto il JSON
        filteredCharacter = characterJson;
      } else {
        // Altri utenti vedono solo quello che sono autorizzati a vedere
        filteredCharacter = CharacterVisibilityFilter.filterCharacter(
          characterJson, 
          userId, 
          isMaster
        );
      }

      res.json(successResponse(
        {
          character: filteredCharacter
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get public character error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare il personaggio',
        'GET_PUBLIC_CHARACTER_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
  static async updateCharacter(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.params.characterId as string;
      const userId = req.user!.userId;
      const updates = req.body;

      const character = await (Character.findOne({
        _id: characterId,
        userId: userId,
        status: { $ne: 'DELETED' }
      }) as any);

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

      // Filter updates based on character status
      let filteredUpdates = updates;
      const limitedEditableFields = ['avatar', 'profileImage', 'prestavolto', 'audioTheme'];
      
      if (character.status !== 'DRAFT') {
        // For non-DRAFT characters, only allow limited editable fields
        filteredUpdates = {};
        limitedEditableFields.forEach(field => {
          if (updates[field] !== undefined) {
            filteredUpdates[field] = updates[field];
          }
        });
        
        logger.info('Filtered updates for non-DRAFT character', {
          characterId,
          characterStatus: character.status,
          originalFields: Object.keys(updates),
          filteredFields: Object.keys(filteredUpdates)
        });
      }

      // Handle field name mapping from frontend to backend (only for DRAFT)
      if (character.status === 'DRAFT') {
        if (filteredUpdates.firstName !== undefined) {
          character.name = filteredUpdates.firstName;
        }
        if (filteredUpdates.lastName !== undefined) {
          character.surname = filteredUpdates.lastName;
        }
      }

      // Update allowed fields based on character status
      let allowedFields: string[];
      if (character.status === 'DRAFT') {
        // DRAFT characters can update all fields
        allowedFields = [
          'name', 'surname', 'age', 'apparentAge', 'gender', 'birthDate', 'birthPlace',
          'physicalDescription', 'publicDescription', 'privateDescription', 'nationality',
          'description', 'stats', 'skills', 'derived', 'occupation', 'avatar', 'profileImage',
          'prestavolto', 'motivations', 'fears', 'audioTheme',
          // Anagrafica completa
          'height', 'weight', 'eyeColor', 'hairColor', 'visibleMarks', 'hiddenMarks',
          'maritalStatus', 'illnesses', 'educationTitle', 'criminalRecord', 'currentOccupation',
          // Background strutturato
          'background'
        ];
      } else {
        // Non-DRAFT characters can only update limited fields
        allowedFields = limitedEditableFields;
      }
      
      // Handle skills separately (needs async/await for database query)
      if (filteredUpdates.skills && allowedFields.includes('skills')) {
        logger.info('[SKILLS UPDATE] Starting skills processing', {
          characterId: character._id,
          characterStatus: character.status,
          payloadSkillsCount: Object.keys(filteredUpdates.skills).length,
          payloadSampleKeys: Object.keys(filteredUpdates.skills).slice(0, 3)
        });

        // Solo per personaggi DRAFT: salvare tutte le skills, non solo quelle modificate
        if (character.status === 'DRAFT') {
          logger.info('[SKILLS UPDATE] Using DRAFT path (all skills)');
          // Recupera tutte le base skills dal database
          const baseSkills = await Skill.find({ visible: true })
            .sort({ sortOrder: 1, name: 1 })
            .lean();
          
          // Helper per calcolare il base value di una skill
          const calculateSkillBaseValue = (skill: any): number => {
            if (typeof skill.baseValue === 'number') {
              return skill.baseValue;
            }
            if (typeof skill.baseValue === 'string') {
              if (skill.baseValue.startsWith('VALUE:')) {
                return parseInt(skill.baseValue.replace('VALUE:', '')) || 0;
              }
              if (skill.baseValue.startsWith('FORMULA:')) {
                const formula = skill.baseValue.replace('FORMULA:', '');
                const statValue = character.stats?.[formula.toLowerCase()] || 0;
                return statValue;
              }
            }
            return 0;
          };
          
          // Converti skills esistenti del character in oggetto
          const existingSkillsObj: any = {};
          if (character.skills && character.skills instanceof Map) {
            character.skills.forEach((value: any, key: any) => {
              existingSkillsObj[key] = value;
            });
          } else if (character.skills) {
            Object.assign(existingSkillsObj, character.skills);
          }
          
          // Step 1: Create ObjectId → baseSkill lookup map for O(1) access
          const baseSkillsMap = new Map<string, any>();
          baseSkills.forEach((skill: any) => {
            baseSkillsMap.set(skill._id.toString(), skill);
          });

          // Crea un oggetto completo con tutte le skills
          const allSkillsToSave: Record<string, any> = {};

          // Step 2: Process skills from payload (ObjectId keys)
          if (filteredUpdates.skills) {
            // Iterate PAYLOAD skills (has ObjectId keys from frontend)
            for (const [skillId, skillData] of Object.entries(filteredUpdates.skills)) {

              // Validate ObjectId format (24 hex characters)
              if (!skillId.match(/^[0-9a-f]{24}$/i)) {
                logger.warn(`[updateCharacter] Invalid skill ID format: ${skillId}`, {
                  characterId: character._id
                });
                continue;
              }

              // Lookup base skill by ObjectId
              const baseSkill = baseSkillsMap.get(skillId);
              if (!baseSkill) {
                logger.warn(`[updateCharacter] Skill not found in database: ${skillId}`, {
                  characterId: character._id
                });
                continue;
              }

              const baseValue = calculateSkillBaseValue(baseSkill);
              let breakdown: any;

              // Handle different payload formats
              if (typeof skillData === 'object' && skillData !== null) {
                // Full SkillBreakdown from frontend - PRESERVE ALL FIELDS
                const skillBreakdown = skillData as any;
                breakdown = {
                  total: skillBreakdown.total || baseValue,
                  base: skillBreakdown.base || baseValue,
                  manualPoints: skillBreakdown.manualPoints || 0,
                  requiredBonus: skillBreakdown.requiredBonus || 0,
                  occupationBonus: skillBreakdown.occupationBonus || 0,
                  category: skillBreakdown.category || baseSkill.category
                };

                // Recalculate total to ensure consistency
                breakdown.total =
                  breakdown.base +
                  breakdown.manualPoints +
                  breakdown.requiredBonus +
                  breakdown.occupationBonus;

              } else if (typeof skillData === 'number') {
                // Legacy format: just total value - convert to breakdown
                breakdown = {
                  total: skillData,
                  base: baseValue,
                  manualPoints: Math.max(0, skillData - baseValue),
                  requiredBonus: 0,
                  occupationBonus: 0,
                  category: baseSkill.category
                };
              } else {
                logger.warn(`[updateCharacter] Invalid skill data format for ${skillId}`, {
                  characterId: character._id,
                  skillData
                });
                continue;
              }

              // Validate breakdown values (no negatives)
              if (breakdown.manualPoints < 0) breakdown.manualPoints = 0;
              if (breakdown.requiredBonus < 0) breakdown.requiredBonus = 0;
              if (breakdown.occupationBonus < 0) breakdown.occupationBonus = 0;

              // Enforce skill cap (75 normally, 80 with occupation bonus)
              const cap = breakdown.occupationBonus > 0 ? 80 : 75;
              if (breakdown.total > cap) {
                breakdown.total = cap;
              }

              // Save with ObjectId key (NOT skill name)
              allSkillsToSave[skillId] = breakdown;
            }
          }

          // Step 3: Fill missing skills with base values only
          // Only add skills NOT present in payload
          baseSkills.forEach((baseSkill: any) => {
            const skillId = baseSkill._id.toString();

            // Skip if already processed from payload
            if (allSkillsToSave[skillId]) {
              return;
            }

            // Check if skill exists in character with ObjectId key
            const existingSkillValue = existingSkillsObj[skillId];
            const baseValue = calculateSkillBaseValue(baseSkill);

            if (existingSkillValue !== undefined) {
              // Preserve existing skill (not in payload but in character)
              if (existingSkillValue && typeof existingSkillValue === 'object' && 'total' in existingSkillValue) {
                allSkillsToSave[skillId] = { ...existingSkillValue, category: baseSkill.category };
              } else if (typeof existingSkillValue === 'number') {
                allSkillsToSave[skillId] = {
                  total: existingSkillValue,
                  base: baseValue,
                  manualPoints: Math.max(0, existingSkillValue - baseValue),
                  requiredBonus: 0,
                  occupationBonus: 0,
                  category: baseSkill.category
                };
              } else {
                // Invalid format - use default
                allSkillsToSave[skillId] = {
                  total: baseValue,
                  base: baseValue,
                  manualPoints: 0,
                  requiredBonus: 0,
                  occupationBonus: 0,
                  category: baseSkill.category
                };
              }
            } else {
              // New skill not touched yet - add default
              allSkillsToSave[skillId] = {
                total: baseValue,
                base: baseValue,
                manualPoints: 0,
                requiredBonus: 0,
                occupationBonus: 0,
                category: baseSkill.category
              };
            }
          });
          
          // Aggiungi dynamic skills: prima quelle esistenti nel character, poi quelle dal payload (che sovrascrivono)
          if (character.dynamicSkills && Array.isArray(character.dynamicSkills)) {
            character.dynamicSkills.forEach((dynamicSkill: any) => {
              // Aggiungi solo se non è già presente (potrebbe essere sovrascritta dal payload)
              if (!allSkillsToSave[dynamicSkill.skillName]) {
                allSkillsToSave[dynamicSkill.skillName] = {
                  total: dynamicSkill.value || 0,
                  base: 0,
                  requiredBonus: 0,
                  manualPoints: dynamicSkill.value || 0,
                  occupationBonus: 0,
                  category: dynamicSkill.category || 'general'
                };
              }
            });
          }
          
          // Aggiungi/aggiorna dynamic skills dal payload (sovrascrivono quelle esistenti)
          if (filteredUpdates.dynamicSkills && Array.isArray(filteredUpdates.dynamicSkills)) {
            filteredUpdates.dynamicSkills.forEach((dynamicSkill: any) => {
              allSkillsToSave[dynamicSkill.skillName] = {
                total: dynamicSkill.value || 0,
                base: 0,
                requiredBonus: 0,
                manualPoints: dynamicSkill.value || 0,
                occupationBonus: 0,
                category: dynamicSkill.category || 'general'
              };
            });
          }
          
          // Step 4: Save all skills to database with ObjectId keys
          character.skills.clear();
          Object.entries(allSkillsToSave).forEach(([skillId, breakdown]) => {
            character.skills.set(skillId, breakdown);
          });
          character.markModified('skills');
          
          logger.info('All skills saved (DRAFT character)', {
            characterId: character._id,
            totalSkillsSaved: Object.keys(allSkillsToSave).length,
            modifiedSkillsCount: Object.keys(filteredUpdates.skills).length,
            sampleSkillKeys: Object.keys(allSkillsToSave).slice(0, 5),
            firstSkillKeyFormat: Object.keys(allSkillsToSave)[0]?.match(/^[0-9a-f]{24}$/i) ? 'ObjectId' : 'Name'
          });
          } else {
          // Per personaggi non-DRAFT, comportamento originale (solo skills modificate)
          // Note: Keys are ObjectId strings, not skill names
          logger.info('[SKILLS UPDATE] Using non-DRAFT path (modified skills only)');
          character.skills.clear();
          const skillsToSave = Object.entries(filteredUpdates.skills);
          skillsToSave.forEach(([skillId, skillValue]) => {
            // Save with ObjectId key (payload keys are already ObjectIds)
            character.skills.set(skillId, skillValue);
          });
          character.markModified('skills');

          logger.info('Skills updated (non-DRAFT character)', {
            characterId: character._id,
            totalSkillsToSave: skillsToSave.length
          });
        }
      }
      
      // Handle other fields
      allowedFields.forEach((field: string) => {
        if (filteredUpdates[field] !== undefined && field !== 'skills') {
            // Log per currentOccupation per debugging
            if (field === 'currentOccupation') {
              logger.info('Setting currentOccupation', {
                field,
                value: filteredUpdates[field],
                valueType: typeof filteredUpdates[field],
                before: character.currentOccupation
              });
            }
            character[field] = filteredUpdates[field];
            // Assicurati che Mongoose riconosca il cambiamento per campi opzionali
            if (field === 'currentOccupation') {
              character.markModified('currentOccupation');
              logger.info('currentOccupation set and marked as modified', {
                after: character.currentOccupation,
                hasValue: character.currentOccupation !== undefined
              });
          }
        }
      });

      // Handle background - support both object and JSON string (only for DRAFT)
      if (character.status === 'DRAFT' && filteredUpdates.background !== undefined) {
        try {
          let backgroundData = filteredUpdates.background;
          
          // Se background è una stringa JSON, parsala
          if (typeof backgroundData === 'string') {
            backgroundData = JSON.parse(backgroundData);
          }
          
          // Se è un oggetto, aggiorna direttamente il campo background
          if (typeof backgroundData === 'object' && backgroundData !== null) {
            // Inizializza background se non esiste
            if (!character.background) {
              character.background = {};
            }
            
            // Aggiorna tutti i campi del background
            Object.assign(character.background, backgroundData);
            
            // Mantieni compatibilità con campi deprecati motivations e fears
            if (backgroundData.motivations) {
              character.motivations = backgroundData.motivations;
            }
            if (backgroundData.fears) {
              character.fears = backgroundData.fears;
            }
          }
        } catch (parseError) {
          logger.warn('Failed to parse background', { 
            background: filteredUpdates.background, 
            error: (parseError as Error).message 
          });
        }
      }

      // AUTO-INITIALIZE CHARACTER FINANCES FROM FINANZA SKILL (only for DRAFT characters)
      if (character.status === 'DRAFT' && filteredUpdates.skills) {
        try {
          // Find Finanza skill by name to get its ObjectId
          const finanzaSkill = await Skill.findOne({ name: 'Finanza' }).lean();

          if (finanzaSkill) {
            const finanzaId = finanzaSkill._id.toString();
            const finanzaData = filteredUpdates.skills[finanzaId];

            if (finanzaData) {
              // Extract total value from SkillBreakdown or number
              let finanzaValue: number = 0;
              if (typeof finanzaData === 'object' && finanzaData !== null && 'total' in finanzaData) {
                finanzaValue = finanzaData.total;
              } else if (typeof finanzaData === 'number') {
                finanzaValue = finanzaData;
              }

              if (finanzaValue > 0) {
                const socialClass = await FinancialUtils.calculateSocialClass(finanzaValue);

          if (socialClass) {
            // Initialize/update character finances based on social class from FINANZA skill
            await FinancialUtils.initializeCharacterFinances(characterId, socialClass.config);

            logger.info('Character finances initialized from FINANZA skill', {
              characterId,
              finanzaValue,
              socialClassName: socialClass.config.name,
              weeklyCredit: socialClass.config.weeklyCredit
            });
                } else {
                  logger.warn('Could not determine social class from FINANZA skill', {
                    characterId,
                    finanzaValue
                  });
                }
              }
            }
          }
        } catch (error: any) {
          logger.error('Error initializing character finances from FINANZA skill', {
            characterId,
            error: (error as Error).message
          });
        }
      }

      await character.save();

      // Log currentOccupation dopo il salvataggio per verificare se è stato salvato
      logger.info('Character saved - checking currentOccupation', {
        characterId: character.id,
        currentOccupation: character.currentOccupation,
        currentOccupationType: typeof character.currentOccupation,
        hasCurrentOccupation: 'currentOccupation' in character,
        currentOccupationValue: character.get('currentOccupation')
      });

      // Log skills per debugging
      if (filteredUpdates.skills) {
        const skillsObj: any = {};
        character.skills.forEach((value: any, key: any) => {
          skillsObj[key] = value;
        });
        logger.info('Character skills after save', {
          characterId: character.id,
          skillsCount: character.skills.size,
          skills: skillsObj
        });
      }

      // Serialize skills Map for response (same as in getCharacter)
      const serializedSkills: Record<string, any> = {};
      if (character.skills && character.skills instanceof Map) {
        character.skills.forEach((value: any, key: any) => {
          serializedSkills[key] = value; // Preserve ObjectId keys
        });
      }

      logger.info('Character updated', {
        characterId: character.id,
        userId,
        characterStatus: character.status,
        originalFields: Object.keys(updates),
        appliedFields: Object.keys(filteredUpdates),
        skillKeysInResponse: Object.keys(serializedSkills).slice(0, 3) // Log first 3 keys
      });

      res.json(updateResponse(
        {
          character: {
            _id: character._id,
            id: character.id,
            name: character.name,
            surname: character.surname,
            age: character.age,
            apparentAge: character.apparentAge,
            gender: character.gender,
            birthPlace: character.birthPlace,
            status: character.status,
            stats: character.stats,
            derived: character.derived,
            skills: serializedSkills,
            occupation: character.occupation,
            physicalDescription: character.physicalDescription,
            publicDescription: character.publicDescription,
            privateDescription: character.privateDescription,
            motivations: character.motivations,
            fears: character.fears,
            description: character.description,
            avatar: character.avatar,
            prestavolto: character.prestavolto
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Character update error:', {
        message: err.message,
        stack: err.stack,
        characterId: req.params.characterId,
        userId: req.user?.userId,
        updates: Object.keys(req.body || {})
      });
      
      res.status(500).json(errorResponse(
        'Impossibile aggiornare il personaggio',
        'CHARACTER_UPDATE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

}
