import { Request, Response } from 'express';
import { Types, Error as MongooseError } from 'mongoose';
import { Character, Occupation, Skill } from '@database/models';
import type { ICharacter } from '@database/models/Character';
import { logger } from '../logger';
import { successResponse, errorResponse, createResponse, updateResponse, deleteResponse, getRequestId } from '@shared/utils/apiResponse';

import { CharacterVisibilityFilter } from '@shared/utils/characterVisibility';
import { escapeRegex, translateMongooseError } from '@shared/utils/validation';
import { canReadOthersPrivate } from '@config/permissions';
import { FinancialUtils } from '../utils/financialUtils';
import { CharacterCreationConfigService } from '@shared/services/CharacterCreationConfigService';
import { appConfig } from '@config/runtime';

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
   * Merges the legacy starting kit (character.equipment, an ObjectId array set only
   * at approval) with items bought at the Mercato (CharacterInventory, the
   * authoritative source — same precedence WeaponService uses for equipped weapons),
   * populating each with its Item details. Summed by itemId if it appears in both.
   */
  private static async buildPopulatedEquipment(
    characterId: unknown,
    startingEquipmentIds: unknown[]
  ): Promise<Array<{ _id: string; id: string; itemId: string; name: string; description: string; category: string; quantity: number }>> {
    const { Item, CharacterInventory } = require('../../../database/models');

    const inventory = await CharacterInventory.findOne({ characterId }).lean();
    const inventoryEntries = (inventory?.items || []).filter((entry: any) => entry.isVisible !== false);

    const quantityByItemId = new Map<string, number>();
    startingEquipmentIds.forEach((id: any) => {
      const key = id.toString();
      quantityByItemId.set(key, (quantityByItemId.get(key) || 0) + 1);
    });
    inventoryEntries.forEach((entry: any) => {
      const key = entry.itemId.toString();
      quantityByItemId.set(key, (quantityByItemId.get(key) || 0) + entry.quantity);
    });

    if (quantityByItemId.size === 0) return [];

    const equipmentItems = await Item.find({ _id: { $in: Array.from(quantityByItemId.keys()) } }).lean();
    return equipmentItems.map((item: any) => ({
      _id: item._id.toString(),
      id: item._id.toString(),
      itemId: item._id.toString(),
      name: item.name,
      description: item.description,
      category: item.category,
      quantity: quantityByItemId.get(item._id.toString()) || 1
    }));
  }

  /**
   * POST /characters/check-name
   * Check if character name is available
   */
  static async checkNameAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.body;

      // Validate input
      if (!name || typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({
          available: false,
          error: 'Nome deve essere almeno 2 caratteri'
        });
        return;
      }

      const trimmedName = name.trim();

      // Check if name exists (excluding soft-deleted characters)
      const existingCharacter = await Character.findOne({
        name: trimmedName,
        isDeleted: false  // Exclude soft-deleted
      });

      res.json({
        available: !existingCharacter,
        name: trimmedName
      });

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Error checking name availability:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });

      res.status(500).json({
        available: false,
        error: 'Errore durante verifica disponibilità nome'
      });
    }
  }

  /**
   * GET /characters/my
   * Get user's characters
   */
  static async getMyCharacters(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;

      const characters = await Character.find({
        userId
      })
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

    } catch (error: unknown) {
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

  // REMOVED: getCharacterCreationConfig - moved to CharacterCreationController
  // Use /game/character-creation-config endpoint instead (CharacterCreationController.getConfig)

  /**
   * GET /characters/public-list
   * Get list of all characters (including isOwnCharacter flag for filtering)
   */
  static async getPublicCharactersList(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = req.user!.userId;

      // Get all characters that are not deleted (include all users' characters)
      const characters = await Character.find({})
      .select('_id name surname avatar status userId lastActive')
      .sort({ name: 1 })
      .limit(200);

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
          status: character.playerStatus,
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

    } catch (error: unknown) {
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

      const character = await Character.findOne({
        _id: characterId,
        userId: userId,
        status: 'draft'
      });

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

      await character.softDelete(
        character._id,
        character.name
      );

      logger.info('Character soft deleted', {
        characterId,
        userId,
        name: character.name
      });

      res.json(deleteResponse(
        'Personaggio eliminato con successo',
        getRequestId(req)
      ));

    } catch (error: unknown) {
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
      const systemBotUserId = appConfig.systemBotUserId;
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
        appearance: 50,
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
        playerStatus: 'approved', // Preapproved
        gameplayRoles: ['player'],
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

    } catch (error: unknown) {
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
      const systemBotUserId = appConfig.systemBotUserId;
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
        const skillBreakdown = breakdown as Record<string, unknown>;
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
        playerStatus: 'approved', // Preapproved
        gameplayRoles: ['player'],
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

    } catch (error: unknown) {
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

      // Può vedere dati privati di altri solo con permesso game:character:read:others:private (master)
      const canViewPrivate = req.character && canReadOthersPrivate(
        req.character.playerStatus || 'draft',
        req.character.isGestore || false,
        req.character.gameplayRoles || [],
        req.character.characterPermissions || []
      );
      const isMaster = !!canViewPrivate;

      logger.info('User roles check', { isMaster, gameplayRoles: req.character?.gameplayRoles });

      const character = await Character.findOne({
        _id: characterId
      });

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
        } catch (error: unknown) {
          logger.warn('Failed to find occupation by ID, trying by name:', { occupation: character.occupation, error: error instanceof Error ? error.message : String(error) });
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

      // Popola l'equipaggiamento unendo il kit iniziale (character.equipment, legacy)
      // con gli oggetti comprati al mercato (CharacterInventory, fonte autoritativa)
      characterJson.equipment = await CharacterController.buildPopulatedEquipment(
        character._id,
        characterJson.equipment || []
      );

      logger.info('Equipment populated', {
        characterId,
        equipmentCount: characterJson.equipment.length,
        items: characterJson.equipment.map((item: any) => item.name)
      });

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
          let fieldVisibility: Record<string, boolean> | undefined;
          try {
            const rulesConfig = await CharacterCreationConfigService.getInstance().loadConfig();
            fieldVisibility = rulesConfig.fieldVisibility;
          } catch {
            // Se la config non è disponibile, filterForPublic usa il fallback hardcoded
          }
          filteredCharacter = CharacterVisibilityFilter.filterCharacter(
            characterJson,
            userId,
            isMaster,
            fieldVisibility
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

    } catch (error: unknown) {
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
   * GET /characters/:characterId/wizard
   * Get character data for wizard (draft editing). Requires game:character:wizard; only own character.
   */
  static async getCharacterForWizard(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const currentCharacterId = req.character?.characterId;
      if (!currentCharacterId || currentCharacterId !== characterId) {
        res.status(403).json(errorResponse(
          'Solo il proprio personaggio può essere caricato nel wizard',
          'WIZARD_OWNER_REQUIRED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      const character = await Character.findOne({
        _id: characterId
      });

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

      const userId = req.user!.userId;
      if (character.userId.toString() !== userId) {
        res.status(403).json(errorResponse(
          'Solo il proprio personaggio può essere caricato nel wizard',
          'WIZARD_OWNER_REQUIRED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      const characterJson = character.toJSON();
      if (character.skills && character.skills instanceof Map) {
        const skillsObj: any = {};
        character.skills.forEach((value: any, key: any) => { skillsObj[key] = value; });
        characterJson.skills = skillsObj;
      } else if (!characterJson.skills || Object.keys(characterJson.skills).length === 0) {
        characterJson.skills = {};
      }

      if (character.occupation) {
        const { Occupation, Skill } = require('../../../database/models');
        let occupation = await Occupation.findById(character.occupation).catch(() => null);
        if (!occupation && typeof character.occupation === 'string') {
          occupation = await Occupation.findOne({ name: character.occupation });
        }
        if (occupation) {
          characterJson.occupationName = occupation.name;
          characterJson.occupationData = occupation.toJSON();
          if (occupation.benefits?.professionalSkills) {
            const skills = await Skill.find({ _id: { $in: occupation.benefits.professionalSkills } });
            characterJson.professionalSkillNames = skills.map((s: any) => s.name);
          }
        }
      }

      if (characterJson.equipment?.length > 0) {
        const { Item } = require('../../../database/models');
        const equipmentItems = await Item.find({ _id: { $in: characterJson.equipment } });
        characterJson.equipment = equipmentItems.map((item: any) => ({
          id: item._id.toString(),
          itemId: item._id.toString(),
          name: item.name,
          description: item.description,
          category: item.category,
          quantity: 1
        }));
      }

      res.json(successResponse(
        { character: { ...characterJson, isOwnCharacter: true } },
        undefined,
        getRequestId(req)
      ));
    } catch (error: unknown) {
      logger.error('Get character for wizard error', { message: (error as Error).message, characterId: req.params.characterId });
      res.status(500).json(errorResponse(
        'Impossibile caricare il personaggio per il wizard',
        'GET_CHARACTER_WIZARD_ERROR',
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
        _id: characterId
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
                       req.character?.isGestore || false;

      const permissions = {
        isOwner,
        canViewPrivateBackground: isOwner || isMaster,
        canViewReviewHistory: isOwner || isMaster,
        canViewFullInventory: isOwner || isMaster,
        canViewSkillBreakdown: isOwner,
        canEdit: isOwner && character.playerStatus === 'draft'
      };

      // hiddenMarks and health params are private — strip before serializing
      // for viewers who are neither the owner nor a master.
      if (!permissions.canViewPrivateBackground) {
        delete (character as any).hiddenMarks;
        delete (character as any).currentHP;
        delete (character as any).maxHP;
      }

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

      // Fetch skill names from Skill model (filter out dynamic skill name-based keys)
      const skillIds = Object.keys(serializedSkills).filter(k => k.match(/^[0-9a-f]{24}$/i));
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

      // Popola l'equipaggiamento unendo il kit iniziale (character.equipment, legacy)
      // con gli oggetti comprati al mercato (CharacterInventory, fonte autoritativa)
      (character as any).equipment = await CharacterController.buildPopulatedEquipment(
        character._id,
        character.equipment || []
      );

      // There's no per-item visibility: it's the owner's full inventory or nothing.
      // Masters (canViewFullInventory) can see it too; other characters see none of it.
      const visibleEquipment: string[] = permissions.canViewFullInventory
        ? (character.equipment || []).map((e: any) => e._id.toString())
        : [];

      // Map background fields to frontend-expected structure
      const publicBackground = character.background?.briefHistory ||
                               character.publicDescription ||
                               undefined;

      const privateBackground = character.background?.significantEvents ||
                                character.privateDescription ||
                                undefined;

      const motivations = character.background?.goalsAndMotivations ||
                          undefined;

      const fears = character.background?.fearsAndPhobias ||
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
          characterType: character.characterType, // For frontend routing to type-specific sheets
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

    } catch (error: unknown) {
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
      
      // Può vedere dati privati di altri solo con permesso game:character:read:others:private (master)
      const canViewPrivate = req.character && canReadOthersPrivate(
        req.character.playerStatus || 'draft',
        req.character.isGestore || false,
        req.character.gameplayRoles || [],
        req.character.characterPermissions || []
      );
      const isMaster = !!canViewPrivate;

      const character = await Character.findOne({
        _id: characterId
      });

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

      // Applica le regole di visibilità (pubblico per tutti, dati master-only solo con permesso)
      let filteredCharacter;
      if (isOwner) {
        // Il proprietario può vedere tutti i dati - restituisci tutto il JSON
        filteredCharacter = characterJson;
      } else {
        // Altri: solo dati pubblici, oppure tutto se ha game:character:read:others:private
        let fieldVisibility: Record<string, boolean> | undefined;
        try {
          const rulesConfig = await CharacterCreationConfigService.getInstance().loadConfig();
          fieldVisibility = rulesConfig.fieldVisibility;
        } catch {
          // Se la config non è disponibile, filterForPublic usa il fallback hardcoded
        }
        filteredCharacter = CharacterVisibilityFilter.filterCharacter(
          characterJson,
          userId,
          isMaster,
          fieldVisibility
        );
      }

      res.json(successResponse(
        {
          character: filteredCharacter
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
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

      const character = await Character.findOne({
        _id: characterId,
        userId: userId
      });

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
      
      if (character.playerStatus !== 'draft') {
        // For non-DRAFT characters, only allow limited editable fields
        filteredUpdates = {};
        limitedEditableFields.forEach(field => {
          if (updates[field] !== undefined) {
            filteredUpdates[field] = updates[field];
          }
        });
        
        logger.info('Filtered updates for non-DRAFT character', {
          characterId,
          characterStatus: character.playerStatus,
          originalFields: Object.keys(updates),
          filteredFields: Object.keys(filteredUpdates)
        });
      }

      // Handle field name mapping from frontend to backend (only for DRAFT)
      if (character.playerStatus === 'draft') {
        if (filteredUpdates.firstName !== undefined) {
          character.name = filteredUpdates.firstName;
        }
        if (filteredUpdates.lastName !== undefined) {
          character.surname = filteredUpdates.lastName;
        }
        // Frontend sends "birthDate"
        if (filteredUpdates.birthDate !== undefined) {
          character.birthDate = filteredUpdates.birthDate;
        }
      }

      // Update allowed fields based on character status
      let allowedFields: string[];
      if (character.playerStatus === 'draft') {
        // DRAFT characters can update all fields
        allowedFields = [
          'name', 'surname', 'age', 'apparentAge', 'gender', 'birthDate', 'birthPlace',
          'physicalDescription', 'publicDescription', 'privateDescription', 'nationality',
          'description', 'stats', 'skills', 'derived', 'occupation', 'avatar', 'profileImage',
          'prestavolto', 'motivations', 'fears', 'audioTheme',
          // Anagrafica completa
          'height', 'weight', 'eyeColor', 'hairColor', 'visibleMarks', 'hiddenMarks',
          'maritalStatus', 'illnesses', 'educationTitle', 'criminalRecord', 'pathologies', 'currentOccupation',
          // Background strutturato
          'background',
          // Dynamic skills (placeholder specializations)
          'dynamicSkills'
        ];
      } else {
        // Non-DRAFT characters can only update limited fields
        allowedFields = limitedEditableFields;
      }
      
      // Handle skills separately (needs async/await for database query)
      if (filteredUpdates.skills && allowedFields.includes('skills')) {
        logger.info('[SKILLS UPDATE] Starting skills processing', {
          characterId: character._id,
          characterStatus: character.playerStatus,
          payloadSkillsCount: Object.keys(filteredUpdates.skills).length,
          payloadSampleKeys: Object.keys(filteredUpdates.skills).slice(0, 3)
        });

        // Solo per personaggi DRAFT: salvare tutte le skills, non solo quelle modificate
        if (character.playerStatus === 'draft') {
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
                const skillBreakdown = skillData as Record<string, unknown>;
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
                base: dynamicSkill.base ?? 0,
                requiredBonus: dynamicSkill.requiredBonus ?? 0,
                manualPoints: dynamicSkill.manualPoints ?? 0,
                occupationBonus: dynamicSkill.occupationBonus ?? 0,
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
        if (filteredUpdates[field] !== undefined && field !== 'skills' && field !== 'dynamicSkills') {
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

      // Handle dynamicSkills separately (Mongoose array needs markModified)
      if (character.playerStatus === 'draft' && filteredUpdates.dynamicSkills && Array.isArray(filteredUpdates.dynamicSkills)) {
        character.dynamicSkills = filteredUpdates.dynamicSkills;
        character.markModified('dynamicSkills');
      }

      // Handle background - support both object and JSON string (only for DRAFT)
      if (character.playerStatus === 'draft' && filteredUpdates.background !== undefined) {
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
          }
        } catch (parseError) {
          logger.warn('Failed to parse background', { 
            background: filteredUpdates.background, 
            error: (parseError as Error).message 
          });
        }
      }

      // AUTO-INITIALIZE CHARACTER FINANCES FROM FINANZA SKILL (only for DRAFT characters)
      if (character.playerStatus === 'draft' && filteredUpdates.skills) {
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
            await FinancialUtils.initializeCharacterFinances(characterId, socialClass.config, finanzaValue);

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
        } catch (error: unknown) {
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
        characterStatus: character.playerStatus,
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
            status: character.playerStatus,
            playerStatus: character.playerStatus,
            stats: character.stats,
            derived: character.derived,
            skills: serializedSkills,
            occupation: character.occupation,
            physicalDescription: character.physicalDescription,
            publicDescription: character.publicDescription,
            privateDescription: character.privateDescription,
            avatar: character.avatar,
            prestavolto: character.prestavolto
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Character update error:', {
        message: err.message,
        stack: err.stack,
        characterId: req.params.characterId,
        userId: req.user?.userId,
        updates: Object.keys(req.body || {})
      });

      // Mongoose ValidationError (es. formato birthDate errato) è un errore dell'utente,
      // non un errore server: va tradotto in italiano con status 400, non un 500 generico.
      if (err.name === 'ValidationError' && err instanceof MongooseError.ValidationError) {
        const { message, code, details } = translateMongooseError(err);
        res.status(400).json(errorResponse(message, code, details, 400, getRequestId(req)));
        return;
      }

      res.status(500).json(errorResponse(
        'Impossibile aggiornare il personaggio',
        'CHARACTER_UPDATE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get Character Directory
   *
   * Returns paginated list of approved characters with full details for anagrafica window.
   * Only shows approved characters, includes online status, occupation, prestavolto.
   *
   * GET /game/characters/directory
   *
   * Query params:
   * - page: number (default: 1)
   * - pageSize: number (default: 25, max: 100)
   * - sortBy: string (default: 'name')
   * - sortOrder: 'asc' | 'desc' (default: 'asc')
   * - search: string (optional - filters by name)
   * - onlineOnly: boolean (optional - filters only online characters)
   */
  static async getCharacterDirectory(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 25, 100);
      const sortBy = (req.query.sortBy as string) || 'name';
      const sortOrder = (req.query.sortOrder as string) === 'desc' ? -1 : 1;
      const search = req.query.search as string;
      const onlineOnly = req.query.onlineOnly === 'true';

      // Build query filter
      const filter: any = {
        playerStatus: 'approved', // Only approved characters visible
        isDeleted: { $ne: true }
      };

      // Search by name
      if (search) {
        const escapedSearch = escapeRegex(search);
        filter.$or = [
          { name: { $regex: escapedSearch, $options: 'i' } },
          { surname: { $regex: escapedSearch, $options: 'i' } }
        ];
      }

      // Online filter
      if (onlineOnly) {
        const activityTimeout = 5 * 60 * 1000; // 5 minutes
        const cutoffTime = new Date(Date.now() - activityTimeout);
        filter.lastActive = { $gte: cutoffTime };
      }

      // Count total
      const total = await Character.countDocuments(filter);

      // Build sort object
      const sort: any = {};
      sort[sortBy] = sortOrder;

      // Fetch characters
      const characters = await Character.find(filter)
        .select('_id name surname avatar prestavolto occupation currentLocation lastActive')
        .populate('occupation', 'name')
        .sort(sort)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();

      // Calculate online status
      const activityTimeout = 5 * 60 * 1000; // 5 minutes
      const cutoffTime = new Date(Date.now() - activityTimeout);

      const charactersList = characters.map((char: any) => ({
        _id: char._id.toString(),
        name: char.name,
        surname: char.surname || '',
        avatar: char.avatar || '',
        prestavolto: char.prestavolto || '',
        occupation: char.occupation?.name || '',
        isOnline: char.lastActive && char.lastActive >= cutoffTime,
        lastActive: char.lastActive || null,
        currentLocation: char.currentLocation ? char.currentLocation.toString() : null
      }));

      logger.info('Character directory requested', {
        page,
        pageSize,
        total,
        resultsCount: charactersList.length,
        userId: req.user?.userId
      });

      res.json(successResponse(
        {
          characters: charactersList,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize)
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Get character directory error:', {
        message: err.message,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare l\'anagrafica personaggi',
        'CHARACTER_DIRECTORY_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Search Face Claims
   *
   * Real-time validation endpoint for character wizard.
   * Returns exact match, fuzzy matches, and complete list of face claims.
   *
   * GET /game/characters/face-claims/search?q=...
   *
   * Query params:
   * - q: string (search query, min 1 char)
   *
   * Response:
   * - exactMatch: { characterName, status } | null
   * - matches: Array<{ prestavolto, characterName, status }> (fuzzy, max 5)
   * - allFaceClaims: Array<{ prestavolto, characterName, characterId, playerStatus }> (max 200)
   */
  static async searchFaceClaims(req: Request, res: Response): Promise<void> {
    try {
      const query = (req.query.q as string || '').trim();

      // Response structure
      let exactMatch: { characterName: string; status: string } | null = null;
      let matches: Array<{ prestavolto: string; characterName: string; status: string }> = [];
      let allFaceClaims: Array<{ prestavolto: string; characterName: string; characterId: string; playerStatus: string }> = [];

      // Fetch all face claims (cached list for reference)
      const allChars = await Character.find({
        prestavolto: { $exists: true, $nin: [null, ''] },
        isDeleted: { $ne: true }
      })
        .select('_id name surname prestavolto playerStatus prestavoltoApprovedAt')
        .sort({ prestavolto: 1 })
        .limit(200)
        .lean();

      allFaceClaims = allChars.map((char: any) => ({
        prestavolto: char.prestavolto,
        characterName: `${char.name}${char.surname ? ' ' + char.surname : ''}`,
        characterId: char._id.toString(),
        playerStatus: char.playerStatus,
        prestavoltoApprovedAt: char.prestavoltoApprovedAt || null
      }));

      // If query provided, search for matches
      if (query.length >= 1) {
        const escapedQuery = escapeRegex(query);
        // Exact match
        const exactChar = await Character.findOne({
          prestavolto: { $regex: new RegExp(`^${escapedQuery}$`, 'i') },
          isDeleted: { $ne: true }
        })
          .select('name surname playerStatus')
          .lean();

        if (exactChar) {
          exactMatch = {
            characterName: `${exactChar.name}${exactChar.surname ? ' ' + exactChar.surname : ''}`,
            status: exactChar.playerStatus
          };
        }

        // Fuzzy matches (if query >= 3 chars)
        if (query.length >= 3) {
          const fuzzyChars = await Character.find({
            prestavolto: { $regex: new RegExp(escapedQuery, 'i') },
            isDeleted: { $ne: true }
          })
            .select('prestavolto name surname playerStatus')
            .sort({ prestavolto: 1 })
            .limit(5)
            .lean();

          matches = fuzzyChars.map((char: any) => ({
            prestavolto: char.prestavolto,
            characterName: `${char.name}${char.surname ? ' ' + char.surname : ''}`,
            status: char.playerStatus
          }));
        }
      }

      logger.debug('Face claims search', {
        query,
        exactMatchFound: !!exactMatch,
        matchesCount: matches.length,
        allFaceClaimsCount: allFaceClaims.length
      });

      res.json(successResponse(
        {
          exactMatch,
          matches,
          allFaceClaims
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Search face claims error:', {
        message: err.message,
        stack: err.stack
      });

      res.status(500).json(errorResponse(
        'Impossibile cercare i prestavolti',
        'SEARCH_FACE_CLAIMS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Update Prestavolto
   *
   * Dedicated endpoint for updating character's face claim (prestavolto).
   * Works even for approved characters.
   * Logs history and requires staff approval for changes.
   *
   * PUT /game/characters/:characterId/prestavolto
   *
   * Body:
   * - prestavolto: string (new face claim name)
   *
   * Rules:
   * - First assignment: validate duplicates, possible pending_duplicate
   * - Change (old → new): requires staff approval, prestavoltoStatus = 'pending_change'
   * - History is logged in prestavoltoHistory array
   */
  static async updatePrestavolto(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const { prestavolto } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json(errorResponse(
          'Utente non autenticato',
          'UNAUTHORIZED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      if (!prestavolto || typeof prestavolto !== 'string' || prestavolto.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Prestavolto mancante o non valido',
          'INVALID_PRESTAVOLTO',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const newPrestavolto = prestavolto.trim();
      if (newPrestavolto.length > 100) {
        res.status(400).json(errorResponse(
          'Prestavolto troppo lungo (max 100 caratteri)',
          'PRESTAVOLTO_TOO_LONG',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const character = await Character.findOne({
        _id: characterId,
        userId,
        isDeleted: { $ne: true }
      });

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

      const oldPrestavolto = character.prestavolto || null;
      const isFirstAssignment = !oldPrestavolto;
      const isChange = !isFirstAssignment && oldPrestavolto.toLowerCase() !== newPrestavolto.toLowerCase();

      // Check for duplicates
      const escapedPrestavolto = escapeRegex(newPrestavolto);
      const duplicate = await Character.findOne({
        prestavolto: { $regex: new RegExp(`^${escapedPrestavolto}$`, 'i') },
        _id: { $ne: characterId },
        isDeleted: { $ne: true }
      }).select('_id name surname prestavoltoStatus');

      let newStatus: 'approved' | 'pending_duplicate' | 'pending_change' | null = character.prestavoltoStatus || null;

      if (isChange) {
        // RULE: Changing prestavolto requires staff approval
        newStatus = 'pending_change';
      } else if (isFirstAssignment && duplicate) {
        // RULE: First assignment with duplicate → pending_duplicate (unless already approved)
        if (newStatus !== 'approved') {
          newStatus = 'pending_duplicate';
        }
      } else if (isFirstAssignment && !duplicate) {
        // RULE: First assignment, no duplicate → auto-approve
        if (newStatus === 'pending_duplicate') {
          newStatus = null;
        }
        // Set approval date for clean first assignments
        character.prestavoltoApprovedAt = new Date();
      }

      // Add to history
      if (!character.prestavoltoHistory) {
        character.prestavoltoHistory = [];
      }

      character.prestavoltoHistory.push({
        oldValue: oldPrestavolto,
        newValue: newPrestavolto,
        changedAt: new Date(),
        changedBy: new Types.ObjectId(userId),
        status: isChange ? 'pending' : 'approved',
        notes: isChange ? 'Cambio prestavolto - richiede approvazione staff' :
               duplicate ? `Duplicato rilevato: ${duplicate.name}${duplicate.surname ? ' ' + duplicate.surname : ''}` :
               'Primo assegnamento'
      } as unknown as NonNullable<ICharacter['prestavoltoHistory']>[number]);

      // Update character
      character.prestavolto = newPrestavolto;
      character.prestavoltoStatus = newStatus;

      await character.save();

      logger.info('Prestavolto updated', {
        characterId,
        userId,
        oldValue: oldPrestavolto,
        newValue: newPrestavolto,
        isFirstAssignment,
        isChange,
        newStatus,
        hasDuplicate: !!duplicate
      });

      res.json(successResponse(
        {
          prestavolto: newPrestavolto,
          prestavoltoStatus: newStatus,
          isFirstAssignment,
          isChange,
          requiresApproval: newStatus === 'pending_change',
          hasDuplicate: !!duplicate,
          duplicateCharacter: duplicate ? `${duplicate.name}${duplicate.surname ? ' ' + duplicate.surname : ''}` : null
        },
        isChange ? 'Prestavolto aggiornato. Richiede approvazione staff.' : 'Prestavolto aggiornato con successo',
        getRequestId(req)
      ));

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Update prestavolto error:', {
        message: err.message,
        stack: err.stack,
        characterId: req.params.characterId,
        userId: req.user?.userId
      });

      res.status(500).json(errorResponse(
        'Impossibile aggiornare il prestavolto',
        'UPDATE_PRESTAVOLTO_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * PNG LIGHT SYSTEM - Fake PNG Management
   * Max 5 fake identities per character for chat masking
   */

  /**
   * GET /characters/:characterId/fake-pngs
   * List all fake PNGs for character
   */
  static async listFakePngs(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;

      // Auth check
      if (!req.character) {
        res.status(401).json(errorResponse('Authentication required', 'UNAUTHORIZED', undefined, 401, getRequestId(req)));
        return;
      }

      // Ownership check
      if (req.character.characterId !== characterId) {
        res.status(403).json(errorResponse('Not authorized', 'FORBIDDEN', undefined, 403, getRequestId(req)));
        return;
      }

      const character = await Character.findById(characterId)
        .select('fakePngs activeFakePngId')
        .lean();

      if (!character) {
        res.status(404).json(errorResponse('Character not found', 'NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      res.json(successResponse({
        fakePngs: character.fakePngs || [],
        activeFakePngId: character.activeFakePngId
      }, 'Fake PNGs retrieved successfully', getRequestId(req)));
    } catch (error) {
      logger.error('[CharacterController] listFakePngs error:', error);
      res.status(500).json(errorResponse('Internal server error', 'SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * POST /characters/:characterId/fake-pngs
   * Create fake PNG
   */
  static async createFakePng(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const { name, surname, avatar } = req.body;

      // Auth check
      if (!req.character) {
        res.status(401).json(errorResponse('Authentication required', 'UNAUTHORIZED', undefined, 401, getRequestId(req)));
        return;
      }

      // Ownership check
      if (req.character.characterId !== characterId) {
        res.status(403).json(errorResponse('Not authorized', 'FORBIDDEN', undefined, 403, getRequestId(req)));
        return;
      }

      // Validation
      if (!name || name.trim().length < 2) {
        res.status(400).json(errorResponse('Name required (min 2 chars)', 'INVALID_NAME', undefined, 400, getRequestId(req)));
        return;
      }

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Character not found', 'NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      // Check max limit
      if (character.fakePngs && character.fakePngs.length >= 5) {
        res.status(400).json(errorResponse('Max 5 fake PNGs allowed', 'MAX_LIMIT_REACHED', undefined, 400, getRequestId(req)));
        return;
      }

      // Create fake PNG (Mongoose will auto-generate _id)
      const newFake: NonNullable<ICharacter['fakePngs']>[number] = {
        name: name.trim(),
        surname: surname?.trim(),
        avatar: avatar?.trim(),
        createdAt: new Date()
      };

      character.fakePngs = character.fakePngs || [];
      character.fakePngs.push(newFake);
      await character.save();

      // Get the created fake with _id
      const createdFake = character.fakePngs[character.fakePngs.length - 1];

      res.status(201).json(createResponse(createdFake, 'Fake PNG created successfully', getRequestId(req)));
    } catch (error) {
      logger.error('[CharacterController] createFakePng error:', error);
      res.status(500).json(errorResponse('Internal server error', 'SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * PATCH /characters/:characterId/fake-pngs/:fakeId
   * Update fake PNG
   */
  static async updateFakePng(req: Request, res: Response): Promise<void> {
    try {
      const { characterId, fakeId } = req.params;
      const { name, surname, avatar } = req.body;

      // Auth check
      if (!req.character) {
        res.status(401).json(errorResponse('Authentication required', 'UNAUTHORIZED', undefined, 401, getRequestId(req)));
        return;
      }

      // Ownership check
      if (req.character.characterId !== characterId) {
        res.status(403).json(errorResponse('Not authorized', 'FORBIDDEN', undefined, 403, getRequestId(req)));
        return;
      }

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Character not found', 'NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      type FakePngWithId = NonNullable<ICharacter['fakePngs']>[number] & { _id?: Types.ObjectId };
      const fake = character.fakePngs?.find((f: FakePngWithId) => f._id?.toString() === fakeId);
      if (!fake) {
        res.status(404).json(errorResponse('Fake PNG not found', 'NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      // Update fields
      if (name) fake.name = name.trim();
      if (surname !== undefined) fake.surname = surname?.trim();
      if (avatar !== undefined) fake.avatar = avatar?.trim();
      fake.updatedAt = new Date();

      await character.save();

      res.json(updateResponse(fake, 'Fake PNG updated successfully', getRequestId(req)));
    } catch (error) {
      logger.error('[CharacterController] updateFakePng error:', error);
      res.status(500).json(errorResponse('Internal server error', 'SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * DELETE /characters/:characterId/fake-pngs/:fakeId
   * Delete fake PNG
   */
  static async deleteFakePng(req: Request, res: Response): Promise<void> {
    try {
      const { characterId, fakeId } = req.params;

      // Auth check
      if (!req.character) {
        res.status(401).json(errorResponse('Authentication required', 'UNAUTHORIZED', undefined, 401, getRequestId(req)));
        return;
      }

      // Ownership check
      if (req.character.characterId !== characterId) {
        res.status(403).json(errorResponse('Not authorized', 'FORBIDDEN', undefined, 403, getRequestId(req)));
        return;
      }

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Character not found', 'NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      // Remove from array
      const initialLength = character.fakePngs?.length || 0;
      character.fakePngs = character.fakePngs?.filter(
        (f: any) => f._id?.toString() !== fakeId
      ) || [];

      if (character.fakePngs.length === initialLength) {
        res.status(404).json(errorResponse('Fake PNG not found', 'NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      // Clear activeFakePngId if deleting active fake
      if (character.activeFakePngId?.toString() === fakeId) {
        character.activeFakePngId = null;
      }

      await character.save();

      res.json(successResponse({ deleted: true }, 'Fake PNG deleted successfully', getRequestId(req)));
    } catch (error) {
      logger.error('[CharacterController] deleteFakePng error:', error);
      res.status(500).json(errorResponse('Internal server error', 'SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * POST /characters/:characterId/fake-pngs/:fakeId/activate
   * Activate fake PNG
   */
  static async activateFakePng(req: Request, res: Response): Promise<void> {
    try {
      const { characterId, fakeId } = req.params;

      // Auth check
      if (!req.character) {
        res.status(401).json(errorResponse('Authentication required', 'UNAUTHORIZED', undefined, 401, getRequestId(req)));
        return;
      }

      // Ownership check
      if (req.character.characterId !== characterId) {
        res.status(403).json(errorResponse('Not authorized', 'FORBIDDEN', undefined, 403, getRequestId(req)));
        return;
      }

      // Permission check
      const { hasGamePermission, GamePermissions } = await import('@config/permissions/game');
      const hasFakePngPermission = hasGamePermission(
        GamePermissions.CHAT_USE_FAKE_PNG,
        req.character.playerStatus || 'draft',
        req.character.isGestore || false,
        req.character.gameplayRoles || [],
        req.character.characterPermissions || []
      );
      if (!hasFakePngPermission) {
        res.status(403).json(errorResponse('Missing permission: game:chat:use-fake-png', 'FORBIDDEN', undefined, 403, getRequestId(req)));
        return;
      }

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Character not found', 'NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      // Verify fake exists
      const fakeExists = character.fakePngs?.some((f: any) => f._id?.toString() === fakeId);
      if (!fakeExists) {
        res.status(404).json(errorResponse('Fake PNG not found', 'NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      // Type-safe ObjectId conversion
      character.activeFakePngId = new Types.ObjectId(Array.isArray(fakeId) ? fakeId[0] : fakeId);
      await character.save();

      res.json(successResponse({ activeFakePngId: fakeId }, 'Fake PNG activated successfully', getRequestId(req)));
    } catch (error) {
      logger.error('[CharacterController] activateFakePng error:', error);
      res.status(500).json(errorResponse('Internal server error', 'SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  /**
   * POST /characters/:characterId/fake-pngs/deactivate
   * Deactivate fake PNG (return to real identity)
   */
  static async deactivateFakePng(req: Request, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;

      // Auth check
      if (!req.character) {
        res.status(401).json(errorResponse('Authentication required', 'UNAUTHORIZED', undefined, 401, getRequestId(req)));
        return;
      }

      // Ownership check
      if (req.character.characterId !== characterId) {
        res.status(403).json(errorResponse('Not authorized', 'FORBIDDEN', undefined, 403, getRequestId(req)));
        return;
      }

      const character = await Character.findById(characterId);
      if (!character) {
        res.status(404).json(errorResponse('Character not found', 'NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      character.activeFakePngId = null;
      await character.save();

      res.json(successResponse({ activeFakePngId: null }, 'Fake PNG deactivated successfully', getRequestId(req)));
    } catch (error) {
      logger.error('[CharacterController] deactivateFakePng error:', error);
      res.status(500).json(errorResponse('Internal server error', 'SERVER_ERROR', undefined, 500, getRequestId(req)));
    }
  }

}
