import { Request, Response } from 'express';
import { IBot, BotSchema } from '../models/Bot';
import { DatabaseContext } from '../services/DatabaseContext';
import { getEnvironmentFromRequest } from '../middleware/environmentDetection';
import { gameBackendClient } from '../services/GameBackendClient';
import { logger } from '../utils/logger';
import { successResponse, errorResponse, createResponse, updateResponse, deleteResponse } from '../utils/apiResponse';

export class BotController {
  /**
   * POST /bots
   * Create new bot with character in game-backend
   */
  static async createBot(req: Request, res: Response): Promise<void> {
    try {
      // Get environment from request
      const environment = getEnvironmentFromRequest(req);
      const dbContext = new DatabaseContext(environment);
      const BotModel = dbContext.getModel<IBot>('Bot', BotSchema);

      logger.info(`[BotController] Creating bot in ${environment} environment (${dbContext.getDatabaseName()})`);

      const {
        name,
        surname,
        physicalDescription,
        publicDescription,
        privateDescription,
        background,
        personality,
        goals,
        activationRules,
        stats,
        gender
      } = req.body;

      if (!name || !personality || !goals) {
        res.status(400).json(errorResponse(
          'name, personality, and goals are required',
          'MISSING_REQUIRED_FIELDS'
        ));
        return;
      }

      // Step 1: Create bot document (to get bot ID)
      const bot = await BotModel.create({
        botCharacterId: 'temp', // Will be updated after character creation
        name,
        gender: gender || 'male', // Save gender with fallback to 'male'
        personality: {
          traits: personality.traits || [],
          coreValues: personality.coreValues || [],
          speechPattern: personality.speechPattern || 'Parla in modo standard',
          emotionalRange: personality.emotionalRange || { min: -5, max: 5 }
        },
        goals: {
          shortTerm: goals.shortTerm || [],
          longTerm: goals.longTerm || []
        },
        currentEmotionalState: {
          mood: 'neutro',
          intensity: 5,
          lastUpdated: new Date()
        },
        activationRules: {
          keywords: activationRules?.keywords || [],
          contextualRelevance: activationRules?.contextualRelevance || 50,
          cooldownMinutes: activationRules?.cooldownMinutes || 5
        },
        assignedLocations: activationRules?.locationIds || [],
        isActive: true
      });

      // Step 2: Create character in game-backend
      const characterResult = await gameBackendClient.createBotCharacter(
        name,
        surname || '',
        bot._id.toString(),
        physicalDescription,
        publicDescription,
        privateDescription,
        background,
        stats,
        gender
      );

      if (!characterResult.success || !characterResult.characterId) {
        // Rollback bot creation
        await BotModel.findByIdAndDelete(bot._id);

        res.status(500).json(errorResponse(
          'Failed to create bot character in game backend',
          'CHARACTER_CREATION_FAILED',
          { error: characterResult.error }
        ));
        return;
      }

      // Step 3: Update bot with character ID
      bot.botCharacterId = characterResult.characterId;
      await bot.save();

      logger.info(`[BotController] Created bot ${bot.name} with character ${characterResult.characterId}`);

      res.status(201).json(createResponse({
        botId: bot._id,
        characterId: characterResult.characterId,
        name: bot.name
      }, 'Bot created successfully'));

    } catch (error: any) {
      logger.error('[BotController] Error creating bot:', error);
      res.status(500).json(errorResponse(
        'Failed to create bot',
        'CREATE_BOT_ERROR',
        { error: error.message }
      ));
    }
  }

  /**
   * POST /bots/generate
   * Auto-generate bot using Claude SDK with natural language description
   *
   * NEW: Supports complete character generation with full stats, skills, occupation
   * Set createCompleteCharacter: true in request body to enable
   */
  static async generateBot(req: Request, res: Response): Promise<void> {
    try {
      // Get environment from request
      const environment = getEnvironmentFromRequest(req);
      const dbContext = new DatabaseContext(environment);
      const BotModel = dbContext.getModel<IBot>('Bot', BotSchema);

      logger.info(`[BotController] Generating bot in ${environment} environment (${dbContext.getDatabaseName()})`);

      const {
        locationId,
        description,
        tags,
        createCompleteCharacter = true, // NEW: Default to complete character generation
        campaign_id
      } = req.body;

      // Validate required fields
      if (!locationId || !description) {
        res.status(400).json(errorResponse(
          'locationId and description are required',
          'MISSING_REQUIRED_FIELDS'
        ));
        return;
      }

      logger.info(`[BotController] Generating bot for location ${locationId}`);
      logger.info(`[BotController] Description: ${description}`);
      logger.info(`[BotController] Complete character generation: ${createCompleteCharacter}`);
      if (tags) {
        logger.info(`[BotController] Specified tags: ${JSON.stringify(tags)}`);
      }

      // Step 1: Fetch location details from game-backend
      const locationResult = await gameBackendClient.getLocationDetails(locationId);

      if (!locationResult.success || !locationResult.location) {
        res.status(404).json(errorResponse(
          'Location not found or inaccessible',
          'LOCATION_NOT_FOUND',
          { error: locationResult.error }
        ));
        return;
      }

      const locationDetails = locationResult.location;

      // Step 2: Generate bot details using Claude SDK
      const { botGeneratorService } = await import('../services/BotGeneratorService');

      const generatedData = await botGeneratorService.generateBotDetails({
        locationId,
        locationName: locationDetails.name,
        locationDescription: locationDetails.description,
        description
      });

      // Step 3: Create bot with generated data
      const bot = await BotModel.create({
        botCharacterId: 'temp',
        name: generatedData.name,
        surname: generatedData.surname,
        gender: generatedData.gender || 'male',
        publicDescription: generatedData.publicDescription,

        // NUOVO: Assi psicologici
        psychologicalAxes: generatedData.psychologicalAxes,

        // NUOVO: Ferita centrale
        centralWound: generatedData.centralWound,

        // NUOVO: Maschera pubblica vs verità privata
        duality: generatedData.duality,

        personality: generatedData.personality,
        goals: generatedData.goals,

        // NUOVO: Emozioni attive array (vuoto di default)
        activeEmotions: [],

        currentEmotionalState: {
          primaryMood: 'neutro',
          intensity: 5,
          secondaryEmotions: [],
          lastUpdated: new Date()
        },
        activationRules: {
          keywords: generatedData.activationKeywords,
          contextualRelevance: 50,
          cooldownMinutes: 5
        },
        assignedLocations: [locationId], // Auto-assign to location
        tags: tags || generatedData.tags || [], // Use specified tags, or generated tags, or empty array
        isActive: true
      });

      // Log complete generated data
      logger.info(`[BotController] ===== GENERATED BOT DATA =====`);
      logger.info(`[BotController] Name: ${generatedData.name} ${generatedData.surname}`);
      logger.info(`[BotController] Gender: ${generatedData.gender}`);
      logger.info(`[BotController] Personality traits: ${JSON.stringify(generatedData.personality.traits)}`);
      logger.info(`[BotController] Core values: ${JSON.stringify(generatedData.personality.coreValues)}`);
      logger.info(`[BotController] Speech pattern: ${generatedData.personality.speechPattern}`);
      logger.info(`[BotController] Short-term goals: ${JSON.stringify(generatedData.goals.shortTerm)}`);
      logger.info(`[BotController] Long-term goals: ${JSON.stringify(generatedData.goals.longTerm)}`);
      logger.info(`[BotController] Physical description: ${generatedData.physicalDescription?.substring(0, 150)}...`);
      logger.info(`[BotController] Public description: ${generatedData.publicDescription}`);
      logger.info(`[BotController] Background: ${JSON.stringify(generatedData.background)}`);
      logger.info(`[BotController] Activation keywords: ${JSON.stringify(generatedData.activationKeywords)}`);
      logger.info(`[BotController] Location tags: ${JSON.stringify(generatedData.tags || [])}`);
      logger.info(`[BotController] Stats: ${JSON.stringify(generatedData.stats)}`);
      logger.info(`[BotController] ===========================`);

      // Step 4: Create character in game-backend
      let characterResult;

      if (createCompleteCharacter) {
        // NEW: Generate COMPLETE character with full stats, skills, occupation
        logger.info(`[BotController] Generating COMPLETE bot character with EnhancedBotGeneratorService`);

        try {
          const { enhancedBotGeneratorService } = await import('../services/EnhancedBotGeneratorService');

          // Prepare parameters for complete generation
          const botParams = {
            name: generatedData.name,
            surname: generatedData.surname,
            gender: generatedData.gender || 'male',
            personality: {
              traits: generatedData.personality.traits,
              values: generatedData.personality.coreValues,
              goals: [...generatedData.goals.shortTerm, ...generatedData.goals.longTerm]
            },
            background: generatedData.background.briefHistory || '',
            campaign_id,
            publicDescription: generatedData.publicDescription,
            privateDescription: generatedData.privateDescription
          };

          // Generate complete bot
          const completeBot = await enhancedBotGeneratorService.generateCompleteBot(botParams, dbContext);

          // Set bot_id in character payload
          completeBot.character.bot_id = bot._id.toString();

          // Create complete character in game-backend
          characterResult = await gameBackendClient.createCompleteBotCharacter(completeBot.character);

          logger.info(`[BotController] ✅ Complete character created with ${Object.keys(completeBot.character.skills).length} skills`);

        } catch (completeGenError: any) {
          logger.error(`[BotController] Complete generation failed, falling back to minimal: ${completeGenError.message}`);

          // Fallback to minimal character creation
          characterResult = await gameBackendClient.createBotCharacter(
            generatedData.name,
            generatedData.surname || '',
            bot._id.toString(),
            generatedData.physicalDescription,
            generatedData.publicDescription,
            generatedData.privateDescription,
            generatedData.background,
            generatedData.stats,
            generatedData.gender || 'male'
          );
        }
      } else {
        // Original minimal character creation
        characterResult = await gameBackendClient.createBotCharacter(
          generatedData.name,
          generatedData.surname || '',
          bot._id.toString(),
          generatedData.physicalDescription,
          generatedData.publicDescription,
          generatedData.privateDescription,
          generatedData.background,
          generatedData.stats,
          generatedData.gender || 'male'
        );
      }

      if (!characterResult.success || !characterResult.characterId) {
        // Rollback
        await BotModel.findByIdAndDelete(bot._id);

        res.status(500).json(errorResponse(
          'Failed to create bot character in game backend',
          'CHARACTER_CREATION_FAILED',
          { error: characterResult.error }
        ));
        return;
      }

      // Step 5: Update bot with character ID
      bot.botCharacterId = characterResult.characterId;
      await bot.save();

      // Step 6: Update location.bot_enabled = true
      const enableResult = await gameBackendClient.enableBotForLocation(locationId, true);

      if (!enableResult.success) {
        logger.warn(`[BotController] Failed to enable bot for location ${locationId}: ${enableResult.error}`);
        // Non-blocking: bot is created but location is not flagged
      }

      logger.info(`[BotController] Generated bot ${bot.name} with character ${characterResult.characterId}`);

      res.status(201).json(createResponse({
        botId: bot._id,
        characterId: characterResult.characterId,
        name: bot.name,
        locationId,
        generatedDetails: {
          personality: generatedData.personality,
          goals: generatedData.goals,
          physicalDescription: generatedData.physicalDescription,
          background: generatedData.background
        }
      }, 'Bot generated and created successfully'));

    } catch (error: any) {
      logger.error('[BotController] Error generating bot:', error);
      res.status(500).json(errorResponse(
        'Failed to generate bot',
        'GENERATE_BOT_ERROR',
        { error: error.message }
      ));
    }
  }

  /**
   * GET /bots
   * Get all bots
   */
  static async getBots(req: Request, res: Response): Promise<void> {
    try {
      // Get environment from request
      const environment = getEnvironmentFromRequest(req);
      const dbContext = new DatabaseContext(environment);
      const BotModel = dbContext.getModel<IBot>('Bot', BotSchema);

      logger.debug(`[BotController] Fetching bots from ${environment} environment`);

      const bots = await BotModel.find().sort({ createdAt: -1 });

      res.json(successResponse(bots));
    } catch (error: any) {
      logger.error('[BotController] Error fetching bots:', error);
      res.status(500).json(errorResponse(
        'Failed to fetch bots',
        'FETCH_BOTS_ERROR'
      ));
    }
  }

  /**
   * GET /bots/:botId
   * Get bot by ID
   */
  static async getBot(req: Request, res: Response): Promise<void> {
    try {
      // Get environment from request
      const environment = getEnvironmentFromRequest(req);
      const dbContext = new DatabaseContext(environment);
      const BotModel = dbContext.getModel<IBot>('Bot', BotSchema);

      const { botId } = req.params;

      const bot = await BotModel.findById(botId);

      if (!bot) {
        res.status(404).json(errorResponse('Bot not found', 'BOT_NOT_FOUND'));
        return;
      }

      res.json(successResponse(bot));
    } catch (error: any) {
      logger.error('[BotController] Error fetching bot:', error);
      res.status(500).json(errorResponse(
        'Failed to fetch bot',
        'FETCH_BOT_ERROR'
      ));
    }
  }

  /**
   * PUT /bots/:botId
   * Update bot configuration
   */
  static async updateBot(req: Request, res: Response): Promise<void> {
    try {
      // Get environment from request
      const environment = getEnvironmentFromRequest(req);
      const dbContext = new DatabaseContext(environment);
      const BotModel = dbContext.getModel<IBot>('Bot', BotSchema);

      const { botId } = req.params;
      const updates = req.body;

      // Don't allow updating botCharacterId
      delete updates.botCharacterId;

      const bot = await BotModel.findByIdAndUpdate(
        botId,
        updates,
        { new: true, runValidators: true }
      );

      if (!bot) {
        res.status(404).json(errorResponse('Bot not found', 'BOT_NOT_FOUND'));
        return;
      }

      logger.info(`[BotController] Updated bot ${bot.name}`);

      res.json(updateResponse(bot, 'Bot updated successfully'));
    } catch (error: any) {
      logger.error('[BotController] Error updating bot:', error);
      res.status(500).json(errorResponse(
        'Failed to update bot',
        'UPDATE_BOT_ERROR',
        { error: error.message }
      ));
    }
  }

  /**
   * DELETE /bots/:botId
   * Delete bot (soft delete - set isActive to false)
   */
  static async deleteBot(req: Request, res: Response): Promise<void> {
    try {
      // Get environment from request
      const environment = getEnvironmentFromRequest(req);
      const dbContext = new DatabaseContext(environment);
      const BotModel = dbContext.getModel<IBot>('Bot', BotSchema);

      const { botId } = req.params;

      const bot = await BotModel.findByIdAndUpdate(
        botId,
        { isActive: false },
        { new: true }
      );

      if (!bot) {
        res.status(404).json(errorResponse('Bot not found', 'BOT_NOT_FOUND'));
        return;
      }

      logger.info(`[BotController] Deactivated bot ${bot.name}`);

      res.json(deleteResponse('Bot deactivated successfully'));
    } catch (error: any) {
      logger.error('[BotController] Error deleting bot:', error);
      res.status(500).json(errorResponse(
        'Failed to delete bot',
        'DELETE_BOT_ERROR'
      ));
    }
  }

  /**
   * POST /bots/:botId/activate
   * Activate bot
   */
  static async activateBot(req: Request, res: Response): Promise<void> {
    try {
      // Get environment from request
      const environment = getEnvironmentFromRequest(req);
      const dbContext = new DatabaseContext(environment);
      const BotModel = dbContext.getModel<IBot>('Bot', BotSchema);

      const { botId } = req.params;

      const bot = await BotModel.findByIdAndUpdate(
        botId,
        { isActive: true },
        { new: true }
      );

      if (!bot) {
        res.status(404).json(errorResponse('Bot not found', 'BOT_NOT_FOUND'));
        return;
      }

      logger.info(`[BotController] Activated bot ${bot.name}`);

      res.json(updateResponse(bot, 'Bot activated successfully'));
    } catch (error: any) {
      logger.error('[BotController] Error activating bot:', error);
      res.status(500).json(errorResponse(
        'Failed to activate bot',
        'ACTIVATE_BOT_ERROR'
      ));
    }
  }

  /**
   * PATCH /bots/:botId/emotional-state
   * Update bot emotional state
   */
  static async updateEmotionalState(req: Request, res: Response): Promise<void> {
    try {
      // Get environment from request
      const environment = getEnvironmentFromRequest(req);
      const dbContext = new DatabaseContext(environment);
      const BotModel = dbContext.getModel<IBot>('Bot', BotSchema);

      const { botId } = req.params;
      const { mood, intensity } = req.body;

      if (!mood || intensity === undefined) {
        res.status(400).json(errorResponse(
          'mood and intensity are required',
          'MISSING_FIELDS'
        ));
        return;
      }

      const bot = await BotModel.findByIdAndUpdate(
        botId,
        {
          currentEmotionalState: {
            mood,
            intensity: Math.max(1, Math.min(10, intensity)),
            lastUpdated: new Date()
          }
        },
        { new: true }
      );

      if (!bot) {
        res.status(404).json(errorResponse('Bot not found', 'BOT_NOT_FOUND'));
        return;
      }

      logger.info(`[BotController] Updated emotional state for bot ${bot.name}: ${mood} (${intensity})`);

      res.json(updateResponse(bot.currentEmotionalState, 'Emotional state updated'));
    } catch (error: any) {
      logger.error('[BotController] Error updating emotional state:', error);
      res.status(500).json(errorResponse(
        'Failed to update emotional state',
        'UPDATE_EMOTIONAL_STATE_ERROR'
      ));
    }
  }

  /**
   * POST /bots/:botId/assign-locations
   * Assign bot to one or more locations
   */
  static async assignLocations(req: Request, res: Response): Promise<void> {
    try {
      // Get environment from request
      const environment = getEnvironmentFromRequest(req);
      const dbContext = new DatabaseContext(environment);
      const BotModel = dbContext.getModel<IBot>('Bot', BotSchema);

      const { botId } = req.params;
      const { locationIds } = req.body;

      if (!locationIds || !Array.isArray(locationIds) || locationIds.length === 0) {
        res.status(400).json(errorResponse(
          'locationIds required (must be non-empty array)',
          'INVALID_INPUT'
        ));
        return;
      }

      const bot = await BotModel.findById(botId);
      if (!bot) {
        res.status(404).json(errorResponse('Bot not found', 'BOT_NOT_FOUND'));
        return;
      }

      // Add to assignedLocations using $addToSet (no duplicates)
      await BotModel.findByIdAndUpdate(
        botId,
        { $addToSet: { assignedLocations: { $each: locationIds } } },
        { new: true }
      );

      const updatedBot = await BotModel.findById(botId);

      logger.info(`[BotController] Assigned ${locationIds.length} location(s) to bot ${bot.name}`);

      res.json(successResponse(updatedBot, 'Locations assigned successfully'));
    } catch (error: any) {
      logger.error('[BotController] Error assigning locations:', error);
      res.status(500).json(errorResponse(
        'Failed to assign locations',
        'ASSIGN_LOCATIONS_ERROR'
      ));
    }
  }

  /**
   * DELETE /bots/:botId/unassign-locations
   * Remove bot from one or more locations
   */
  static async unassignLocations(req: Request, res: Response): Promise<void> {
    try {
      // Get environment from request
      const environment = getEnvironmentFromRequest(req);
      const dbContext = new DatabaseContext(environment);
      const BotModel = dbContext.getModel<IBot>('Bot', BotSchema);

      const { botId } = req.params;
      const { locationIds } = req.body;

      if (!locationIds || !Array.isArray(locationIds)) {
        res.status(400).json(errorResponse(
          'locationIds required (must be array)',
          'INVALID_INPUT'
        ));
        return;
      }

      const bot = await BotModel.findById(botId);
      if (!bot) {
        res.status(404).json(errorResponse('Bot not found', 'BOT_NOT_FOUND'));
        return;
      }

      // Remove from assignedLocations
      await BotModel.findByIdAndUpdate(
        botId,
        { $pull: { assignedLocations: { $in: locationIds } } },
        { new: true }
      );

      const updatedBot = await BotModel.findById(botId);

      logger.info(`[BotController] Unassigned ${locationIds.length} location(s) from bot ${bot.name}`);

      res.json(successResponse(updatedBot, 'Locations unassigned successfully'));
    } catch (error: any) {
      logger.error('[BotController] Error unassigning locations:', error);
      res.status(500).json(errorResponse(
        'Failed to unassign locations',
        'UNASSIGN_LOCATIONS_ERROR'
      ));
    }
  }

  /**
   * GET /bots/:botId/locations
   * Get locations assigned to a bot
   */
  static async getBotLocations(req: Request, res: Response): Promise<void> {
    try {
      // Get environment from request
      const environment = getEnvironmentFromRequest(req);
      const dbContext = new DatabaseContext(environment);
      const BotModel = dbContext.getModel<IBot>('Bot', BotSchema);

      const { botId } = req.params;
      const bot = await BotModel.findById(botId);

      if (!bot) {
        res.status(404).json(errorResponse('Bot not found', 'BOT_NOT_FOUND'));
        return;
      }

      res.json(successResponse({
        botId: bot._id,
        name: bot.name,
        assignedLocations: bot.assignedLocations || [],
        count: bot.assignedLocations?.length || 0
      }));
    } catch (error: any) {
      logger.error('[BotController] Error getting bot locations:', error);
      res.status(500).json(errorResponse(
        'Failed to get bot locations',
        'GET_BOT_LOCATIONS_ERROR'
      ));
    }
  }

  /**
   * GET /locations/:locationId/bots
   * Get all bots assigned to a location
   */
  static async getLocationBots(req: Request, res: Response): Promise<void> {
    try {
      // Get environment from request
      const environment = getEnvironmentFromRequest(req);
      const dbContext = new DatabaseContext(environment);
      const BotModel = dbContext.getModel<IBot>('Bot', BotSchema);

      const { locationId } = req.params;
      const bots = await BotModel.find({
        isActive: true,
        assignedLocations: locationId
      }).select('name personality currentEmotionalState assignedLocations');

      res.json(successResponse({
        locationId,
        bots,
        count: bots.length
      }));
    } catch (error: any) {
      logger.error('[BotController] Error getting location bots:', error);
      res.status(500).json(errorResponse(
        'Failed to get location bots',
        'GET_LOCATION_BOTS_ERROR'
      ));
    }
  }
}
