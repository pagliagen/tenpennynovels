import { Request, Response } from 'express';
import { Character, Location, LocationAction, Skill, Item, Occupation, User, OffGameChat, OffGameChatMessage, OffGameChatParticipant } from '../../../../packages/database/models';
import { ApiResponse, DiceResult, LocationActionType } from '../types/game';
import { logger } from '../utils/logger';
import { LocationService } from '../services/LocationService';
import { getRedisPublisher } from '../config/redis';

export class GameController {
  /**
   * POST /game/init
   * Initialize game data - returns character info and accessible locations
   * Body: { exclude?: ['locations', 'items'] } - optional array to exclude data
   */
  static async initGame(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const userId = req.user!.userId;
      const exclude = req.body.exclude || [];

      // Get character with all needed data
      const character = await (Character.findById(characterId) as any);
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

      // Verify character belongs to user
      if (character.userId.toString() !== userId) {
        const response: ApiResponse = {
          success: false,
          error: 'Accesso al personaggio negato',
          code: 'CHARACTER_ACCESS_DENIED',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      // Get user data for admin permissions
      const user = await (User.findById(userId) as any);
      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: 'Utente non trovato',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Get locations and presence data using centralized service (if not excluded)
      let locations = [];
      let globalPresence = [];
      
      if (!exclude.includes('locations')) {
        const locationData = await LocationService.getLocationAndPresenceData(characterId);
        locations = locationData.locations;
        globalPresence = locationData.globalPresence;
      } else {
        // If locations are excluded, still get globalPresence separately
        globalPresence = await LocationService.getGlobalPresence(characterId);
      }

      // Load items for general use (with filters) if not excluded
      let items = [];
      if (!exclude.includes('items')) {
        items = await (Item.find({
          $or: [
            { isPublic: true },
            { 'shopSettings.canBePurchased': true }
          ],
          isAdminOnly: false,
          'rarity': { $in: ['common', 'uncommon'] }
        })
          .sort({ category: 1, name: 1 })
          .lean() as any);
      }

      // Calculate admin permissions
      const canAccessAdmin = user.canAccessAdminPanel && (
        user.userRoles.includes('gestore') || 
        user.characterRoles.some((role: string) => ['master', 'moderatore', 'amministratore'].includes(role))
      );
      
      const canAccessTickets = canAccessAdmin; // Same permissions for now
      
      // For tickets, we need to mock workable count until actual implementation
      const workableTicketsCount = canAccessTickets ? Math.floor(Math.random() * 5) : 0; // Mock data

      // Prepare response data
      const responseData: any = {
        character: {
          id: character.id,
          name: character.name,
          occupation: character.occupation,
          currentLocation: character.currentLocation,
          gameplayRoles: character.gameplayRoles,
          status: character.status,
          hitPoints: character.hit_points,
          magicPoints: character.magic_points,
          sanity: character.sanity,
          // Include skills for character data (needed for skill checks)
          skills: character.skills || {},
          // NEW: Include dynamic skills for placeholder skill system  
          dynamicSkills: character.dynamicSkills || []
        },
        user: {
          id: user.id,
          username: user.username,
          userRoles: user.userRoles,
          characterRoles: user.characterRoles,
          canAccessAdmin: canAccessAdmin,
          canAccessTickets: canAccessTickets,
          workableTicketsCount: workableTicketsCount
        },
        locations: locations,
        globalPresence: globalPresence,
        items: items.map((item: any) => ({
          id: item._id.toString(),
          name: item.name,
          description: item.description,
          category: item.category,
          subcategory: item.subcategory,
          basePrice: item.basePrice,
          prerequisites: item.prerequisites,
          properties: item.properties,
          rarity: item.rarity
        }))
      };

      // Add DRAFT-specific configuration if character is in DRAFT status
      logger.info('Character status check', { status: character.status, isDraft: character.status === 'DRAFT' });
      if (character.status === 'DRAFT') {
        // Fetch base skills from database
        const baseSkills = await (Skill.find({ visible: true })
          .sort({ sortOrder: 1, name: 1 })
          .lean() as any);


        // Fetch base occupations for character creation
        const baseOccupations = await (Occupation.find({ isActive: true })
          .sort({ category: 1, name: 1 })
          .lean() as any);

        // Create skill ID to name mapping for professional skills conversion
        const skillIdToName = new Map<string, string>();
        baseSkills.forEach((skill: any) => {
          skillIdToName.set(skill._id.toString(), skill.name);
        });

        // Extract all unique item IDs from occupation startingItems
        const occupationItemIds = new Set<string>();
        baseOccupations.forEach((occupation: any) => {
          if (occupation.benefits?.startingItems) {
            occupation.benefits.startingItems.forEach((item: any) => {
              occupationItemIds.add(item.itemId);
            });
          }
        });

        // Load baseItems for DRAFT: ALL items from occupations WITHOUT filters
        // These items may not be in the main 'items' array if they're not sellable/public
        let baseItems = [];
        if (occupationItemIds.size > 0) {
          baseItems = await (Item.find({
            _id: { $in: Array.from(occupationItemIds) }
          })
            .sort({ category: 1, name: 1 })
            .lean() as any);
          
          logger.info('Fetched baseItems for DRAFT', { 
            occupationItemIds: occupationItemIds.size,
            baseItemsFound: baseItems.length,
            firstFewIds: Array.from(occupationItemIds).slice(0, 3)
          });
        }


        responseData.draftConfiguration = {
          characterStatTotalPoints: parseInt(process.env.CHARACTER_STAT_TOTAL_POINTS || '400'),
          baseSkills: baseSkills.map((skill: any) => ({
            id: skill._id.toString(),
            name: skill.name,
            baseValue: skill.baseValue,
            category: skill.category,
            description: skill.description,
            defaultSkill: skill.defaultSkill,
            sortOrder: skill.sortOrder,
            // NEW: Support for placeholder skills (e.g., "Lingua" for dynamic languages)
            isPlaceholder: skill.isPlaceholder || false,
            placeholderType: skill.placeholderType || undefined,
            predefinedValues: skill.predefinedValues || [],
            // NEW: Academic skills that cannot be rolled without points
            canRollWithoutPoints: skill.canRollWithoutPoints !== undefined ? skill.canRollWithoutPoints : true
          })),
          baseItems: baseItems, // Use the general items from responseData
          baseOccupations: baseOccupations.map((occupation: any) => ({
            id: occupation._id.toString(),
            name: occupation.name,
            description: occupation.description,
            allowedGenders: occupation.allowedGenders,
            socialClass: occupation.socialClass,
            dailySalary: occupation.dailySalary,
            socialRespectability: occupation.socialRespectability,
            category: occupation.category,
            contacts: occupation.contacts,
            earnings: occupation.earnings,
            workingConditions: occupation.workingConditions,
            rarity: occupation.rarity,
            // Skills system
            requiredSkills: (occupation.requiredSkills || []).map((req: any) => ({
              skillId: req.skillId?.toString(),
              skillName: req.skillName,
              baseValue: req.baseValue,
              isFixed: req.isFixed,
              alternatives: (req.alternatives || []).map((alt: any) => ({
                skillId: alt.skillId?.toString(),
                skillName: alt.skillName,
                baseValue: alt.baseValue
              }))
            })),
            bonusSkills: (occupation.bonusSkills || []).map((bonus: any) => ({
              skillId: bonus.skillId?.toString(),
              skillName: bonus.skillName,
              bonusValue: bonus.bonusValue
            }))
          }))
        };
      }

      // Get unread offgame messages count
      let unreadOffGameMessages = 0;
      try {
        // Find all chats where character is a participant
        const participations = await OffGameChatParticipant.find({
          characterId,
          isActive: true
        });

        // Count unread messages across all chats
        for (const participation of participations) {
          let unreadCount = 0;
          if (participation.lastSeenMessageId) {
            unreadCount = await OffGameChatMessage.countDocuments({
              chatId: participation.chatId,
              _id: { $gt: participation.lastSeenMessageId },
              senderId: { $ne: characterId }, // Exclude own messages
              deletedAt: { $exists: false }
            });
          } else {
            unreadCount = await OffGameChatMessage.countDocuments({
              chatId: participation.chatId,
              senderId: { $ne: characterId }, // Exclude own messages
              deletedAt: { $exists: false }
            });
          }
          unreadOffGameMessages += unreadCount;
        }
      } catch (error: any) {
        logger.error('Failed to get unread offgame messages count:', error);
        unreadOffGameMessages = 0;
      }

      // Add unread messages count to responseData
      responseData.notifications = {
        unreadOffGameMessages
      };

      logger.info('Game initialized', {
        userId,
        characterId,
        characterName: character.name,
        characterStatus: character.status,
        accessibleLocations: locations.length,
        totalActiveCharacters: globalPresence.length,
        isDraft: character.status === 'DRAFT',
        canAccessAdmin: canAccessAdmin,
        canAccessTickets: canAccessTickets,
        userRoles: user.userRoles,
        characterRoles: user.characterRoles,
        unreadOffGameMessages
      });

      const response: ApiResponse = {
        success: true,
        data: responseData,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Game initialization error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile inizializzare il gioco',
        code: 'GAME_INIT_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /game/ping
   * Validate auth and character context cookies
   */
  static async ping(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;
      const userId = req.user!.userId;

      // Verify character still exists and belongs to user
      const character = await (Character.findById(characterId) as any);
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

      if (character.userId.toString() !== userId) {
        const response: ApiResponse = {
          success: false,
          error: 'Character access denied',
          code: 'CHARACTER_ACCESS_DENIED', 
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      // All characters except DELETED can access game (handled by middleware)

      // Character is online if they're calling this endpoint - update lastActive
      character.lastActive = new Date();
      await character.save();

      // Publish Redis event to update ONLY this client with current globalPresence
      try {
        const redisPublisher = getRedisPublisher();
        const globalPresence = await LocationService.getGlobalPresence(characterId);
        
        const eventData = {
          type: 'globalPresence_update_single',
          characterId: characterId, // Target specific character for single-client update
          globalPresence: globalPresence,
          timestamp: new Date().toISOString()
        };
        
        await redisPublisher.publish('location:events', JSON.stringify(eventData));
        logger.info('📡 Redis: Published globalPresence_update_single event', {
          characterCount: globalPresence.length,
          targetCharacterId: characterId
        });
      } catch (redisError: any) {
        logger.error('❌ Redis: Failed to publish globalPresence_update_single event:', redisError);
      }

      const response: ApiResponse = {
        success: true,
        data: {
          valid: true,
          character: {
            id: character.id,
            name: character.name,
            status: character.status,
            currentLocation: character.currentLocation
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Game ping error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Validazione autenticazione fallita',
        code: 'PING_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  } 

  /**
   * @deprecated Use LocationActionsController.createAction instead
   * POST /game/location-action
   * Send location-based gameplay action
   * Role-based: Action type depends on character's gameplay roles
   */
  static async locationAction(req: Request, res: Response): Promise<void> {
    try {
      const { actionType, content, targetCharacters, diceRoll, itemUsage } = req.body;
      const characterId = req.character!.characterId;
      const characterName = req.character!.characterName;
      const gameplayRoles = req.character!.gameplayRoles;

      // Get character and validate location
      const character = await (Character.findById(characterId) as any);
      if (!character || !character.currentLocation) {
        const response: ApiResponse = {
          success: false,
          error: 'Personaggio non in una location',
          code: 'CHARACTER_NOT_IN_LOCATION',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Validate action type against character roles
      const canPerformAction = GameController.validateActionPermissions(actionType, gameplayRoles);
      if (!canPerformAction) {
        const response: ApiResponse = {
          success: false,
          error: 'Permessi insufficienti per questo tipo di azione',
          code: 'INSUFFICIENT_ACTION_PERMISSIONS',
          details: {
            actionType,
            requiredRoles: GameController.getRequiredRoles(actionType),
            userRoles: gameplayRoles
          },
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      // Validate location has chat enabled
      const location = await (Location.findById(character.currentLocation) as any);
      if (!location || !location.chat) {
        const response: ApiResponse = {
          success: false,
          error: 'Chat non disponibile in questa location',
          code: 'CHAT_NOT_AVAILABLE',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Process dice roll if present
      let diceResult = null;
      if (diceRoll) {
        const skillValue = diceRoll.skill ? (character.skills[diceRoll.skill] || 0) : 50;
        const rollValue = Math.floor(Math.random() * 100) + 1;
        diceResult = GameController.calculateSuccessLevel(rollValue, skillValue, skillValue);
      }

      // Process item usage if present
      let itemEffect = null;
      if (itemUsage) {
        // TODO: Implement item usage logic
        itemEffect = {
          description: 'Item used successfully',
          specialEffects: ['item_used']
        };
      }

      // Determine visibility and target audience
      const visibility = GameController.getActionVisibility(actionType, targetCharacters);
      const broadcastTo = await GameController.getBroadcastTargets(
        location,
        actionType,
        targetCharacters
      );

      // Create location action
      const action = new LocationAction({
        actionType,
        characterId,
        characterName,
        content,
        locationId: character.currentLocation,
        timestamp: new Date(),
        visibility,
        diceResult,
        itemEffect,
        targetCharacters: targetCharacters || [],
        characterRoles: gameplayRoles
      });

      await action.save();

      // TODO: Publish Redis event for WebSocket broadcasting
      // redis.publish('location:action', { action, broadcastTo });
 
      logger.info('Location action sent', {
        actionId: action.id,
        characterId,
        characterName,
        locationId: character.currentLocation,
        actionType,
        visibility
      });

      const response: ApiResponse = {
        success: true,
        data: {
          action: {
            id: action.id,
            actionType: action.actionType,
            characterId: action.characterId,
            characterName: action.characterName,
            content: action.content,
            locationId: action.locationId,
            timestamp: action.timestamp,
            visibility: action.visibility,
            diceResult: action.diceResult,
            itemEffect: action.itemEffect,
            targetCharacters: action.targetCharacters,
            characterRoles: action.characterRoles,
            broadcastTo
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Location action error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile inviare l\'azione location',
        code: 'LOCATION_ACTION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /game/location-history/:locationId
   * Get recent location actions (chat history)
   */
  static async getLocationHistory(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const characterId = req.character!.characterId;
      const limit = parseInt(req.query.limit as string) || 50;
      const before = req.query.before as string; // For pagination

      // Verify character has access to location
      const character = await (Character.findById(characterId) as any);
      const location = await (Location.findById(locationId) as any);

      if (!location || !character) {
        const response: ApiResponse = {
          success: false,
          error: 'Location non trovata',
          code: 'LOCATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Check location access (reuse LocationController logic)
      const hasAccess = await GameController.checkLocationAccess(location, character);
      if (!hasAccess) {
        const response: ApiResponse = {
          success: false,
          error: 'Location non trovata',
          code: 'LOCATION_NOT_FOUND',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Build query for location actions
      const query: any = { locationId };
      if (before) {
        query.timestamp = { $lt: new Date(before) };
      }

      // Get actions that character can see
      const actions = await (LocationAction.find(query)
        .sort({ timestamp: -1 })
        .limit(limit) as any);

      // Filter actions by visibility permissions
      const visibleActions = actions.filter((action: any) => 
        GameController.canSeeAction(action, character)
      );

      const response: ApiResponse = {
        success: true,
        data: {
          actions: visibleActions.map((action: any) => ({
            id: action.id,
            actionType: action.actionType,
            characterId: action.characterId,
            characterName: action.characterName,
            content: action.content,
            timestamp: action.timestamp,
            visibility: action.visibility,
            diceResult: action.diceResult,
            itemEffect: action.itemEffect,
            characterRoles: action.characterRoles
          })),
          hasMore: visibleActions.length === limit,
          nextPage: visibleActions.length > 0 
            ? visibleActions[visibleActions.length - 1].timestamp.toISOString()
            : null
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get location history error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare lo storico della location',
        code: 'LOCATION_HISTORY_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  /**
   * GET /game/presence
   * Get global presence data (all active characters and their locations)
   */
  static async getGlobalPresence(req: Request, res: Response): Promise<void> {
    try {
      const characterId = req.character!.characterId;

      // Get global presence data using centralized service
      const globalPresence = await LocationService.getGlobalPresence(characterId);

      logger.info('Global presence retrieved', {
        characterId,
        totalActiveCharacters: globalPresence.length
      });

      const response: ApiResponse = {
        success: true,
        data: {
          globalPresence: globalPresence
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get global presence error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile recuperare la presenza globale',
        code: 'GLOBAL_PRESENCE_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  // Helper Methods

  private static calculateSuccessLevel(roll: number, target: number, skillValue: number): DiceResult {
    const success = roll <= target;
    let level: string;
    let description: string;

    if (roll === 1) {
      level = 'critical';
      description = 'Critical Success';
    } else if (roll === 100 || (roll >= 96 && !success)) {
      level = 'fumble';
      description = 'Fumble';
    } else if (success) {
      if (roll <= Math.floor(skillValue / 5)) {
        level = 'extreme';
        description = 'Extreme Success';
      } else if (roll <= Math.floor(skillValue / 2)) {
        level = 'hard';
        description = 'Hard Success';
      } else {
        level = 'regular';
        description = 'Regular Success';
      }
    } else {
      level = 'failure';
      description = 'Failure';
    }

    return {
      dice: '1d100',
      result: roll,
      skillValue: target,
      modifier: 0,
      finalTarget: target,
      success,
      level: level as any,
      description
    };
  }

  private static validateActionPermissions(actionType: LocationActionType, roles: string[]): boolean {
    const requiredRoles = GameController.getRequiredRoles(actionType);
    return requiredRoles.some(role => roles.includes(role));
  }

  private static getRequiredRoles(actionType: LocationActionType): string[] {
    const roleMap = {
      standard: ['personaggio'],
      master: ['master', 'gestore'],
      moderation: ['moderatore', 'gestore'],
      whisper: ['personaggio'],
      ooc: ['personaggio'],
      dice_generic: ['personaggio'],
      dice_action: ['personaggio'],
      item_usage: ['personaggio']
    };

    return roleMap[actionType] || ['personaggio'];
  }

  private static getActionVisibility(actionType: LocationActionType, targetCharacters?: string[]): 'public' | 'whisper' | 'master_only' {
    if (actionType === 'whisper' && targetCharacters && targetCharacters.length > 0) {
      return 'whisper';
    }
    if (actionType === 'moderation') {
      return 'master_only';
    }
    return 'public';
  }

  private static async getBroadcastTargets(location: any, actionType: LocationActionType, targetCharacters?: string[]): Promise<string[]> {
    if (actionType === 'whisper' && targetCharacters) {
      // Include sender + targets for whispers
      return targetCharacters;
    }

    // For public actions, return all characters in location
    return location.occupants?.map((occ: any) => occ.characterId) || [];
  }

  private static canSeeAction(action: any, character: any): boolean {
    // Public actions - everyone can see
    if (action.visibility === 'public') return true;

    // Whisper actions - only sender and targets
    if (action.visibility === 'whisper') {
      return action.characterId === character.id || 
             action.targetCharacters?.includes(character.id);
    }

    // Master-only actions - only masters/moderators/gestori
    if (action.visibility === 'master_only') {
      return character.gameplayRoles?.some((role: string) => 
        ['master', 'moderatore', 'gestore'].includes(role)
      );
    }

    return false;
  }

  /**
   * POST /game/character/set-location
   * Update character's current location
   */
  static async setCharacterLocation(req: Request, res: Response): Promise<void> {
    try {
      logger.info('🔍 setCharacterLocation called', {
        body: req.body,
        characterId: req.character?.characterId,
        characterName: req.character?.characterName
      });

      const { locationId } = req.body;
      const characterId = req.character!.characterId;

      logger.info('🔍 setCharacterLocation params', { locationId, characterId });

      // locationId is required in the request body (empty string = London)
      if (locationId === undefined || locationId === null) {
        logger.warn('❌ setCharacterLocation: Missing location ID');
        const response: ApiResponse = {
          success: false,
          error: 'ID location obbligatorio (usa stringa vuota per Londra)',
          code: 'MISSING_LOCATION_ID',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Get character
      const character = await (Character.findById(characterId) as any);
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

      // Get location info for response (declare outside conditional blocks)
      let location: any = null;
      
      // Handle empty locationId (parked at London/root)
      if (locationId === '') {
        // Empty locationId means character is "parked" at London (root)
        // No need to verify access as London is always accessible (but not as a real location)
        location = { name: 'London' }; // Mock location for London/root
      } else {
        // Get location and verify access for specific locations
        location = await (Location.findById(locationId) as any);
        if (!location) {
          const response: ApiResponse = {
            success: false,
            error: 'Location not found',
            code: 'LOCATION_NOT_FOUND',
            timestamp: new Date().toISOString()
          };
          res.status(404).json(response);
          return;
        }

        // Check if location is accessible (use LocationService for consistency)
        const accessibleLocations = await LocationService.getAccessibleLocations(characterId);
        const hasAccess = accessibleLocations.some(loc => loc.id === locationId);

        if (!hasAccess) {
          const response: ApiResponse = {
            success: false,
            error: 'Accesso alla location negato',
            code: 'LOCATION_ACCESS_DENIED',
            timestamp: new Date().toISOString()
          };
          res.status(403).json(response);
          return;
        }
      }

      // Update character location
      const oldLocation = character.currentLocation;
      character.currentLocation = locationId === '' ? null : locationId;
      character.lastActive = new Date();
      await character.save();

      // Character location changes are now tracked only through currentLocation field
      // No need to maintain occupants arrays - globalPresence handles all presence logic

      // Publish Redis event for WebSocket notifications
      try {
        const redisPublisher = getRedisPublisher();
        const eventData = {
          characterId: character.id,
          characterName: character.name,
          oldLocationId: oldLocation?.toString() || null,
          newLocationId: locationId === '' ? null : locationId,
          locationName: location.name,
          timestamp: new Date().toISOString()
        };
        
        const redisEventData = {
          type: 'character_moved',
          ...eventData
        };
        await redisPublisher.publish('location:events', JSON.stringify(redisEventData));
        logger.info('📡 Redis: Published location:events with character_moved type', redisEventData);
      } catch (redisError: any) {
        logger.error('❌ Redis: Failed to publish location:character_moved event:', redisError);
      }

      logger.info('Character location updated', {
        characterId: character.id,
        characterName: character.name,
        oldLocationId: oldLocation?.toString(),
        newLocationId: locationId,
        locationName: location.name
      });

      const response: ApiResponse = {
        success: true,
        message: `Moved to ${location.name}`,
        data: {
          characterId: character.id,
          newLocationId: locationId,
          locationName: location.name
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);

    } catch (error: any) {
      const err = error as Error;
      logger.error('❌ Set character location error:', {
        message: err.message,
        stack: err.stack,
        characterId: req.character?.characterId,
        locationId: req.body?.locationId,
        requestBody: req.body
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Impossibile aggiornare la location del personaggio',
        code: 'SET_LOCATION_ERROR',
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(response);
    }
  }

  private static async checkLocationAccess(location: any, character: any): Promise<boolean> {
    // Location must be visible first
    if (!location.settings?.visible) {
      return false;
    }

    // Public locations are accessible to all
    if (!location.settings?.private) {
      return true;
    }

    // Private locations access control
    if (location.settings?.private) {
      // Check if character is the owner
      if (location.access?.ownerId?.toString() === character.id) {
        return true;
      }
      
      // Check character-specific access
      if (location.access?.characterAccess) {
        const access = location.access.characterAccess.find((a: any) => a.characterId.toString() === character.id);
        if (access) {
          // Check if access is expired
          if (access.duration === 'temporary' && access.expiresAt && new Date() > access.expiresAt) {
            return false;
          }
          return access.permissions.includes('view');
        }
      }
      
      // Check corporation access
      if (location.access?.corporationAccess && character.corporations) {
        const isCorporationMember = character.corporations.some(
          (corp: any) => location.access.corporationAccess.some((corpAccess: any) => 
            corpAccess.corporationId.toString() === corp.id.toString()
          )
        );
        if (isCorporationMember) return true;
      }
    }

    return false;
  }

}