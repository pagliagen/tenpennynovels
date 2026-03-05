import { Request, Response } from 'express';
import { LocationAction, GamingSession, Location, Character } from '@database/models';
import { logger } from '../utils/logger';
import { redis } from '@config/runtime/redis';
import { EmbeddingEventPublisher } from '../utils/events/embedding-publisher';
import { successResponse, errorResponse, createResponse, getRequestId } from '../utils/apiResponse';
import { calculateSuccessDegree, SuccessDegree } from '../utils/successDegrees';
import { calculateSocialConflict, isValidSocialSkillPair, getDefensiveSkill } from '../utils/socialConflicts';
import { getSocketIO } from '../websocket/socketInstance';

export class LocationChatsController {
  
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

      // Defense in depth: Verify character is APPROVED (middleware already checks, but explicit validation for security)
      const { Character } = await import('@database/models');
      const fullCharacter = await Character.findById(character.characterId);
      if (!fullCharacter || fullCharacter.status !== 'APPROVED') {
        logger.warn('SECURITY: DRAFT character attempted location chat action', {
          characterId: character.characterId,
          status: fullCharacter?.status,
          userId: req.user?.userId
        });
        res.status(403).json(errorResponse(
          'Solo i personaggi approvati possono partecipare alle chat di location',
          'CHARACTER_NOT_APPROVED',
          undefined,
          403,
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
        skillName,
        statName,
        targetValue,
        itemId,
        tag,
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
      const isValidAction = LocationChatsController.validateActionPermission(
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
        visibility: visibility || LocationChatsController.getActionVisibility(actionType),
        characterRoles: character.gameplayRoles || [],
        tags: tag || '', // Single tag string (required field, empty string if not provided)
        isHidden: shouldHide
      };

      // Handle special action types
      if (actionType === 'whisper' && targetCharacters) {
        actionData.targetCharacters = targetCharacters;
      }

      // Handle dice rolling actions (sempre 1d100)
      if (actionType === 'dice_roll') {
        actionData.diceResult = LocationChatsController.rollDice();
      }

      // Handle skill checks
      if (actionType === 'skill_check' && skillName && targetValue !== undefined) {
        const rollResult = LocationChatsController.rollDice('1d100');
        const successDegree = calculateSuccessDegree(rollResult.result, targetValue);
        actionData.diceResult = {
          ...rollResult,
          skillName,
          target: targetValue,
          success: rollResult.result <= targetValue
        };
        actionData.successDegree = successDegree.degree;
      }

      // Handle stat checks
      if (actionType === 'stat_check' && statName && targetValue !== undefined) {
        const rollResult = LocationChatsController.rollDice('1d100');
        const successDegree = calculateSuccessDegree(rollResult.result, targetValue);
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
      const savedAction = await ((LocationAction as any).createAction(actionData));

      // Update occupant tag if a tag was provided
      if (tag) {
        try {
          const location = await Location.findById(locationId);
          if (location) {
            await location.updateOccupantTag(character.characterId, tag);
            logger.info(`Updated occupant tag for ${character.characterName} in ${locationId}: ${tag}`);
          }
        } catch (error) {
          // Don't fail the request if tag update fails
          logger.error('Failed to update occupant tag:', error);
        }
      }

      // Publish Redis event for async embedding generation
      try {
        const redisPublisher = redis.getPublisher();
        const embeddingPublisher = new EmbeddingEventPublisher(redisPublisher);
        await embeddingPublisher.publishLocationActionEvent(
          savedAction._id.toString(),
          character.characterId,
          character.characterName,
          locationId,
          content,
          actionType
        );
        logger.info(`Published embedding event for location action: ${character.characterName} @ ${locationId}`);
      } catch (error) {
        // Don't fail the request if event publishing fails
        logger.error('Failed to publish location action embedding event:', error);
      }

      // Emit WebSocket notification with full message (frontend expects complete ChatMessage)
      const io = getSocketIO();
      console.log('🔌 LocationActionsController: io instance:', io ? 'FOUND' : 'NOT FOUND');

      if (io) {
        const roomName = `location_${locationId}`;

        // Map LocationAction (DB) to ChatMessage (frontend format)
        const chatMessage = {
          _id: savedAction._id.toString(),
          messageType: savedAction.actionType,
          characterId: savedAction.characterId,
          characterName: savedAction.characterName,
          characterTag: savedAction.tags || undefined,
          locationId: savedAction.locationId.toString(),
          text: savedAction.content,
          diceRoll: savedAction.diceResult || undefined,
          skillCheck: savedAction.socialConflict || undefined,
          statCheck: savedAction.statCheck || undefined,
          itemUse: savedAction.itemUse || undefined,
          whisperVisibility: savedAction.targetCharacters ? {
            senderId: savedAction.characterId,
            targetId: savedAction.targetCharacters[0],
            canSee: [savedAction.characterId, savedAction.targetCharacters[0]]
          } : undefined,
          isEdited: false,
          createdAt: savedAction.timestamp.toISOString(),
          updatedAt: savedAction.timestamp.toISOString()
        };

        const notification = {
          message: chatMessage,  // ✅ Full message as frontend expects
          locationId
        };

        console.log('🔔 LocationActionsController: Emitting notification to room:', roomName, 'with message:', chatMessage._id);
        io.to(roomName).emit('location_message_notification', notification);

        // Debug: Check how many clients are in the room
        const room = io.sockets.adapter.rooms.get(roomName);
        console.log('👥 LocationActionsController: Clients in room', roomName, ':', room ? room.size : 0);
      } else {
        console.error('❌ LocationActionsController: Socket.io instance not found in req.app');
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
                logger.info(`[TurnManager] Next turn is BOT, will notify botai-backend with isBotTurn flag`);
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

      // Check if location has bot configured and notify botai-backend
      try {
        const { botaiWebhookClient } = await import('../services/BotAIWebhookClient');

        if (location?.bot_enabled) {
          // Bot enabled - botai-backend will decide which bot responds
          // Check if bot is disabled for current session
          if (sessionId) {
            const session = await GamingSession.findById(sessionId);

            if (!session?.botDisabledForSession) {
              // Try to notify botai-backend with sessionId and isBotTurn flag
              const success = await botaiWebhookClient.notifyLocationAction(
                savedAction,
                sessionId, // Use sessionId from session management above
                isBotTurnNext // Pass flag indicating if next turn is bot
              );

              // If notification fails, disable bot for this session
              if (!success && session) {
                session.botDisabledForSession = true;
                await session.save();
                logger.info(`[BotAI] Bot disabled for session ${session._id} due to connection failure`);
              }
            }
          } else {
            // No active session - notify anyway for bot testing/free-form mode
            logger.info(`[BotAI] No active session, notifying botai-backend anyway (free-form mode)`);
            await botaiWebhookClient.notifyLocationAction(
              savedAction,
              undefined, // No sessionId
              false // Not a bot turn (free-form)
            );
          }
        }
      } catch (botError) {
        // Don't fail the request if bot notification fails
        logger.error('Failed to notify bot service:', botError);
      }

      // Prepare response action data
      const responseAction: any = {
        id: savedAction._id,
        actionType: savedAction.actionType,
        characterName: savedAction.characterName,
        content: savedAction.content,
        timestamp: savedAction.timestamp,
        visibility: savedAction.visibility,
        diceResult: savedAction.diceResult,
        itemEffect: savedAction.itemEffect
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
      const actions = await LocationAction.find({
        locationId,
        timestamp: { $gte: timeThreshold },
        $or: [
          { visibility: 'public' },
          { 
            visibility: 'whisper', 
            $or: [
              { characterId: character.characterId },
              { targetCharacters: character.characterId }
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
        if (action.visibleToDefenderOnly) {
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
        // Map LocationAction (DB) → ChatMessage (frontend format)
        const chatMessage: any = {
          _id: action._id.toString(),
          messageType: action.actionType,  // ✅ Frontend expects messageType
          characterId: action.characterId,
          characterName: action.characterName,
          characterTag: action.tags || undefined,  // ✅ Frontend expects characterTag (singular)
          locationId: action.locationId.toString(),
          text: action.content,  // ✅ Frontend expects text
          diceRoll: action.diceResult || undefined,

          // FIX: Map socialConflict → skillCheck for frontend compatibility
          skillCheck: action.socialConflict ? {
            attackSkill: action.socialConflict.attackSkill,
            defenseSkill: action.socialConflict.defenseSkill,
            attackRoll: action.socialConflict.attackRoll,
            defenseRoll: action.socialConflict.defenseRoll,
            attackDegree: action.socialConflict.attackerSuccessDegree,
            defenseDegree: action.socialConflict.defenderSuccessDegree,
            isSuccess: action.socialConflict.result === 'victory',
            margin: action.socialConflict.margin || 0
          } : undefined,

          statCheck: action.statCheck || undefined,
          itemUse: action.itemEffect || undefined,
          whisperVisibility: action.targetCharacters && action.targetCharacters.length > 0 ? {
            senderId: action.characterId,
            targetId: action.targetCharacters[0],
            canSee: [action.characterId, ...action.targetCharacters]
          } : undefined,

          // Add hidden content and visibleToDefenderOnly flags
          hiddenContent: action.hiddenContent || undefined,
          visibleToDefenderOnly: action.visibleToDefenderOnly || false,

          isEdited: false,
          createdAt: action.timestamp.toISOString(),
          updatedAt: action.timestamp.toISOString()
        };

        // Filter socialConflict data based on visibility rules
        if (chatMessage.skillCheck) {
          const socialConflict = chatMessage.skillCheck;

          // If socialConflict is visible only to defender
          if (socialConflict.visibleToDefenderOnly) {
            const isAttacker = action.characterId === character.characterId;
            const isDefender = action.targetCharacters?.includes(character.characterId);

            // Attacker should NEVER see socialConflict data for Raggirare
            if (isAttacker) {
              delete chatMessage.skillCheck;
            }
            // Defender can see it only if they detected something (result !== 'victory')
            else if (!isDefender || socialConflict.result === 'victory') {
              delete chatMessage.skillCheck;
            }
            // Other users should never see it
            else if (!isDefender) {
              delete chatMessage.skillCheck;
            }
          }
          // For non-hidden social conflicts, everyone can see them
        }

        return chatMessage;
      });

      logger.info(`Retrieved ${filteredActions.length} location messages for ${character.characterName} in ${locationId}`);

      res.json(successResponse(
        {
          messages: filteredActions,  // ✅ Frontend expects "messages" not "actions"
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
      const action = await LocationAction.findById(actionId);
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

      // Check time limit: 5 minutes for non-masters
      if (!isMaster) {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (action.timestamp < fiveMinutesAgo) {
          res.status(403).json(errorResponse(
            'You can only edit actions within 5 minutes of posting',
            'EDIT_TIME_EXPIRED',
            undefined,
            403,
            getRequestId(req)
          ));
          return;
        }

        // Check if there's a subsequent action from the same character
        const subsequentAction = await LocationAction.findOne({
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
          action: {
            id: action._id,
            content: action.content,
            editHistory: action.editHistory
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
      const action = await LocationAction.findById(actionId);
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

      // Check permissions: only master can delete
      const isMaster = character.gameplayRoles?.includes('master') || 
                       character.gameplayRoles?.includes('moderatore') || 
                       character.isGestore;
      
      if (!isMaster) {
        res.status(403).json(errorResponse(
          'Only masters can delete actions',
          'INSUFFICIENT_PERMISSIONS',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      const locationId = action.locationId;

      // Delete the action
      await LocationAction.findByIdAndDelete(actionId);

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
      const attackerRoll = LocationChatsController.rollDice('1d100').result;
      const defenderRoll = LocationChatsController.rollDice('1d100').result;

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

      const savedAction = await (LocationAction as any).createAction(actionData);

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
      const result = await LocationAction.deleteMany({ locationId });

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
   * Create bot action (called by botai-backend)
   * POST /game/locations/actions/bot
   * Requires BOT_API_KEY authentication
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

      const action = await LocationAction.create(actionData);

      // Publish embedding event for bot actions
      try {
        const redisPublisher = redis.getPublisher();
        const embeddingPublisher = new EmbeddingEventPublisher(redisPublisher);
        await embeddingPublisher.publishLocationActionEvent(
          action._id.toString(),
          actionData.characterId,
          actionData.characterName,
          locationId,
          content,
          actionType
        );
      } catch (embeddingError) {
        logger.warn('Failed to publish embedding event for bot action:', embeddingError);
        // Non-critical, continue
      }

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
}