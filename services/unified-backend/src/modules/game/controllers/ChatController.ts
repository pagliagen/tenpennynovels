import { Request, Response } from 'express';
import { Chat, GamingSession, Location, Character, SkillConfrontation, CombatEncounter } from '@database/models';
import { logger } from '../utils/logger';
import { redis } from '@config/runtime/redis';
import { successResponse, errorResponse, createResponse, getRequestId } from '../utils/apiResponse';
import { calculateSuccessDegree, getSuccessDegreeLabel, compareSuccessDegrees, SuccessDegree } from '../utils/successDegrees';
import { calculateSocialConflict, isValidSocialSkillPair, getDefensiveSkill } from '../utils/socialConflicts';
import { getSocketIO } from '../websocket/socketInstance';

export class ChatController {

  /**
   * Populate character avatars for messages
   * Performs batch lookup of avatars from Character collection
   */
  private static async populateCharacterAvatars(messages: any[]): Promise<any[]> {
    if (messages.length === 0) return messages;

    // Get unique character IDs
    const characterIds = [...new Set(messages.map(m => m.characterId))];

    // Batch lookup avatars
    const characters = await Character.find({ _id: { $in: characterIds } })
      .select('_id avatar')
      .lean();

    // Create ID -> avatar map
    const avatarMap = new Map(
      characters.map((c: any) => [c._id.toString(), c.avatar])
    );

    // Add avatar to each message
    return messages.map(message => ({
      ...message,
      characterAvatar: avatarMap.get(message.characterId) || undefined
    }));
  }

  /**
   * Create a new location action (message)
   * POST /game/locations/actions
   */
  static async createMessage(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse(
          'Character context required',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const {
        actionType,
        content,
        locationId,
        visibility,
        targetCharacters,
        diceSpec,
        skillId, // ObjectId of skill (secure - looked up from character)
        statName,
        itemId,
        position,
        isHidden
      } = req.body;

      // Validate required fields
      if (!actionType || !content || !locationId) {
        res.status(400).json(errorResponse(
          'actionType, content, and locationId are required',
          'MISSING_REQUIRED_FIELDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate action type permissions
      const isValidAction = ChatController.validateActionPermission(
        actionType,
        character.gameplayRoles || [],
        character.isGestore || false
      );
      
      if (!isValidAction) {
        res.status(403).json(errorResponse(
          `You don't have permission to perform ${actionType} actions`,
          'INSUFFICIENT_PERMISSIONS',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Fetch location
      const Location = require('../../../database/models').Location;
      const location = await Location.findById(locationId);

      // ===== SESSION MANAGEMENT =====
      // Ensure there's an active session for this location
      let sessionId: string | undefined;
      const now = new Date();

      if (location?.activeSession?.sessionId && location.activeSession.lastActivityAt) {
        // Location has an active session - check if it's expired (1 hour inactivity)
        const hoursSinceLastActivity = (now.getTime() - new Date(location.activeSession.lastActivityAt).getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastActivity >= 1) {
          // Session expired - create new session
          logger.info(`[Session] Session expired (${hoursSinceLastActivity.toFixed(2)}h since last activity), creating new session`);
          sessionId = await location.getOrCreateSession(character.characterId, character.characterName);
        } else {
          // Session still active - refresh TTL
          sessionId = location.activeSession.sessionId.toString();
          await location.refreshSessionTTL(character.characterId, character.characterName);
          logger.info(`[Session] Refreshed TTL for session ${sessionId} (${hoursSinceLastActivity.toFixed(2)}h since last activity)`);
        }
      } else {
        // No active session - create new auto-generated session
        sessionId = await location.getOrCreateSession(character.characterId, character.characterName);
        logger.info(`[Session] Created new auto-session ${sessionId} for location ${locationId}`);
      }
      // ===== END SESSION MANAGEMENT =====

      // Check if action mode is active and if this action should be hidden
      let shouldHide = false;
      if (isHidden !== undefined) {
        shouldHide = isHidden;
      } else {
        // Check if session has active action mode
        if (sessionId) {
          const session = await GamingSession.findById(sessionId);
          if (session?.actionModeActive && session.actionModeEndsAt && new Date() < session.actionModeEndsAt) {
            shouldHide = true;
          }
        }
      }

      // Build the location action
      const actionData: any = {
        actionType,
        characterId: character.characterId,
        characterName: character.characterName,
        content: content.trim(),
        locationId,
        sessionId, // Copy sessionId from location to action
        timestamp: new Date(),
        visibility: visibility || ChatController.getActionVisibility(actionType),
        characterRoles: character.gameplayRoles || [],
        position: position || undefined,
        isHidden: shouldHide
      };

      // Handle special action types
      if (actionType === 'whisper' && targetCharacters) {
        actionData.targetCharacters = targetCharacters;
      }

      // Handle dice rolling actions (sempre 1d100)
      if (actionType === 'dice_roll') {
        actionData.diceResult = ChatController.rollDice();
      }

      // Handle skill checks (SECURE: lookup actual skill value from character DB)
      if (actionType === 'skill_check' && skillId) {
        // Fetch full character document to get skill value (security: prevent value manipulation)
        const fullCharacter = await Character.findById(character.characterId).lean();
        if (!fullCharacter) {
          res.status(404).json(errorResponse(
            'Character not found',
            'CHARACTER_NOT_FOUND',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }

        // Get actual skill value from character (cannot be manipulated by client)
        const skillValue = fullCharacter.skills?.[skillId];
        if (skillValue === undefined) {
          res.status(400).json(errorResponse(
            'Character does not have this skill',
            'SKILL_NOT_FOUND',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
        }

        // Extract numeric value (handle both number and SkillBreakdown)
        const targetValue = typeof skillValue === 'number' ? skillValue : skillValue.total;

        // Fetch skill name from Skill model
        const skillDoc = await (await import('@database/models')).Skill.findById(skillId).select('name').lean();
        const skillName = skillDoc?.name || 'Unknown Skill';

        const rollResult = ChatController.rollDice('1d100');
        const successDegree = calculateSuccessDegree(rollResult.result, targetValue);
        const successLabel = getSuccessDegreeLabel(successDegree.degree);

        // Format message with success degree (no dice numbers shown)
        actionData.content = `${character.characterName} tira ${skillName} facendo un ${successLabel}`;

        actionData.diceResult = {
          ...rollResult,
          skillId,
          skillName,
          target: targetValue,
          success: rollResult.result <= targetValue
        };
        actionData.successDegree = successDegree.degree;
      }

      // Handle stat checks (SECURE: lookup actual stat value from character DB)
      if (actionType === 'stat_check' && statName) {
        // Fetch full character document to get stat value (security: prevent value manipulation)
        const fullCharacter = await Character.findById(character.characterId).lean();
        if (!fullCharacter) {
          res.status(404).json(errorResponse(
            'Character not found',
            'CHARACTER_NOT_FOUND',
            undefined,
            404,
            getRequestId(req)
          ));
          return;
        }

        // Get actual stat value from character (cannot be manipulated by client)
        const targetValue = fullCharacter.stats?.[statName];
        if (targetValue === undefined) {
          res.status(400).json(errorResponse(
            'Character does not have this stat',
            'STAT_NOT_FOUND',
            undefined,
            400,
            getRequestId(req)
          ));
          return;
        }

        const rollResult = ChatController.rollDice('1d100');
        const successDegree = calculateSuccessDegree(rollResult.result, targetValue);
        const successLabel = getSuccessDegreeLabel(successDegree.degree);

        // Format message with success degree (capitalize stat name for display, no dice numbers)
        const statDisplayName = statName.charAt(0).toUpperCase() + statName.slice(1);
        actionData.content = `${character.characterName} tira ${statDisplayName} facendo un ${successLabel}`;

        actionData.diceResult = {
          ...rollResult,
          statName,
          target: targetValue,
          success: rollResult.result <= targetValue
        };
        actionData.successDegree = successDegree.degree;
      }

      // Handle item usage
      if (actionType === 'item_use' && itemId) {
        // TODO: Implement item usage logic with character inventory
        actionData.itemEffect = {
          itemId,
          itemName: 'Item Name', // Will be fetched from database
          description: 'Item used successfully',
          effects: []
        };
      }


      // Save to database
      const savedAction = await ((Chat as any).createAction(actionData));

      // Lookup character avatar from DB (not from token - token may be stale)
      const actionCharacter = await Character.findById(character.characterId).select('avatar').lean();
      const characterAvatar = actionCharacter?.avatar;

      // Update occupant position tag if position was provided
      if (position) {
        try {
          const location = await Location.findById(locationId);
          if (location) {
            await location.updateOccupantTag(character.characterId, position);
            logger.info(`Updated occupant position for ${character.characterName} in ${locationId}: ${position}`);
          }
        } catch (error) {
          // Don't fail the request if position update fails
          logger.error('Failed to update occupant position:', error);
        }
      }

      // Note: Embedding event automatically published by Chat.post('save') middleware

      // Emit WebSocket notification with full message (frontend expects complete ChatMessage)
      const io = getSocketIO();
      console.log('🔌 ChatsController: io instance:', io ? 'FOUND' : 'NOT FOUND');

      if (io) {
        const roomName = `location_${locationId}`;

        // Return DB fields directly (no mapping)
        const chatMessage = {
          _id: savedAction._id.toString(),
          actionType: savedAction.actionType,           // DB field (was messageType)
          characterId: savedAction.characterId,
          characterName: savedAction.characterName,
          characterAvatar: characterAvatar || undefined,  // Looked up from DB
          position: savedAction.position || undefined,
          locationId: savedAction.locationId.toString(),
          content: savedAction.content,                 // DB field (was text)
          diceResult: savedAction.diceResult || undefined,  // DB field (was diceRoll)
          socialConflict: savedAction.socialConflict || undefined,  // DB field (was skillCheck)
          statCheck: savedAction.statCheck || undefined,
          itemEffect: savedAction.itemEffect || undefined,  // DB field (was itemUse)
          targetCharacters: savedAction.targetCharacters || undefined,  // DB field (was whisperVisibility)
          editHistory: savedAction.editHistory || [],
          timestamp: savedAction.timestamp.toISOString()  // DB field (was createdAt/updatedAt)
        };

        const notification = {
          message: chatMessage,  // ✅ Full message as frontend expects
          locationId,
          locationName: location?.name || 'Location sconosciuta',
          locationSlug: location?.slug || null
        };

        console.log('🔔 ChatsController: Emitting notification to room:', roomName, 'with message:', chatMessage._id);
        io.to(roomName).emit('location_message_notification', notification);

        // Debug: Check how many clients are in the room
        const room = io.sockets.adapter.rooms.get(roomName);
        console.log('👥 ChatsController: Clients in room', roomName, ':', room ? room.size : 0);
      } else {
        console.error('❌ ChatsController: Socket.io instance not found in req.app');
      }

      logger.info(`Location action created: ${character.characterName} (${actionType}) in ${locationId}`);

      // ========== TURN MANAGEMENT ==========
      let isBotTurnNext = false;
      try {
        const location = await Location.findById(locationId);

        // If location has active session with turn order
        if (location?.activeSession?.sessionId) {
          const session = await GamingSession.findById(location.activeSession.sessionId);

          if (session?.turnOrder && session.turnOrder.length > 0) {
            const { turnManager } = await import('../services/TurnManager');

            // Get current turn info
            const turnInfo = await turnManager.getCurrentTurnInfo(session._id);

            if (turnInfo && turnInfo.currentCharacterId === character.characterId) {
              // Valid turn, advance
              logger.info(`[TurnManager] Player ${character.characterName} completed their turn`);

              const nextTurn = await turnManager.advanceTurn(session._id);

              // If next turn is bot, we'll set flag for notification
              if (nextTurn?.isBot) {
                isBotTurnNext = true;
                logger.info(`[TurnManager] Next turn is BOT, will notify local-ai with isBotTurn flag`);
              }

              // Emit WebSocket event for turn advancement
              if (io && nextTurn) {
                io.to(`location_${locationId}`).emit('turn_advanced', {
                  locationId,
                  sessionId: session._id.toString(),
                  currentCharacterId: nextTurn.currentCharacterId,
                  currentCharacterName: nextTurn.currentCharacterName,
                  isBot: nextTurn.isBot,
                  turnIndex: nextTurn.currentTurnIndex
                });
              }
            } else if (turnInfo) {
              logger.warn(`[TurnManager] Action by ${character.characterName} but not their turn (current: ${turnInfo.currentCharacterName})`);
            }
          }
        }
      } catch (turnError) {
        logger.error('[TurnManager] Error managing turns:', turnError);
        // Don't block action creation if turn management fails
      }
      // ========== END TURN MANAGEMENT ==========

      // Check if location has bot configured and notify AI gateway
      try {
        const { aiGatewayClient } = await import('../services/AIGatewayClient');

        if (location?.bot_enabled) {
          const shouldNotify = !sessionId || !(await GamingSession.findById(sessionId))?.botDisabledForSession;

          if (shouldNotify) {
            const healthy = await aiGatewayClient.isHealthy();
            if (healthy) {
              const recentActionsRaw = await Chat.find({ locationId })
                .sort({ timestamp: -1 }).limit(10).lean();

              // Filter actions to protect privacy - AI should not see private messages
              const recentActions = recentActionsRaw.filter((action: any) => {
                // Only send public messages
                if (action.visibility === 'public') return true;

                // Hide whispers (private conversations)
                if (action.visibility === 'whisper') return false;

                // Hide master-only messages
                if (action.visibility === 'master_only') return false;

                // Hide hidden skill/stat checks
                if (action.isHidden) return false;

                return true;
              });

              const presentChars = await Chat.distinct('characterId', {
                locationId,
                timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
              });
              const presentCharacters = await Character.find({ _id: { $in: presentChars } })
                .select('_id name').lean();

              const botId = location.bot_id || '';
              const botCharacter = location.botCharacterId
                ? await Character.findById(location.botCharacterId).lean()
                : null;

              const callbackSecret = process.env.AI_GATEWAY_WEBHOOK_SECRET;
              const backendUrl = process.env.BACKEND_URL || 'https://api.tenpennynovels.it';

              const success = await aiGatewayClient.notifyBotAction({
                requestId: savedAction._id.toString(),
                bot: { id: botId.toString(), name: botCharacter?.name || 'Bot' },
                context: {
                  location: {
                    id: locationId,
                    name: location.name,
                    description: location.description,
                  },
                  triggeringAction: {
                    id: savedAction._id.toString(),
                    characterId: character.characterId,
                    characterName: character.characterName,
                    content: content.trim(),
                    type: actionType,
                  },
                  recentActions: recentActions.reverse().map((a: any) => ({
                    characterId: a.characterId?.toString(),
                    characterName: a.characterName,
                    content: a.content,
                    timestamp: a.timestamp?.toISOString(),
                  })),
                  presentCharacters: presentCharacters.map((c: any) => ({
                    id: c._id.toString(),
                    name: c.name,
                  })),
                },
                callback: callbackSecret ? {
                  url: `${backendUrl}/game/webhooks/bot-response`,
                  method: 'POST',
                  headers: { Authorization: `Bearer ${callbackSecret}` },
                } : undefined,
              });

              if (!success && sessionId) {
                const session = await GamingSession.findById(sessionId);
                if (session) {
                  session.botDisabledForSession = true;
                  await session.save();
                  logger.info(`[AIGateway] Bot disabled for session ${session._id} due to connection failure`);
                }
              }
            }
          }
        }
      } catch (botError) {
        logger.error('Failed to notify AI gateway:', botError);
      }

      // Prepare response action data (DB fields - no mapping)
      const responseAction: any = {
        _id: savedAction._id.toString(),
        actionType: savedAction.actionType,
        characterId: savedAction.characterId,
        characterName: savedAction.characterName,
        characterAvatar: characterAvatar || undefined,  // Looked up from DB
        position: savedAction.position || undefined,
        locationId: savedAction.locationId.toString(),
        content: savedAction.content,
        timestamp: savedAction.timestamp,
        visibility: savedAction.visibility,
        diceResult: savedAction.diceResult,
        itemEffect: savedAction.itemEffect,
        targetCharacters: savedAction.targetCharacters || undefined,
        editHistory: savedAction.editHistory || []
      };
      
      // Filter socialConflict: for Raggirare, attacker should never see it
      if (savedAction.socialConflict) {
        const socialConflict = savedAction.socialConflict as any;
        if (socialConflict.visibleToDefenderOnly) {
          // Attacker should never see socialConflict for Raggirare
          // Don't include it in response
        } else {
          // For non-hidden social conflicts, include it
          responseAction.socialConflict = socialConflict;
        }
      }

      res.json(createResponse(
        {
          action: responseAction
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Create location action error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      res.status(500).json(errorResponse(
        'Failed to create location action',
        'CREATE_ACTION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Get location action history
   * GET /game/locations/:locationId/actions
   */
  static async getMessages(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse(
          'Character context required',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const { locationId } = req.params;
      const hours = parseInt(req.query.hours as string) || 3;
      const limit = parseInt(req.query.limit as string) || 100;

      // Calculate time threshold
      const timeThreshold = new Date();
      timeThreshold.setHours(timeThreshold.getHours() - hours);

      // Get actions from the last X hours, visible to this character
      const actions = await Chat.find({
        locationId,
        timestamp: { $gte: timeThreshold },
        $or: [
          { visibility: 'public' },
          {
            visibility: 'whisper',
            $or: [
              { characterId: character.characterId },
              { targetCharacters: { $in: [character.characterId] } }
            ]
          },
          { 
            visibility: 'master_only',
            // Will be filtered client-side based on roles
          }
        ]
      })
      .sort({ timestamp: 1 }) // Chronological order
      .limit(limit)
      .lean() as any[];

      // Check action mode status
      const Location = require('../../../database/models').Location;
      const location = await Location.findById(locationId);
      let isActionModeActive = false;
      if (location?.activeSession?.sessionId) {
        const session = await GamingSession.findById(location.activeSession.sessionId);
        isActionModeActive = !!(session?.actionModeActive && session.actionModeEndsAt && new Date() < session.actionModeEndsAt);
      }

      // Check if character has master role (for visibility checks)
      const isMaster = character.gameplayRoles?.some((role: string) =>
        ['master', 'moderatore'].includes(role)
      );

      // Filter master_only messages and hidden actions based on character roles and action mode
      const filteredActions = actions.filter((action: any) => {
        // Filter master_only messages
        if (action.visibility === 'master_only') {
          if (!isMaster) return false;
        }

        // Filter hidden actions (action mode)
        if (action.isHidden && !action.revealedAt && isActionModeActive) {
          // Action mode still active: only show to sender
          return action.characterId === character.characterId;
        }

        // CRITICAL SECURITY: Filter messages with visibleToDefenderOnly flag
        // (Raggirare failure notifications should only be visible to defender and master)
        if (action.socialConflict?.visibleToDefenderOnly) {
          if (isMaster) return true;
          // Check if current character is the defender (in targetCharacters)
          const isDefender = action.targetCharacters?.includes(character.characterId);
          return isDefender;
        }

        // CRITICAL SECURITY: Filter skill_check messages (social conflicts)
        // Only sender and master can see skill checks (includes Raggirare, Persuasione, etc.)
        if (action.actionType === 'skill_check') {
          if (isMaster) return true;
          // Only sender sees their own skill check
          return action.characterId === character.characterId;
        }

        // CRITICAL SECURITY: Filter stat_check messages
        // Only sender and master can see stat checks
        if (action.actionType === 'stat_check') {
          if (isMaster) return true;
          return action.characterId === character.characterId;
        }

        return true;
      }).map((action: any) => {
        // Return DB fields directly (no mapping)
        const chatMessage: any = {
          _id: action._id.toString(),
          actionType: action.actionType,           // DB field (was messageType)
          characterId: action.characterId,
          characterName: action.characterName,
          position: action.position || undefined,
          locationId: action.locationId.toString(),
          content: action.content,                 // DB field (was text)
          diceResult: action.diceResult || undefined,  // DB field (was diceRoll)
          socialConflict: action.socialConflict || undefined,  // DB field (was skillCheck)
          statCheck: action.statCheck || undefined,
          itemEffect: action.itemEffect || undefined,  // DB field (was itemUse)
          targetCharacters: action.targetCharacters || undefined,  // DB field (was whisperVisibility)
          hiddenContent: action.hiddenContent || undefined,
          editHistory: action.editHistory || [],
          timestamp: action.timestamp.toISOString()  // DB field (was createdAt/updatedAt)
        };

        // CRITICAL SECURITY: Filter socialConflict data for Raggirare based on visibility rules
        if (chatMessage.socialConflict?.visibleToDefenderOnly) {
          const isAttacker = action.characterId === character.characterId;
          const isDefender = action.targetCharacters?.includes(character.characterId);

          // Attacker should NEVER see socialConflict data for Raggirare
          if (isAttacker) {
            delete chatMessage.socialConflict;
          }
          // Defender can see it only if they detected something (result !== 'victory')
          else if (!isDefender || chatMessage.socialConflict.result === 'victory') {
            delete chatMessage.socialConflict;
          }
        }

        return chatMessage;
      });

      // Populate character avatars from DB (batch lookup for performance)
      const messagesWithAvatars = await ChatController.populateCharacterAvatars(filteredActions);

      logger.info(`Retrieved ${messagesWithAvatars.length} location messages for ${character.characterName} in ${locationId}`);

      res.json(successResponse(
        {
          messages: messagesWithAvatars,  // ✅ Frontend expects "messages" not "actions"
          totalCount: filteredActions.length,
          hasMore: false  // TODO: Implement pagination
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get location actions error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      res.status(500).json(errorResponse(
        'Failed to retrieve location actions',
        'GET_ACTIONS_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Validate if character has permission for action type
   * Uses NEW gameplayRoles system: player, approved-player, master, moderatore
   */
  private static validateActionPermission(actionType: string, gameplayRoles: string[], isGestore: boolean = false): boolean {
    // Gestore bypass (super-admin)
    if (isGestore) return true;

    switch (actionType) {
      case 'master':
        // Only master role can perform master actions
        return gameplayRoles.includes('master');
      case 'moderation':
        // Only moderatore role can perform moderation actions
        return gameplayRoles.includes('moderatore');
      case 'standard':
      case 'whisper':
      case 'ooc':
      case 'dice_roll':
      case 'skill_check':
      case 'stat_check':
      case 'item_use':
        // All approved players can perform standard actions
        return gameplayRoles.includes('player') ||
               gameplayRoles.includes('master') ||
               gameplayRoles.includes('moderatore');
      default:
        return false;
    }
  }

  /**
   * Get visibility level for action type
   */
  private static getActionVisibility(actionType: string): 'public' | 'whisper' | 'master_only' {
    switch (actionType) {
      case 'whisper':
        return 'whisper';
      case 'moderation':
        return 'master_only';
      default:
        return 'public';
    }
  }

  /**
   * Simple dice rolling function
   */
  private static rollDice(diceSpec?: string): { result: number } {
    // Sistema percentuale: SOLO 1d100
    // Ignora diceSpec, usa sempre 1d100
    const result = Math.floor(Math.random() * 100) + 1;
    return { result };
  }

  /**
   * Update an existing location action (edit)
   * PATCH /game/locations/actions/:actionId
   */
  static async updateMessage(req: Request<{ actionId: string }>, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse(
          'Character context required',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const { actionId } = req.params;
      const { content } = req.body;

      if (!content) {
        res.status(400).json(errorResponse(
          'content is required',
          'MISSING_REQUIRED_FIELDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Find the action
      const action = await Chat.findById(actionId);
      if (!action) {
        res.status(404).json(errorResponse(
          'Action not found',
          'ACTION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check permissions: only the creator can edit, or master
      const isOwner = action.characterId === character.characterId;
      const isMaster = character.gameplayRoles?.includes('master') || character.isGestore;
      
      if (!isOwner && !isMaster) {
        res.status(403).json(errorResponse(
          'You can only edit your own actions',
          'INSUFFICIENT_PERMISSIONS',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Check time limit: 30 seconds for non-masters (TEST - production: 5 minutes)
      if (!isMaster) {
        const timeWindowMs = 30 * 1000; // 30 seconds (TEST) - Production: 5 * 60 * 1000
        const timeWindowAgo = new Date(Date.now() - timeWindowMs);
        if (action.timestamp < timeWindowAgo) {
          res.status(403).json(errorResponse(
            'You can only edit actions within 30 seconds of posting',
            'EDIT_TIME_EXPIRED',
            undefined,
            403,
            getRequestId(req)
          ));
          return;
        }

        // Check if there's a subsequent action from the same character
        const subsequentAction = await Chat.findOne({
          locationId: action.locationId,
          characterId: character.characterId,
          timestamp: { $gt: action.timestamp }
        });

        if (subsequentAction) {
          res.status(403).json(errorResponse(
            'You cannot edit an action after posting a subsequent one',
            'SUBSEQUENT_ACTION_EXISTS',
            undefined,
            403,
            getRequestId(req)
          ));
          return;
        }
      }

      // Add to edit history
      const editHistory = action.editHistory || [];
      editHistory.push({
        content: action.content,
        editedAt: new Date(),
        editedBy: character.characterName
      });

      // Update action
      action.content = content.trim();
      action.editHistory = editHistory;
      await action.save();

      // Lookup character avatar from DB
      const actionCharacter = await Character.findById(action.characterId).select('avatar').lean();
      const characterAvatar = actionCharacter?.avatar;

      // Emit WebSocket notification
      const io = req.app.get('io');
      if (io) {
        const roomName = `location_${action.locationId}`;
        io.to(roomName).emit('location_message_notification', {
          locationId: action.locationId,
          actionId: action._id,
          characterName: character.characterName,
          actionType: action.actionType,
          timestamp: action.timestamp,
          edited: true
        });
      }

      logger.info(`Location action updated: ${actionId} by ${character.characterName}`);

      res.json(successResponse(
        {
          message: {
            _id: action._id.toString(),
            actionType: action.actionType,
            characterId: action.characterId,
            characterName: action.characterName,
            characterAvatar: characterAvatar || undefined,  // Looked up from DB
            position: action.position || undefined,
            locationId: action.locationId.toString(),
            content: action.content,
            diceResult: action.diceResult || undefined,
            socialConflict: action.socialConflict || undefined,
            itemEffect: action.itemEffect || undefined,
            targetCharacters: action.targetCharacters || undefined,
            editHistory: action.editHistory,
            timestamp: action.timestamp.toISOString()
          }
        },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Update location action error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      res.status(500).json(errorResponse(
        'Failed to update location action',
        'UPDATE_ACTION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Delete a location action
   * DELETE /game/locations/actions/:actionId
   */
  static async deleteMessage(req: Request<{ actionId: string }>, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse(
          'Character context required',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const { actionId } = req.params;

      // Find the action
      const action = await Chat.findById(actionId);
      if (!action) {
        res.status(404).json(errorResponse(
          'Action not found',
          'ACTION_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check permissions: only the creator can delete, or master
      const isOwner = action.characterId === character.characterId;
      const isMaster = character.gameplayRoles?.includes('master') || character.isGestore;

      if (!isOwner && !isMaster) {
        res.status(403).json(errorResponse(
          'You can only delete your own actions',
          'INSUFFICIENT_PERMISSIONS',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Check time limit: 30 seconds for non-masters (TEST - production: 5 minutes)
      if (!isMaster) {
        const timeWindowMs = 30 * 1000; // 30 seconds (TEST) - Production: 5 * 60 * 1000
        const timeWindowAgo = new Date(Date.now() - timeWindowMs);
        if (action.timestamp < timeWindowAgo) {
          res.status(403).json(errorResponse(
            'You can only delete actions within 30 seconds of posting',
            'DELETE_TIME_EXPIRED',
            undefined,
            403,
            getRequestId(req)
          ));
          return;
        }
      }

      const locationId = action.locationId;

      // Delete the action
      await Chat.findByIdAndDelete(actionId);

      // Emit WebSocket notification
      const io = req.app.get('io');
      if (io) {
        const roomName = `location_${locationId}`;
        io.to(roomName).emit('location_action_deleted', {
          locationId,
          actionId
        });
      }

      logger.info(`Location action deleted: ${actionId} by ${character.characterName}`);

      res.json(successResponse(
        { deleted: true },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Delete location action error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      res.status(500).json(errorResponse(
        'Failed to delete location action',
        'DELETE_ACTION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Create a social conflict action
   * POST /game/locations/actions/social-conflict
   */
  static async createSocialConflict(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse(
          'Character context required',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const {
        locationId,
        attackerSkill,
        defenderCharacterId,
        content,
        isHidden,
        lieText
      } = req.body;

      // Validate required fields
      if (!locationId || !attackerSkill || !defenderCharacterId || !content) {
        res.status(400).json(errorResponse(
          'locationId, attackerSkill, defenderCharacterId, and content are required',
          'MISSING_REQUIRED_FIELDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Determine defender skill automatically from attacker skill
      const defenderSkill = getDefensiveSkill(attackerSkill);
      if (!defenderSkill) {
        res.status(400).json(errorResponse(
          `Invalid attacker skill: ${attackerSkill} is not a valid social skill`,
          'INVALID_ATTACKER_SKILL',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // SECURITY FIX: Fetch attacker character from database to read skills
      // (req.character is just JWT token, doesn't contain skills data)
      const attackerCharacter = await Character.findById(character.characterId);
      if (!attackerCharacter) {
        res.status(404).json(errorResponse(
          'Attacker character not found',
          'ATTACKER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Get attacker skill value (handle both number and SkillBreakdown)
      const attackerSkillData = attackerCharacter.skills?.[attackerSkill];
      let attackerValue = 0;

      if (attackerSkillData !== undefined) {
        if (typeof attackerSkillData === 'number') {
          attackerValue = attackerSkillData;
        } else if (attackerSkillData && typeof attackerSkillData === 'object' && 'total' in attackerSkillData) {
          attackerValue = (attackerSkillData as any).total;
        }
      }

      // If attacker doesn't have the skill, return error
      if (attackerValue === 0) {
        res.status(400).json(errorResponse(
          `You don't have the skill ${attackerSkill} or it's at 0`,
          'ATTACKER_MISSING_SKILL',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Retrieve defender character and their skill value
      const defenderCharacter = await Character.findById(defenderCharacterId);
      if (!defenderCharacter) {
        res.status(404).json(errorResponse(
          'Defender character not found',
          'DEFENDER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // BUG FIX: Use bracket notation instead of .get() (skills is a plain object, not a Map)
      // Get defender skill value (handle both number and SkillBreakdown)
      const defenderSkillData = defenderCharacter.skills?.[defenderSkill];
      let defenderValue = 0;

      if (defenderSkillData !== undefined) {
        if (typeof defenderSkillData === 'number') {
          defenderValue = defenderSkillData;
        } else if (defenderSkillData && typeof defenderSkillData === 'object' && 'total' in defenderSkillData) {
          defenderValue = (defenderSkillData as any).total;
        }
      }

      // If skill doesn't exist or is 0, use default value of 1 (minimum skill level)
      if (defenderValue === 0) {
        defenderValue = 1;
        logger.warn(`Defender skill ${defenderSkill} not found or is 0 for character ${defenderCharacterId}, using default value of 1`);
      }

      // Roll dice for both characters
      const attackerRoll = ChatController.rollDice('1d100').result;
      const defenderRoll = ChatController.rollDice('1d100').result;

      // Calculate conflict result
      const conflictResult = calculateSocialConflict(
        attackerSkill,
        attackerValue,
        attackerRoll,
        defenderSkill,
        defenderValue,
        defenderRoll,
        isHidden || attackerSkill === 'Raggirare',
        lieText,
        character.characterName
      );

      // Create action for attacker
      const isRaggirare = attackerSkill === 'Raggirare';
      const isHiddenRoll = isHidden || isRaggirare;
      
      const actionData: any = {
        actionType: 'standard',
        characterId: character.characterId,
        characterName: character.characterName,
        content: content.trim(),
        locationId,
        timestamp: new Date(),
        visibility: 'public',
        characterRoles: character.gameplayRoles || [],
        isHidden: isHiddenRoll
      };

      // For Raggirare: only include socialConflict if defender detected something
      // For other social conflicts: always include socialConflict
      if (isRaggirare) {
        // Only include socialConflict if defender wins (detected something)
        if (!conflictResult.attackerWins && conflictResult.messageForDefender) {
          actionData.socialConflict = {
            type: attackerSkill,
            attackerSkill,
            defenderSkill,
            attackerRoll,
            defenderRoll,
            result: conflictResult.result,
            attackerSuccessDegree: conflictResult.attackerSuccessDegree,
            defenderSuccessDegree: conflictResult.defenderSuccessDegree,
            messageForDefender: conflictResult.messageForDefender,
            visibleToDefenderOnly: true // Only visible to defender
          };
          actionData.targetCharacters = [defenderCharacterId]; // Only defender sees this
        }
        // If attacker wins, no socialConflict data is included (attacker sees nothing)
      } else {
        // Normal social conflicts: always include socialConflict
        actionData.socialConflict = {
          type: attackerSkill,
          attackerSkill,
          defenderSkill,
          attackerRoll,
          defenderRoll,
          result: conflictResult.result,
          attackerSuccessDegree: conflictResult.attackerSuccessDegree,
          defenderSuccessDegree: conflictResult.defenderSuccessDegree
        };
      }

      const savedAction = await (Chat as any).createAction(actionData);

      // Emit WebSocket notification
      const io = req.app.get('io');
      if (io) {
        const roomName = `location_${locationId}`;
        io.to(roomName).emit('location_message_notification', {
          locationId,
          actionId: savedAction._id,
          characterName: character.characterName,
          actionType: 'standard',
          timestamp: savedAction.timestamp
        });
      }

      logger.info(`Social conflict created: ${attackerSkill} vs ${defenderSkill} by ${character.characterName}`);

      // Prepare response: attacker should never see socialConflict for Raggirare
      const responseData: any = {
        action: {
          id: savedAction._id
        }
      };
      
      // Only include socialConflict if it's not hidden (not Raggirare)
      if (!isRaggirare) {
        responseData.action.socialConflict = conflictResult;
        responseData.action.messageForAttacker = conflictResult.messageForAttacker;
      }
      // For Raggirare, attacker gets no information about the result

      res.json(successResponse(
        responseData,
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Create social conflict error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      res.status(500).json(errorResponse(
        'Failed to create social conflict',
        'CREATE_SOCIAL_CONFLICT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Clear all actions from a location (master only)
   * DELETE /game/locations/:locationId/actions
   */
  static async clearChat(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse(
          'Character context required',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const { locationId } = req.params;

      // Check permissions: only master can clear chat
      const isMaster = character.gameplayRoles?.includes('master') || 
                       character.gameplayRoles?.includes('moderatore') || 
                       character.isGestore;
      
      if (!isMaster) {
        res.status(403).json(errorResponse(
          'Only masters can clear chat',
          'INSUFFICIENT_PERMISSIONS',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Delete all actions for this location
      const result = await Chat.deleteMany({ locationId });

      // Emit WebSocket notification
      const io = req.app.get('io');
      if (io) {
        const roomName = `location_${locationId}`;
        io.to(roomName).emit('location_chat_cleared', {
          locationId,
          clearedBy: character.characterName
        });
      }

      logger.info(`Location chat cleared: ${locationId} by ${character.characterName}, deleted ${result.deletedCount} actions`);

      res.json(successResponse(
        { deletedCount: result.deletedCount },
        undefined,
        getRequestId(req)
      ));

    } catch (error: any) {
      const err = error as Error;
      logger.error('Clear chat error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      res.status(500).json(errorResponse(
        'Failed to clear chat',
        'CLEAR_CHAT_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Create bot action (called by local-ai via AI gateway)
   * POST /game/locations/actions/bot
   * Requires AI_GATEWAY_WEBHOOK_SECRET authentication
   */
  static async createBotMessage(req: Request, res: Response): Promise<void> {
    try {
      const {
        characterId,
        characterName,
        locationId,
        content,
        actionType = 'standard',
        tags = '' // Single tag string
      } = req.body;

      // Validate required fields
      if (!characterId || !characterName || !locationId || !content) {
        res.status(400).json(errorResponse(
          'characterId, characterName, locationId, and content are required',
          'MISSING_REQUIRED_FIELDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate bot character exists and has bot_id
      const botCharacter = await Character.findById(characterId);
      if (!botCharacter) {
        res.status(404).json(errorResponse(
          'Bot character not found',
          'BOT_CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Verify this is actually a bot character
      if (!botCharacter.bot_id) {
        res.status(403).json(errorResponse(
          'Character is not a bot',
          'NOT_A_BOT_CHARACTER',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Create action like normal but from bot
      const actionData = {
        actionType,
        characterId,
        characterName,
        content: content.trim(),
        locationId,
        timestamp: new Date(),
        visibility: 'public',
        characterRoles: botCharacter.gameplayRoles || ['personaggio'],
        tags: tags || '', // Single tag string, not array
        isHidden: false,
        isBot: true // Flag to identify bot actions
      };

      const action = await Chat.create(actionData);

      // Note: Embedding event automatically published by Chat.post('save') middleware

      // Emit WebSocket notification (same format as player actions)
      const io = req.app.get('io');
      if (io) {
        const roomName = `location_${locationId}`;
        const notification = {
          locationId,
          actionId: action._id,
          characterName: characterName,
          actionType,
          timestamp: action.timestamp
        };

        console.log('🔔 createBotAction: Emitting notification to room:', roomName, notification);
        io.to(roomName).emit('location_message_notification', notification);

        // Debug: Check how many clients are in the room
        const room = io.sockets.adapter.rooms.get(roomName);
        console.log('👥 createBotAction: Clients in room', roomName, ':', room ? room.size : 0);
      }

      logger.info(`Bot action created: ${action._id} by bot ${characterName} in location ${locationId}`);

      res.status(201).json(createResponse(
        { actionId: action._id.toString() },
        'Bot action created successfully',
        getRequestId(req)
      ));

    } catch (error: any) {
      logger.error('Create bot action error:', error);
      res.status(500).json(errorResponse(
        'Failed to create bot action',
        'BOT_ACTION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Create Confrontation Attack (TiroContrapposto Phase 1)
   * POST /game/chats/confrontation-attack
   *
   * Initiates an opposed roll (combat or social conflict).
   * If the skill has multiple defense options, creates a reaction request message.
   * Otherwise, resolves immediately with single defense skill.
   */
  static async createConfrontationAttack(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse(
          'Character context required',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const {
        locationId,
        attackSkill,
        defenderId,
        content
      } = req.body;

      // Validate required fields
      if (!locationId || !attackSkill || !defenderId || !content) {
        res.status(400).json(errorResponse(
          'locationId, attackSkill, defenderId, and content are required',
          'MISSING_REQUIRED_FIELDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Load SkillConfrontation config
      const config = await SkillConfrontation.findOne({ skillName: attackSkill });
      if (!config) {
        res.status(400).json(errorResponse(
          `Invalid attack skill: ${attackSkill} is not configured for confrontations`,
          'INVALID_ATTACK_SKILL',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate attacker has the skill
      const attackerCharacter = await Character.findById(character.characterId);
      if (!attackerCharacter) {
        res.status(404).json(errorResponse(
          'Attacker character not found',
          'ATTACKER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      const attackerSkillData = attackerCharacter.skills?.[attackSkill];
      let attackerValue = 0;
      if (attackerSkillData !== undefined) {
        if (typeof attackerSkillData === 'number') {
          attackerValue = attackerSkillData;
        } else if (attackerSkillData && typeof attackerSkillData === 'object' && 'total' in attackerSkillData) {
          attackerValue = (attackerSkillData as any).total;
        }
      }

      if (attackerValue === 0) {
        res.status(400).json(errorResponse(
          `You don't have the skill ${attackSkill} or it's at 0`,
          'ATTACKER_MISSING_SKILL',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Validate defender exists
      const defenderCharacter = await Character.findById(defenderId);
      if (!defenderCharacter) {
        res.status(404).json(errorResponse(
          'Defender character not found',
          'DEFENDER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Check if multi-defense (requires reaction request)
      if (config.counterSkills.length > 1) {
        // Create CombatEncounter to track state
        const encounter = await CombatEncounter.create({
          locationId,
          status: 'waiting_reaction',
          participants: [
            { characterId: character.characterId, characterName: character.characterName },
            { characterId: defenderId, characterName: defenderCharacter.name }
          ],
          currentTurn: {
            turnNumber: 1,
            attackerId: character.characterId,
            defenderId,
            attackSkill,
            status: 'waiting_defense'
          },
          turnHistory: []
        });

        // Create reaction request message (whisper visibility, visible only to attacker and defender)
        const message = await Chat.create({
          actionType: 'confrontation_reaction_request',
          characterId: character.characterId,
          characterName: character.characterName,
          content: content.trim(),
          locationId,
          visibility: 'whisper',
          targetCharacters: [character.characterId, defenderId],
          characterRoles: character.gameplayRoles || [],
          timestamp: new Date(),
          confrontation: {
            type: config.category === 'combat_unarmed' || config.category === 'combat_melee' || config.category === 'combat_ranged' ? 'combat' : 'social',
            encounterId: encounter._id.toString(),
            phase: 'waiting_reaction',
            attackerCharacterId: character.characterId,
            defenderCharacterId: defenderId,
            availableDefenseSkills: config.counterSkills.map(cs => ({
              skillName: cs.skillName,
              label: cs.label,
              specialRule: cs.specialRule
            })),
            attackSkill
          }
        });

        // Emit WebSocket notification
        const io = req.app.get('io');
        if (io) {
          const roomName = `location_${locationId}`;
          io.to(roomName).emit('location_message_notification', {
            locationId,
            actionId: message._id,
            characterName: character.characterName,
            actionType: 'confrontation_reaction_request',
            timestamp: message.timestamp
          });
        }

        logger.info(`Confrontation reaction request created: ${message._id} (${attackSkill} attack by ${character.characterName})`);

        res.status(201).json(createResponse(
          { action: message, requiresReaction: true },
          'Confrontation attack initiated, waiting for defender reaction',
          getRequestId(req)
        ));
        return;
      }

      // Single defense skill - resolve immediately (fallback for Phase 2+)
      res.status(501).json(errorResponse(
        'Single-defense skills not yet implemented (Phase 2)',
        'NOT_IMPLEMENTED',
        undefined,
        501,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Create confrontation attack error:', error);
      res.status(500).json(errorResponse(
        'Failed to create confrontation attack',
        'CONFRONTATION_ATTACK_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Handle Confrontation Reaction (TiroContrapposto Phase 1)
   * POST /game/chats/confrontation-reaction
   *
   * Defender chooses defense skill and resolves the opposed roll.
   * Updates the reaction request message in-place with final results.
   */
  static async handleConfrontationReaction(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse(
          'Character context required',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const { messageId, defenseSkillName } = req.body;

      // Validate required fields
      if (!messageId || !defenseSkillName) {
        res.status(400).json(errorResponse(
          'messageId and defenseSkillName are required',
          'MISSING_REQUIRED_FIELDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Find reaction request message
      const message: any = await Chat.findById(messageId);
      if (!message || message.actionType !== 'confrontation_reaction_request') {
        res.status(404).json(errorResponse(
          'Reaction request not found or already processed',
          'REACTION_REQUEST_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Validate defender authorization
      if (message.confrontation.defenderCharacterId !== character.characterId) {
        res.status(403).json(errorResponse(
          'You are not the defender of this confrontation',
          'UNAUTHORIZED_DEFENDER',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      // Validate defense skill is in available options
      const availableSkills = message.confrontation.availableDefenseSkills.map((s: any) => s.skillName);
      if (!availableSkills.includes(defenseSkillName)) {
        res.status(400).json(errorResponse(
          `Invalid defense skill: ${defenseSkillName} is not available for this confrontation`,
          'INVALID_DEFENSE_SKILL',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Get skill values
      const attackerCharacter = await Character.findById(message.confrontation.attackerCharacterId);
      const defenderCharacter = await Character.findById(character.characterId);

      if (!attackerCharacter || !defenderCharacter) {
        res.status(404).json(errorResponse(
          'Character not found',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Get attacker skill value
      const attackSkill = message.confrontation.attackSkill;
      const attackerSkillData = attackerCharacter.skills?.[attackSkill];
      let attackerValue = 0;
      if (attackerSkillData !== undefined) {
        if (typeof attackerSkillData === 'number') {
          attackerValue = attackerSkillData;
        } else if (attackerSkillData && typeof attackerSkillData === 'object' && 'total' in attackerSkillData) {
          attackerValue = (attackerSkillData as any).total;
        }
      }

      // Get defender skill value
      const defenderSkillData = defenderCharacter.skills?.[defenseSkillName];
      let defenderValue = 0;
      if (defenderSkillData !== undefined) {
        if (typeof defenderSkillData === 'number') {
          defenderValue = defenderSkillData;
        } else if (defenderSkillData && typeof defenderSkillData === 'object' && 'total' in defenderSkillData) {
          defenderValue = (defenderSkillData as any).total;
        }
      }

      // Default to 1 if skill not found
      if (defenderValue === 0) {
        defenderValue = 1;
        logger.warn(`Defender skill ${defenseSkillName} not found for character ${character.characterId}, using default value 1`);
      }

      // Roll dice
      const attackRoll = ChatController.rollDice('1d100').result;
      const defenseRoll = ChatController.rollDice('1d100').result;

      // Calculate success degrees
      const attackDegree = calculateSuccessDegree(attackRoll, attackerValue).degree;
      const defenseDegree = calculateSuccessDegree(defenseRoll, defenderValue).degree;

      // Compare degrees to determine outcome
      const comparison = compareSuccessDegrees(attackDegree, defenseDegree, attackRoll, defenseRoll);
      const outcome = comparison > 0 ? 'hit' : 'miss';

      // Calculate damage if hit (TiroContrapposto Phase 2)
      let damageDealt = 0;
      let isCriticalDamage = false;
      let damageFormula = '';

      if (outcome === 'hit' && message.confrontation.type === 'combat') {
        // Import damage calculator
        const { calculateDamage, applyDamage } = await import('../utils/damageCalculator');

        // Determine damage formula (weapon or unarmed)
        damageFormula = '1d3'; // Default: unarmed combat (1d3 base damage)

        // TODO: Check if attacker has equipped weapon with weaponStats
        // For now, use unarmed damage for Corpo a Corpo

        // Calculate damage
        const damageResult = calculateDamage(
          damageFormula,
          attackerCharacter.derived?.damageBonus || '0',
          attackDegree
        );

        damageDealt = damageResult.total;
        isCriticalDamage = damageResult.isCritical;

        // Apply damage to defender
        const defenderHP = defenderCharacter.combat?.currentHP ?? defenderCharacter.derived?.hitPoints ?? 10;
        const defenderMaxHP = defenderCharacter.combat?.maxHP ?? defenderCharacter.derived?.hitPoints ?? 10;

        const damageResult2 = applyDamage(defenderHP, defenderMaxHP, damageDealt);

        // Update defender's combat state
        await Character.updateOne(
          { _id: defenderCharacter._id },
          {
            $set: {
              'combat.currentHP': damageResult2.newHP,
              'combat.maxHP': defenderMaxHP,
              'combat.isDead': damageResult2.isDead,
              'combat.isIncapacitated': damageResult2.isIncapacitated
            },
            $push: {
              'combat.wounds': {
                damage: damageDealt,
                source: `${attackerCharacter.name} (${attackSkill})`,
                timestamp: new Date()
              }
            }
          }
        );

        logger.info(`Damage applied: ${damageDealt} HP to ${defenderCharacter.name} (${damageResult2.newHP}/${defenderMaxHP} HP remaining)`);
      }

      // Update message IN-PLACE (atomic update with condition)
      const updateFields: any = {
        actionType: message.confrontation.type === 'combat' ? 'combat_action' : 'social_confrontation',
        visibility: 'public',
        'confrontation.phase': 'result',
        'confrontation.defenseSkill': defenseSkillName,
        'confrontation.attackRoll': attackRoll,
        'confrontation.defenseRoll': defenseRoll,
        'confrontation.attackSuccessLevel': attackDegree,
        'confrontation.defenseSuccessLevel': defenseDegree,
        'confrontation.outcome': outcome
      };

      // Add damage fields if combat
      if (damageDealt > 0) {
        updateFields['confrontation.damageDealt'] = damageDealt;
        updateFields['confrontation.isCriticalDamage'] = isCriticalDamage;
        updateFields['confrontation.damageFormula'] = damageFormula;
      }

      const updated: any = await Chat.findOneAndUpdate(
        {
          _id: messageId,
          actionType: 'confrontation_reaction_request' // Prevent double-processing
        },
        {
          $set: updateFields,
          $unset: {
            targetCharacters: '',
            'confrontation.availableDefenseSkills': ''
          }
        },
        { new: true }
      );

      if (!updated) {
        res.status(410).json(errorResponse(
          'Reaction request already processed',
          'ALREADY_PROCESSED',
          undefined,
          410,
          getRequestId(req)
        ));
        return;
      }

      // Update encounter status
      await CombatEncounter.updateOne(
        { _id: message.confrontation.encounterId },
        {
          $set: {
            status: 'completed',
            'currentTurn.status': 'resolved',
            'currentTurn.defenseSkill': defenseSkillName
          }
        }
      );

      // Emit WebSocket notification (SAME actionId, message was updated)
      const io = req.app.get('io');
      if (io) {
        const roomName = `location_${message.locationId}`;
        io.to(roomName).emit('location_message_notification', {
          locationId: message.locationId,
          actionId: messageId,
          characterName: character.characterName,
          actionType: updated.actionType,
          timestamp: updated.timestamp
        });
      }

      logger.info(`Confrontation resolved: ${messageId} (${outcome}: ${attackDegree} vs ${defenseDegree})`);

      res.json(createResponse(
        { action: updated, outcome },
        'Confrontation resolved successfully',
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Handle confrontation reaction error:', error);
      res.status(500).json(errorResponse(
        'Failed to handle confrontation reaction',
        'CONFRONTATION_REACTION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}