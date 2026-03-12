import { Request, Response } from 'express';
import { Character, Location, Chat, Skill, Item, Occupation, User, OffGameChat, OffGameChatMessage, OffGameChatParticipant, CharacterFinances } from '@database/models';
import { ApiResponse, DiceResult, ChatActionType } from '../types/game';
import { logger } from '../utils/logger';
import { LocationService } from '../services/LocationService';
import { redis } from '@config/runtime/redis';
import { CharacterCreationConfigService } from '@shared/services/CharacterCreationConfigService';
import { successResponse, errorResponse, createResponse, updateResponse, getRequestId } from '../utils/apiResponse';
import { getWeather } from '../services/WeatherService';

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
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Verify character belongs to user
      if (character.userId.toString() !== userId) {
        res.status(403).json(errorResponse(
          'Accesso al personaggio negato',
          'CHARACTER_ACCESS_DENIED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Get user data for admin permissions
      const user = await (User.findById(userId) as any);
      if (!user) {
        res.status(404).json(errorResponse(
          'Utente non trovato',
          'USER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Get locations and presence data using centralized service (if not excluded)
      let locations: any[] = [];
      let globalPresence: any[] = [];
      
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
      let characterFinances = null;
      if (!exclude.includes('items')) {
        items = await (Item.find({
          $or: [
            { isPublic: true },
            { 'shopSettings.canBePurchased': true }
          ],
          isAdminOnly: false
        })
          .sort({ category: 1, name: 1 })
          .lean() as any);

        // Load character finances for APPROVED characters (for financial calculations)
        if (character.playerStatus === 'approved') {
          characterFinances = await (CharacterFinances.findOne({ characterId }) as any);
        }
      }

      // Calculate admin permissions
      const canAccessAdmin = user.canAccessAdminPanel &&
        user.characterRoles.some((role: string) => ['master', 'moderatore', 'amministratore'].includes(role));
      
      const canAccessTickets = canAccessAdmin; // Same permissions for now
      
      // For tickets, we need to mock workable count until actual implementation
      const workableTicketsCount = canAccessTickets ? Math.floor(Math.random() * 5) : 0; // Mock data

      // Fetch base skills from database (for all character statuses, not just DRAFT)
      const baseSkills = await (Skill.find({ visible: true })
        .sort({ sortOrder: 1, name: 1 })
        .lean() as any);

      // Prepare response data
      const responseData: any = {
        character: {
          id: character.id,
          name: character.name,
          occupation: character.occupation,
          currentLocation: character.currentLocation,
          gameplayRoles: character.gameplayRoles,
          status: character.playerStatus,
          hitPoints: character.hit_points,
          magicPoints: character.magic_points,
          sanity: character.sanity,
          // Include skills for character data (needed for skill checks)
          skills: character.skills || {},
          // NEW: Include dynamic skills for placeholder skill system
          dynamicSkills: character.dynamicSkills || [],
          // Include financial data for APPROVED characters
          ...(characterFinances && character.playerStatus === 'approved' && {
            finances: {
              cash: characterFinances.cash,
              bankDeposit: characterFinances.bankDeposit,
              totalWealth: characterFinances.cash + characterFinances.bankDeposit,
              socialClass: characterFinances.socialClass,
              creditLine: {
                maxWeekly: characterFinances.creditLine.maxWeekly,
                currentAvailable: characterFinances.creditLine.currentAvailable,
                nextResetDate: characterFinances.creditLine.nextResetDate
              }
            }
          })
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
        items: items.map((item: any) => {
          // Map prerequisites to requirements for compatibility with frontend
          const itemWithRequirements = {
            id: item._id.toString(),
            name: item.name,
            description: item.description,
            category: item.category,
            subcategory: item.subcategory,
            price: item.basePrice,
            basePrice: item.basePrice,
            priceFormatted: GameController.formatCurrency(item.basePrice),
            properties: item.properties,
            imageUrl: item.imageUrl,

            // Shop settings
            canBePurchased: item.shopSettings?.canBePurchased ?? true,
            canBeSold: item.shopSettings?.canBeSold ?? false,
            canBeTradedBetweenPlayers: item.shopSettings?.canBeTradedBetweenPlayers ?? false,
            sellBackPrice: item.shopSettings?.sellBackPrice,

            // Map prerequisites to requirements for frontend compatibility
            requirements: {
              occupations: item.prerequisites?.requiredOccupations || [],
              corporations: item.prerequisites?.requiredCorporations || [],
              skills: item.prerequisites?.minimumSkills || {},
              socialClass: item.prerequisites?.requiredSocialClass || [],
              financialClasses: item.prerequisites?.requiredFinancialClasses || []
            },

            // Keep prerequisites for backward compatibility
            prerequisites: item.prerequisites
          };

          // Add financial info if character is APPROVED and has finances
          if (characterFinances && character.playerStatus === 'approved') {
            const meetsReqs = GameController.meetsRequirements(itemWithRequirements, character);
            const totalWealth = characterFinances.cash + characterFinances.bankDeposit;
            const canAffordCash = totalWealth >= item.basePrice;
            const canAffordCredit = GameController.canPurchaseWithCredit(item, characterFinances, item.basePrice);
            const meetsSocialClass = GameController.canPurchaseBySocialClass(item, characterFinances.socialClass);

            return {
              ...itemWithRequirements,
              canPurchase: meetsReqs && meetsSocialClass,
              canPurchaseWithCash: canAffordCash,
              canPurchaseWithCredit: canAffordCredit,
              creditEligible: item.financialSettings?.eligibleForCredit || false,
              socialClasses: item.financialSettings?.socialClassesEligible || []
            };
          }

          return itemWithRequirements;
        }),
        // Include skillTemplates for all character statuses (not just DRAFT)
        skillTemplates: baseSkills.map((skill: any) => ({
          id: skill._id.toString(),
          name: skill.name,
          baseValue: skill.baseValue,
          category: skill.category,
          description: skill.description,
          defaultSkill: skill.defaultSkill,
          sortOrder: skill.sortOrder,
          isPlaceholder: skill.isPlaceholder || false,
          placeholderType: skill.placeholderType || undefined,
          predefinedValues: skill.predefinedValues || [],
          canRollWithoutPoints: skill.canRollWithoutPoints !== undefined ? skill.canRollWithoutPoints : true
        }))
      };

      // Add DRAFT-specific configuration if character is in DRAFT status
      logger.info('Character status check', { status: character.playerStatus, isDraft: character.playerStatus === 'draft' });
      if (character.playerStatus === 'draft') {


        // Fetch base occupations for character creation
        const baseOccupations = await (Occupation.find({ isActive: true })
          .populate('requiredSkillSlots.options', 'name category isPlaceholder placeholderType')
          .populate('bonusSkills.skillId', 'name category')
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

        // Load character creation configuration
        const configService = CharacterCreationConfigService.getInstance();
        const characterConfig = await configService.loadConfig();

        responseData.draftConfiguration = {
          characterStatTotalPoints: characterConfig.stats.totalPoints,
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
            category: occupation.category,
            contacts: occupation.contacts,
            earnings: occupation.earnings,
            requiredSkillSlots: (occupation.requiredSkillSlots || []).map((slot: any) => ({
              options: (slot.options || []).map((opt: any) => ({
                skillId: opt._id?.toString() || opt.toString(),
                name: opt.name || '',
                category: opt.category || '',
                isPlaceholder: opt.isPlaceholder || false,
                placeholderType: opt.placeholderType,
              })),
            })),
            bonusSkills: (occupation.bonusSkills || []).map((bs: any) => ({
              skillId: bs.skillId?._id?.toString() || bs.skillId?.toString() || '',
              name: bs.skillId?.name || '',
              bonusValue: bs.bonusValue,
            })),
          })),
          characterCreationConfig: characterConfig
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

      responseData.weather = await getWeather();

      logger.info('Game initialized', {
        userId,
        characterId,
        characterName: character.name,
        characterStatus: character.playerStatus,
        accessibleLocations: locations.length,
        totalActiveCharacters: globalPresence.length,
        isDraft: character.playerStatus === 'draft',
        canAccessAdmin: canAccessAdmin,
        canAccessTickets: canAccessTickets,
        userRoles: user.userRoles,
        characterRoles: user.characterRoles,
        unreadOffGameMessages
      });

      res.json(successResponse(
        responseData,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Game initialization error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile inizializzare il gioco',
        'GAME_INIT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }


  /**
   * GET /game/location-history/:locationId
   * Get recent location actions (chat history)
   */
  static async getLocationHistory(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const { locationId } = req.params;
      const characterId = req.character!.characterId;
      const limit = parseInt(req.query.limit as string) || 50;
      const before = req.query.before as string; // For pagination

      // Verify character has access to location
      const character = await (Character.findById(characterId) as any);
      const location = await (Location.findById(locationId) as any);

      if (!location || !character) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check location access (reuse LocationController logic)
      const hasAccess = await GameController.checkLocationAccess(location, character);
      if (!hasAccess) {
        res.status(404).json(errorResponse(
          'Location non trovata',
          'LOCATION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Build query for location actions (filter by current session)
      const query: any = { locationId };
      if (before) {
        query.timestamp = { $lt: new Date(before) };
      }
      // Filter by current session if active
      if (location.activeSession?.sessionId) {
        query.sessionId = location.activeSession.sessionId.toString();
      }

      // Get actions that character can see
      const actions = await (Chat.find(query)
        .sort({ timestamp: -1 })
        .limit(limit) as any);

      // Filter actions by visibility permissions
      const visibleActions = actions.filter((action: any) => 
        GameController.canSeeAction(action, character)
      );

      res.json(successResponse(
        {
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
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get location history error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare lo storico della location',
        'LOCATION_HISTORY_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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

      res.json(successResponse(
        {
          globalPresence: globalPresence
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get global presence error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      
      res.status(500).json(errorResponse(
        'Impossibile recuperare la presenza globale',
        'GLOBAL_PRESENCE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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

  private static validateActionPermissions(actionType: ChatActionType, roles: string[]): boolean {
    const requiredRoles = GameController.getRequiredRoles(actionType);
    return requiredRoles.some(role => roles.includes(role));
  }

  private static getRequiredRoles(actionType: ChatActionType): string[] {
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

  private static getActionVisibility(actionType: ChatActionType, targetCharacters?: string[]): 'public' | 'whisper' | 'master_only' {
    if (actionType === 'whisper' && targetCharacters && targetCharacters.length > 0) {
      return 'whisper';
    }
    if (actionType === 'moderation') {
      return 'master_only';
    }
    return 'public';
  }

  private static async getBroadcastTargets(location: any, actionType: ChatActionType, targetCharacters?: string[]): Promise<string[]> {
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
        res.status(400).json(errorResponse(
          'ID location obbligatorio (usa stringa vuota per Londra)',
          'MISSING_LOCATION_ID',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Get character
      const character = await (Character.findById(characterId) as any);
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
          res.status(404).json(errorResponse(
            'Location not found',
            'LOCATION_NOT_FOUND',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }

        // Check if location is accessible (use LocationService for consistency)
        const accessibleLocations = await LocationService.getAccessibleLocations(characterId);
        const hasAccess = accessibleLocations.some(loc => loc._id === locationId);

        if (!hasAccess) {
          res.status(403).json(errorResponse(
            'Accesso alla location negato',
            'LOCATION_ACCESS_DENIED',
            undefined,
            403,
            getRequestId(req)
          ));
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
        const redisPublisher = redis.getPublisher();
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

      res.json(updateResponse(
        {
          characterId: character.id,
          newLocationId: locationId,
          locationName: location.name
        },
        `Moved to ${location.name}`,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('❌ Set character location error:', {
        message: err.message,
        stack: err.stack,
        characterId: req.character?.characterId,
        locationId: req.body?.locationId,
        requestBody: req.body
      });
      
      res.status(500).json(errorResponse(
        'Impossibile aggiornare la location del personaggio',
        'SET_LOCATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
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

  // Financial Helper Methods (for item purchase calculations at /game/init)

  private static formatCurrency(pence: number): string {
    return `${pence} penny`;
  }

  private static meetsRequirements(item: any, character: any): boolean {
    if (!item.requirements) return true;

    // Check skill requirements
    if (item.requirements.skills) {
      for (const [skillName, minValue] of Object.entries(item.requirements.skills)) {
        const characterSkill = character.skills?.[skillName] || 0;
        if (characterSkill < (minValue as number)) {
          return false;
        }
      }
    }

    // Check occupation requirements
    if (item.requirements.occupations && item.requirements.occupations.length > 0) {
      if (!item.requirements.occupations.includes(character.occupation)) {
        return false;
      }
    }

    // Check corporation requirements
    if (item.requirements.corporations && item.requirements.corporations.length > 0) {
      const characterCorps = character.corporations?.map((c: any) => c.id?.toString() || c.toString()) || [];
      const hasRequiredCorp = item.requirements.corporations.some(
        (reqCorp: any) => characterCorps.includes(reqCorp.toString())
      );
      if (!hasRequiredCorp) return false;
    }

    return true;
  }

  private static canPurchaseWithCredit(item: any, finances: any, price?: number): boolean {
    if (!item.financialSettings?.eligibleForCredit) return false;
    const itemPrice = price || item.basePrice;
    return finances.creditLine.currentAvailable >= itemPrice;
  }

  private static mapSocialClassToItemClass(characterSocialClass: string): string {
    const classMapping: { [key: string]: string } = {
      'destitute': 'Lower Class',
      'poor': 'Lower Class',
      'modest': 'Working Class',
      'lower_middle': 'Middle Class',
      'middle_class': 'Middle Class',
      'wealthy': 'Upper Class',
      'affluent': 'Upper Class',
      'elite': 'Upper Class'
    };

    return classMapping[characterSocialClass] || characterSocialClass;
  }

  private static canPurchaseBySocialClass(item: any, characterSocialClass: string): boolean {
    // If item has no social class restrictions, everyone can buy
    if (!item.financialSettings?.socialClassesEligible || item.financialSettings.socialClassesEligible.length === 0) {
      return true;
    }

    // Map character's Italian class name to English item class name
    const mappedClass = GameController.mapSocialClassToItemClass(characterSocialClass);

    // Check if mapped social class is in allowed list
    return item.financialSettings.socialClassesEligible.includes(mappedClass);
  }

}