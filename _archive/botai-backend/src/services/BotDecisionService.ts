import { Bot, BotSchema } from '../models/Bot';
import { LocationActionCache, LocationActionCacheSchema } from '../models/LocationActionCache';
import { BotResponse, BotResponseSchema } from '../models/BotResponse';
import { botMemoryService } from './BotMemoryService';
import { relationshipService } from './RelationshipService';
import { claudeAgentService } from './ClaudeAgentService';
import { gameBackendClient } from './GameBackendClient';
import { SentimentAnalysisService } from './SentimentAnalysisService';
import { botSelectionService, MultiTagActionContext } from './BotSelectionService';
import { actionHistoryService } from './ActionHistoryService';
import { logger } from '../utils/logger';
import axios from 'axios';

export class BotDecisionService {
  private sentimentAnalysisService: SentimentAnalysisService;
  private locationBotCache: Map<string, string>; // locationId -> botCharacterId (fallback quando no sessionId)

  constructor() {
    this.sentimentAnalysisService = new SentimentAnalysisService();
    this.locationBotCache = new Map();
  }

  /**
   * Process location action and decide if bot should respond
   */
  async processLocationAction(actionData: any, sessionId: string, dbContext?: any): Promise<void> {
    try {
      const { locationId, characterId, characterName, content, actionId } = actionData;

      // VERBOSE LOGGING
      logger.info(`[BotDecision] ========================================`);
      logger.info(`[BotDecision] Processing action ${actionId}`);
      logger.info(`[BotDecision]   SessionId: ${sessionId || 'NONE'}`);
      logger.info(`[BotDecision]   LocationId: ${locationId}`);
      logger.info(`[BotDecision]   Character: ${characterName} (${characterId})`);
      logger.info(`[BotDecision]   Tags: ${JSON.stringify(actionData.tags)}`);
      logger.info(`[BotDecision]   Content preview: ${content?.substring(0, 50)}...`);
      logger.info(`[BotDecision] ========================================`);

      // Get Bot model from dbContext if available (multi-environment support)
      const BotModel = dbContext ? dbContext.getModel('Bot', BotSchema) : Bot;

      // Cache the action first (pass sessionId explicitly)
      await this.cacheAction(actionData, sessionId, dbContext);

      // ===== SESSION-BASED BOT SELECTION =====
      // If there's an active session, only the bot assigned to that session should respond
      let sessionBot = null;
      let session = null;

      if (sessionId) {
        try {
          const gameBackendUrl = process.env.GAME_BACKEND_URL || 'http://localhost:8000';

          // Get session info to check if a bot is already assigned
          const sessionResponse = await axios.get(
            `${gameBackendUrl}/game/sessions/${sessionId}`,
            {
              headers: { 'x-bot-api-key': process.env.GAME_BACKEND_BOT_API_KEY },
              timeout: 3000
            }
          );

          session = sessionResponse.data?.data?.session || sessionResponse.data;

          if (session?.botCharacterId) {
            // Session already has an assigned bot - use only that bot
            const assignedBot = await BotModel.findOne({
              botCharacterId: session.botCharacterId,
              isActive: true,
              assignedLocations: { $in: [locationId] }
            });

            if (assignedBot) {
              logger.info(`[BotDecision] Session ${sessionId} has assigned bot: ${assignedBot.name}`);
              sessionBot = assignedBot;
            } else {
              logger.warn(`[BotDecision] Session bot ${session.botCharacterId} not found or not active`);
              return;
            }
          }
        } catch (err) {
          logger.debug(`[BotDecision] Could not fetch session info (non-critical): ${err}`);
        }
      }

      // ===== LOCATION-BASED BOT CACHE (FALLBACK) =====
      // If no session bot, check if this location already has an assigned bot
      if (!sessionBot && this.locationBotCache.has(locationId)) {
        const cachedBotCharacterId = this.locationBotCache.get(locationId);
        const cachedBot = await BotModel.findOne({
          botCharacterId: cachedBotCharacterId,
          isActive: true,
          assignedLocations: { $in: [locationId] }
        });

        if (cachedBot) {
          logger.info(`[BotDecision] Location ${locationId} has cached bot: ${cachedBot.name}`);
          sessionBot = cachedBot;
        } else {
          // Cached bot no longer valid, clear cache
          this.locationBotCache.delete(locationId);
        }
      }
      // ===== END LOCATION-BASED BOT CACHE =====

      // Find bots assigned to this location
      // IMPORTANT: For tag-based actions, ignore sessionBot and load all bots
      // This allows multiple bots to operate simultaneously (one per tag)
      const actionTag = actionData.tags; // Check if action has a tag

      logger.info(`[BotDecision] Loading bots for location...`);
      logger.info(`[BotDecision]   SessionBot exists: ${!!sessionBot}`);
      logger.info(`[BotDecision]   ActionTag: ${actionTag || 'NONE'}`);

      let bots = (sessionBot && !actionTag) ? [sessionBot] : await BotModel.find({
        isActive: true,
        assignedLocations: { $in: [locationId] }
      });

      logger.info(`[BotDecision] Found ${bots.length} bots for this location`);
      bots.forEach(bot => {
        logger.info(`[BotDecision]   - ${bot.name} ${bot.surname || ''} (tags: ${JSON.stringify(bot.tags)})`);
      });

      // ===== TAG-BASED FILTERING =====
      // Filter bots that can operate in the action's location zone
      // (actionTag already defined above)

      bots = bots.filter((bot: any) => {
        // Bot without tags → can respond anywhere (backward compatibility)
        if (!bot.tags || bot.tags.length === 0) {
          logger.debug(`[BotDecision] Bot ${bot.name} has no tags - eligible for any zone`);
          return true;
        }

        // Action without tag → only bots without specific tags
        if (!actionTag) {
          logger.debug(`[BotDecision] Action has no tag - bot ${bot.name} with tags excluded`);
          return false;
        }

        // Check if bot can operate in this zone
        const hasMatchingTag = bot.tags.includes(actionTag);

        logger.debug(
          `[BotDecision] Bot ${bot.name} tags: [${bot.tags.join(', ')}] ` +
          `vs Action tag: "${actionTag}" → ${hasMatchingTag ? '✓ MATCH' : '✗ NO MATCH'}`
        );

        return hasMatchingTag;
      });
      // ===== END TAG FILTERING =====

      logger.info(`[BotDecision] After tag filtering: ${bots.length} eligible bots`);
      if (bots.length === 0) {
        logger.warn(`[BotDecision] No bots match the action tag "${actionTag}"`);
      }

      // ===== TAG-SESSION ASSIGNMENT FILTERING =====
      // Each tag is a separate sub-chat. Once a bot responds on a tag, it's locked to that tag for the session
      if (sessionId && actionTag) {
        logger.info(`[BotDecision] Checking session tag assignments...`);
        try {
          const gameBackendUrl = process.env.GAME_BACKEND_URL || 'http://localhost:8000';

          // Fetch session to check tag assignments
          const sessionResponse = await axios.get(
            `${gameBackendUrl}/game/sessions/${sessionId}`,
            {
              headers: { 'x-bot-api-key': process.env.GAME_BACKEND_BOT_API_KEY },
              timeout: 3000
            }
          );

          session = sessionResponse.data?.data?.session || sessionResponse.data;

          if (session?.botTagAssignments) {
            const assignedBotId = session.botTagAssignments[actionTag];

            if (assignedBotId) {
              // A bot is already assigned to this tag - only that bot can respond
              bots = bots.filter((bot: any) => bot._id.toString() === assignedBotId);

              if (bots.length > 0) {
                logger.info(`[BotDecision] Tag "${actionTag}" locked to bot ${bots[0].name} for session ${sessionId}`);
              } else {
                logger.warn(`[BotDecision] Assigned bot ${assignedBotId} not found in eligible bots for tag "${actionTag}"`);
              }
            } else {
              logger.debug(`[BotDecision] No bot assigned yet to tag "${actionTag}" - any eligible bot can claim it`);
            }
          }
        } catch (err) {
          logger.debug(`[BotDecision] Could not check tag assignment: ${err}`);
        }
      }
      // ===== END TAG-SESSION ASSIGNMENT FILTERING =====

      if (bots.length === 0) {
        logger.debug(`[BotDecision] No bots assigned to location ${locationId} (or no tag match)`);
        return;
      }

      logger.debug(`[BotDecision] Found ${bots.length} bot(s) for location ${locationId}${sessionBot ? ' (session-assigned)' : ''}`);

      // ===== AI-DRIVEN BOT SELECTION =====
      // Use AI to decide which bot should respond (tag-based sessions)
      if (sessionId && actionTag && bots.length > 0) {
        // Check if this tag already has assigned bot
        if (session?.botTagAssignments && session.botTagAssignments[actionTag]) {
          // Bot is LOCKED to this tag - use AI to decide if should respond
          const lockedBot = bots[0]; // Already filtered to only assigned bot

          // Get recent actions in this tag for context
          const recentActions = await actionHistoryService.getRecentActions(locationId, 10, dbContext);
          const contextActions = recentActions.filter((a: any) => a.tags === actionTag);

          // AI decision: should locked bot respond?
          const shouldRespondResult = await botSelectionService.shouldLockedBotRespond(
            lockedBot,
            actionData,
            contextActions
          );

          if (shouldRespondResult.shouldRespond || actionData.isBotTurn) {
            logger.info(`[BotDecision] Locked bot ${lockedBot.name} will respond (AI: ${shouldRespondResult.confidence}%, ${shouldRespondResult.reasoning})`);

            await this.generateAndPostBotResponse(lockedBot, actionData, sessionId, dbContext);

            // Cache if no session
            if (!sessionId) {
              this.locationBotCache.set(locationId, lockedBot.botCharacterId);
              logger.info(`[BotDecision] Cached bot ${lockedBot.name} for location ${locationId}`);
            }
          } else {
            logger.info(`[BotDecision] Locked bot ${lockedBot.name} will NOT respond (AI: ${shouldRespondResult.reasoning})`);
          }

          return; // Exit early - locked bot scenario handled
        }

        // No bot assigned to this tag yet - AI selects best bot
        const locationName = `Location ${locationId.substring(0, 8)}`;

        logger.info(`[BotDecision] Building multi-tag context for AI selection...`);
        logger.info(`[BotDecision]   Available bots: ${bots.length}`);
        logger.info(`[BotDecision]   Existing assignments: ${JSON.stringify(session?.botTagAssignments || {})}`);

        const multiTagContext = await this.buildMultiTagContext(
          sessionId,
          locationId,
          locationName,
          bots,
          session?.botTagAssignments || {},
          dbContext
        );

        logger.info(`[BotDecision] Multi-tag context built:`);
        logger.info(`[BotDecision]   Tags with actions: ${multiTagContext.recentActionsByTag.length}`);
        logger.info(`[BotDecision]   Available bots: ${multiTagContext.availableBots.length}`);
        logger.info(`[BotDecision]   Existing assignments: ${JSON.stringify(multiTagContext.existingAssignments)}`);

        const selectionResult = await botSelectionService.selectBotForFirstActivation(
          multiTagContext
        );

        if (selectionResult && selectionResult.shouldRespond) {
          logger.info(
            `[BotSelection] AI selected bot ${selectionResult.selectedBot.name} ` +
            `for tag "${selectionResult.selectedTag}" (confidence: ${selectionResult.confidence}%)`
          );
          logger.debug(`[BotSelection] Reasoning: ${selectionResult.reasoning}`);

          // Find the full bot document from the original bots array
          const selectedBotId = selectionResult.selectedBot.botId || selectionResult.selectedBot._id?.toString();
          const fullBot = bots.find((b: any) => b._id.toString() === selectedBotId);

          if (!fullBot) {
            logger.error(`[BotDecision] Could not find full bot document for selected bot ${selectedBotId}`);
            return;
          }

          await this.generateAndPostBotResponse(
            fullBot,
            actionData,
            sessionId,
            dbContext
          );

          // Register bot-tag assignment
          await this.registerBotTagAssignment(
            sessionId,
            selectionResult.selectedTag,
            fullBot._id.toString()
          );

          return; // Exit - AI selection handled
        } else {
          logger.info('[BotSelection] AI did not select any bot (low confidence or no suitable bot)');
          return;
        }
      }

      // ===== LEGACY: Non-tag or non-session scenarios =====
      // Use old keyword-based logic for backward compatibility
      logger.debug('[BotDecision] Using legacy keyword-based activation (no session or no tags)');

      for (const bot of bots) {
        const shouldRespond = await this.shouldBotRespond(bot, actionData);

        if (shouldRespond) {
          logger.info(`[BotDecision] Bot ${bot.name} should respond (legacy keyword match)`);

          await this.generateAndPostBotResponse(bot, actionData, sessionId, dbContext);

          // Cache this bot for future actions in this location (if no session)
          if (!sessionId) {
            this.locationBotCache.set(locationId, bot.botCharacterId);
            logger.info(`[BotDecision] Cached bot ${bot.name} for location ${locationId}`);
          }

          // Only one bot responds per action
          break;
        } else {
          logger.debug(`[BotDecision] Bot ${bot.name} will NOT respond - no keyword match`);
        }
      }

    } catch (error) {
      logger.error('[BotDecision] Error processing location action:', error);
    }
  }

  /**
   * Decide if bot should respond to action
   */
  private async shouldBotRespond(bot: any, actionData: any): Promise<boolean> {
    try {
      const { content, characterId, timestamp, isBotTurn } = actionData;

      // Don't respond to bot's own actions
      if (characterId === bot.botCharacterId) {
        return false;
      }

      // ===== TURN-BASED SYSTEM =====
      // If this is marked as bot turn, ALWAYS respond
      if (isBotTurn === true) {
        logger.info(`[BotDecision] BOT TURN detected for bot ${bot.name} - responding`);
        return true;
      }
      // ===== END TURN-BASED SYSTEM =====

      // Continue with free-form logic for non-turn-based gameplay

      // Check keyword activation
      const contentLower = content.toLowerCase();
      const hasKeyword = bot.activationRules.keywords.some((keyword: string) =>
        contentLower.includes(keyword.toLowerCase())
      );

      if (hasKeyword) {
        logger.debug(`[BotDecision] Bot ${bot.name} activated by keyword`);
        return true;
      }

      // Check contextual relevance (simplified - can be enhanced)
      const relevanceScore = this.calculateRelevance(bot, actionData);

      if (relevanceScore >= bot.activationRules.contextualRelevance) {
        logger.debug(`[BotDecision] Bot ${bot.name} activated by relevance (${relevanceScore})`);
        return true;
      }

      // Random activation (5% chance for natural conversation)
      if (Math.random() < 0.05) {
        logger.debug(`[BotDecision] Bot ${bot.name} randomly activated`);
        return true;
      }

      return false;

    } catch (error) {
      logger.error('[BotDecision] Error deciding if bot should respond:', error);
      return false;
    }
  }

  /**
   * Calculate relevance score (0-100)
   */
  private calculateRelevance(bot: any, actionData: any): number {
    let score = 0;

    // Check if bot's name is mentioned
    if (actionData.content.toLowerCase().includes(bot.name.toLowerCase())) {
      score += 50;
    }

    // Check if action is a question (contains ?)
    if (actionData.content.includes('?')) {
      score += 20;
    }

    // Check if content relates to bot's goals or values
    const contentLower = actionData.content.toLowerCase();
    bot.personality.coreValues.forEach((value: string) => {
      if (contentLower.includes(value.toLowerCase())) {
        score += 10;
      }
    });

    return Math.min(100, score);
  }

  /**
   * Generate and post bot response
   */
  private async generateAndPostBotResponse(bot: any, actionData: any, sessionId?: string, dbContext?: any): Promise<void> {
    try {
      // ===== ASSIGN BOT TO SESSION IF FIRST RESPONSE =====
      if (sessionId) {
        try {
          const gameBackendUrl = process.env.GAME_BACKEND_URL || 'http://localhost:8000';

          // Assign this bot to the session (idempotent - won't overwrite if already set)
          await axios.patch(
            `${gameBackendUrl}/game/sessions/${sessionId}`,
            { botCharacterId: bot.botCharacterId },
            {
              headers: {
                'x-bot-api-key': process.env.GAME_BACKEND_BOT_API_KEY,
                'Content-Type': 'application/json'
              },
              timeout: 3000
            }
          );

          logger.info(`[BotDecision] Bot ${bot.name} assigned to session ${sessionId}`);
        } catch (err) {
          logger.warn(`[BotDecision] Failed to assign bot to session (non-critical): ${err}`);
        }
      }
      // ===== END ASSIGNMENT =====

      // TODO: Get location data from game-backend or cache
      const locationData = {
        name: 'The Location',
        description: 'A Victorian location'
      };

      // Get present character IDs (for now, just the triggering character)
      const presentCharacterIds = [actionData.characterId];

      // Prepare context for Claude
      const context = await claudeAgentService.prepareBotContext(
        bot,
        locationData,
        actionData,
        presentCharacterIds,
        dbContext
      );

      // Generate response using Claude
      const responseContent = await claudeAgentService.generateBotResponse(context);

      // Create memory of this interaction
      await botMemoryService.createMemory(
        bot._id,
        actionData.locationId,
        'conversation',
        `${actionData.characterName}: ${actionData.content}`,
        [actionData.characterId],
        0,
        50,
        dbContext
      );

      // Get existing relationship for context
      const existingRelationship = await relationshipService.getRelationship(
        bot._id,
        actionData.characterId,
        dbContext
      );

      // Analyze sentiment using Claude
      logger.debug(`[BotDecision] Analyzing sentiment for action from ${actionData.characterName}`);
      const sentimentResult = await this.sentimentAnalysisService.analyzeActionSentiment(
        actionData.content,
        actionData.characterName,
        JSON.stringify(bot.personality),
        existingRelationship ? {
          sentimentScore: existingRelationship.sentimentScore,
          trustLevel: existingRelationship.trustLevel,
          familiarityLevel: existingRelationship.familiarityLevel
        } : undefined
      );

      logger.info(
        `[BotDecision] Sentiment analysis: ${sentimentResult.tone} ` +
        `(sentiment: ${sentimentResult.sentiment}, trust: ${sentimentResult.trustChange}, ` +
        `impact: ${sentimentResult.emotionalImpact})`
      );
      logger.debug(`[BotDecision] Reasoning: ${sentimentResult.reasoning}`);

      // ===== EMOTIONAL FEEDBACK LOOP =====
      // Update bot's emotional state based on sentiment (affects next response)
      await this.updateBotEmotionalState(
        bot,
        sentimentResult,
        actionData.characterName,
        dbContext
      );
      // ===== END EMOTIONAL FEEDBACK LOOP =====

      // Update relationship with advanced sentiment data
      await relationshipService.updateRelationship(
        bot._id,
        actionData.characterId,
        actionData.characterName,
        sentimentResult.sentiment,      // -10 to +10
        sentimentResult.trustChange,    // -5 to +5
        1,                              // familiarity increase
        `${actionData.content.substring(0, 80)}... [${sentimentResult.tone}]`,
        dbContext
      );

      // Post response to game-backend (use same tag as triggering action)
      const postResult = await gameBackendClient.postBotAction(
        bot.botCharacterId,
        bot.name,
        actionData.locationId,
        responseContent,
        'standard',
        actionData.tags || '' // Use same zone tag as the action being responded to
      );

      // Save bot response audit log using correct database connection
      const BotResponseModel = dbContext
        ? dbContext.getModel('BotResponse', BotResponseSchema)
        : BotResponse;

      await BotResponseModel.create({
        botId: bot._id,
        triggeredByActionId: actionData.actionId,
        locationId: actionData.locationId,
        responseContent,
        emotionalState: {
          mood: bot.currentEmotionalState.mood,
          intensity: bot.currentEmotionalState.intensity
        },
        sentimentChanges: [{
          characterId: actionData.characterId,
          oldSentiment: existingRelationship?.sentimentScore || 50,
          newSentiment: Math.min(100, Math.max(0, (existingRelationship?.sentimentScore || 50) + sentimentResult.sentiment))
        }],
        generatedAt: new Date(),
        postedAt: postResult.success ? new Date() : undefined,
        success: postResult.success,
        error: postResult.error
      });

      if (postResult.success) {
        logger.info(`[BotDecision] Bot ${bot.name} response posted successfully`);

        // ===== NOTIFY TURN COMPLETION =====
        if (actionData.sessionId && actionData.isBotTurn) {
          try {
            await axios.post(
              `${process.env.GAME_BACKEND_URL}/game/sessions/${actionData.sessionId}/complete-bot-turn`,
              {},
              {
                headers: {
                  'x-bot-api-key': process.env.GAME_BACKEND_BOT_API_KEY
                },
                timeout: 3000
              }
            );
            logger.info(`[BotDecision] Bot turn completed notification sent for session ${actionData.sessionId}`);
          } catch (notifyError) {
            logger.warn('[BotDecision] Failed to notify turn completion (non-critical):', notifyError);
          }
        }
        // ===== END TURN COMPLETION =====
      } else {
        logger.error(`[BotDecision] Failed to post bot response:`, postResult.error);
      }

    } catch (error) {
      logger.error('[BotDecision] Error generating and posting bot response:', error);

      // Only attempt to save failed response if it's not a database connection error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isDatabaseError = errorMessage.includes('buffering timed out') ||
                             errorMessage.includes('ECONNREFUSED') ||
                             errorMessage.includes('connection') ||
                             errorMessage.includes('MongoError');

      if (!isDatabaseError) {
        try {
          // Save failed response using correct database connection
          const BotResponseModel = dbContext
            ? dbContext.getModel('BotResponse', BotResponseSchema)
            : BotResponse;

          await BotResponseModel.create({
            botId: bot._id,
            triggeredByActionId: actionData.actionId,
            locationId: actionData.locationId,
            responseContent: '[ERROR: Failed to generate bot response]',
            emotionalState: {
              mood: bot.currentEmotionalState.mood,
              intensity: bot.currentEmotionalState.intensity
            },
            sentimentChanges: [],
            generatedAt: new Date(),
            success: false,
            error: errorMessage
          });
        } catch (saveError) {
          logger.error('[BotDecision] Failed to save error response (database may be unavailable):', saveError);
        }
      } else {
        logger.error('[BotDecision] Skipping error response save due to database connection issue');
      }
    }
  }

  /**
   * Cache action for future reference
   */
  private async cacheAction(actionData: any, sessionId?: string, dbContext?: any): Promise<void> {
    try {
      // Get LocationActionCache model from dbContext if available (multi-environment support)
      const LocationActionCacheModel = dbContext
        ? dbContext.getModel('LocationActionCache', LocationActionCacheSchema)
        : LocationActionCache;

      await LocationActionCacheModel.create({
        actionId: actionData.actionId,
        locationId: actionData.locationId,
        sessionId: sessionId, // Include sessionId for session history (passed as parameter)
        characterId: actionData.characterId,
        characterName: actionData.characterName,
        actionType: actionData.actionType,
        content: actionData.content,
        timestamp: actionData.timestamp || new Date(),
        tags: actionData.tags || '', // Single string tag
        visibility: actionData.visibility || 'public',
        processedByBots: [],
        cachedAt: new Date()
      });

      logger.debug(`[BotDecision] Cached action ${actionData.actionId}`);
    } catch (error) {
      // Ignore duplicate key errors (action already cached)
      if ((error as any).code !== 11000) {
        logger.error('[BotDecision] Error caching action:', error);
      }
    }
  }

  /**
   * Build multi-tag context for AI bot selection
   */
  private async buildMultiTagContext(
    sessionId: string,
    locationId: string,
    locationName: string,
    bots: any[],
    existingAssignments: { [tag: string]: string },
    dbContext?: any
  ): Promise<MultiTagActionContext> {
    // Get recent actions grouped by tag
    const actionsByTag = await actionHistoryService.getRecentActionsByTag(
      locationId,
      sessionId,
      10,
      dbContext
    );

    // Format bot data for AI selection
    const availableBots = bots.map((bot: any) => ({
      botId: bot._id.toString(),
      name: bot.name,
      surname: bot.surname,
      personality: bot.personality,
      goals: bot.goals,
      tags: bot.tags || [],
      currentEmotionalState: bot.currentEmotionalState,
      publicDescription: bot.publicDescription
    }));

    return {
      sessionId,
      locationId,
      locationName,
      recentActionsByTag: actionsByTag,
      availableBots,
      existingAssignments
    };
  }

  /**
   * Register bot-tag assignment for session
   */
  private async registerBotTagAssignment(
    sessionId: string,
    tag: string,
    botId: string
  ): Promise<void> {
    try {
      const gameBackendUrl = process.env.GAME_BACKEND_URL || 'http://localhost:8000';

      await axios.patch(
        `${gameBackendUrl}/game/sessions/${sessionId}`,
        {
          [`botTagAssignments.${tag}`]: botId
        },
        {
          headers: {
            'x-bot-api-key': process.env.GAME_BACKEND_BOT_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 3000
        }
      );

      logger.info(`[BotDecision] Registered bot ${botId} to tag "${tag}" for session ${sessionId}`);
    } catch (err) {
      logger.warn(`[BotDecision] Failed to register bot-tag assignment (non-critical): ${err}`);
    }
  }

  /**
   * Update bot's emotional state based on sentiment analysis
   * This creates the feedback loop: Sentiment → Emotional State → Next Response
   */
  private async updateBotEmotionalState(
    bot: any,
    sentimentResult: any,
    characterName: string,
    dbContext?: any
  ): Promise<void> {
    try {
      // Map sentiment to emotions
      let newEmotion: { name: string; intensity: number; trigger: string } | null = null;

      // Strong negative sentiment → irritation/anger
      if (sentimentResult.sentiment < -5) {
        newEmotion = {
          name: 'irritato',
          intensity: Math.min(10, Math.abs(sentimentResult.sentiment)),
          trigger: `interazione negativa con ${characterName}`
        };
      }
      // Strong positive sentiment → happiness/excitement
      else if (sentimentResult.sentiment > 5) {
        newEmotion = {
          name: 'felice',
          intensity: Math.min(10, sentimentResult.sentiment),
          trigger: `interazione positiva con ${characterName}`
        };
      }
      // Hostile tone → defensive/angry
      else if (sentimentResult.tone === 'hostile' || sentimentResult.tone === 'offensive') {
        newEmotion = {
          name: 'offeso',
          intensity: 7,
          trigger: `tono ostile di ${characterName}`
        };
      }
      // Flirtatious → flustered/intrigued
      else if (sentimentResult.tone === 'flirtatious') {
        newEmotion = {
          name: 'imbarazzato',
          intensity: 5,
          trigger: `approccio romantico di ${characterName}`
        };
      }
      // Strong trust loss → hurt/betrayed
      else if (sentimentResult.trustChange < -3) {
        newEmotion = {
          name: 'deluso',
          intensity: Math.abs(sentimentResult.trustChange) * 2,
          trigger: `perdita di fiducia in ${characterName}`
        };
      }

      if (newEmotion) {
        // Update bot's active emotions
        const activeEmotions = [newEmotion];

        // Get Bot model from dbContext if available
        const BotModel = dbContext ? dbContext.getModel('Bot', BotSchema) : Bot;

        // Save to database
        await BotModel.findByIdAndUpdate(bot._id, {
          activeEmotions: activeEmotions
        });

        // Update local bot object for immediate use
        bot.activeEmotions = activeEmotions;

        logger.info(
          `[BotDecision] Updated emotional state for ${bot.name}: ` +
          `${newEmotion.name} (intensity: ${newEmotion.intensity}/10)`
        );
      } else {
        // Clear emotions if sentiment is neutral
        const BotModel = dbContext ? dbContext.getModel('Bot', BotSchema) : Bot;
        await BotModel.findByIdAndUpdate(bot._id, {
          activeEmotions: []
        });
        bot.activeEmotions = [];

        logger.debug(`[BotDecision] Cleared emotional state for ${bot.name} (neutral sentiment)`);
      }

    } catch (error) {
      logger.error('[BotDecision] Error updating bot emotional state:', error);
      // Non-critical error, don't throw
    }
  }
}

export const botDecisionService = new BotDecisionService();
