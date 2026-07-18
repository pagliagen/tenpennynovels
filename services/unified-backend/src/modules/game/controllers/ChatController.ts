import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Chat, GamingSession, Location, Character, SkillConfrontation, CombatEncounter, Skill, Item } from '@database/models';
import { logger } from '../logger';
import { successResponse, errorResponse, createResponse, listResponse, getRequestId } from '@shared/utils/apiResponse';
import { ConfigurationService } from '@shared/services/ConfigurationService';
import { redis } from '@config/runtime/redis';
import { escapeRegex } from '@shared/utils/validation';
import { EmbeddingService } from '@modules/documents/services/EmbeddingService';

import { calculateSuccessDegree, getSuccessDegreeLabel, compareSuccessDegrees } from '../utils/successDegrees';
import { calculateSocialConflict, getDefensiveSkill } from '../utils/socialConflicts';
import { getSocketIO } from '../websocket/socketInstance';
import { appConfig } from '@config/runtime';

// Action Router (Refactored architecture)
import { ActionRouter } from '../actions/ActionRouter';
import { ActionContext, ActionInput } from '../actions/types';
import { DiceService } from '../services/DiceService';
import { CharacterSkillService } from '../services/CharacterSkillService';
import { WeaponService } from '../services/WeaponService';

// Message Transformer (Phase 2 refactoring)
import { ChatMessageService } from '../services/ChatMessageService';

// WebSocket Service (Centralized emissions)
import { ChatWebSocketService } from '../services/ChatWebSocketService';

export class ChatController {
  // Singleton service instance
  private static chatMessageService = new ChatMessageService();

  /**
   * Populate character avatars for messages
   * Performs batch lookup of avatars from Character collection
   * IMPORTANT: Does NOT overwrite existing avatars (preserves fake PNG avatars)
   *
   * @deprecated This method is being replaced by MessageTransformer/BaseEnricher
   */
  private static async populateCharacterAvatars(messages: any[]): Promise<any[]> {
    if (messages.length === 0) return messages;

    // Get unique character IDs that DON'T already have avatars
    const missingAvatars = messages.filter(m => !m.characterAvatar);
    if (missingAvatars.length === 0) return messages;

    const characterIds = [...new Set(missingAvatars.map(m => m.characterId))];

    // Batch lookup avatars
    const characters = await Character.find({ _id: { $in: characterIds } })
      .select('_id avatar')
      .lean();

    // Create ID -> avatar map
    const avatarMap = new Map(
      characters.map((c: any) => [c._id.toString(), c.avatar])
    );

    // ONLY add avatar if missing (don't overwrite fake avatars)
    return messages.map(message => ({
      ...message,
      characterAvatar: message.characterAvatar || avatarMap.get(message.characterId) || undefined
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
          'Contesto personaggio richiesto',
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

      // CHECK: Character has pending reaction to resolve?
      const pendingReactionId = await ChatController.checkPendingReaction(character.characterId, locationId);
      if (pendingReactionId) {
        res.status(400).json(errorResponse(
          'Devi rispondere alla reazione pendente prima di fare altre azioni',
          'PENDING_REACTION_EXISTS',
          { pendingMessageId: pendingReactionId },
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

      // ========== FAKE PNG MASKING LOGIC ==========
      // Fresh query to avoid stale middleware data
      const freshCharacter = await Character.findById(character.characterId)
        .select('_id name surname avatar activeFakePngId fakePngs')
        .lean();

      if (!freshCharacter) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Helper: build full name
      const buildFullName = (name: string, surname?: string) =>
        name + (surname ? ' ' + surname : '');

      // Check if fake PNG active + permission valid
      let isMasked = false;
      let displayName = buildFullName(freshCharacter.name, freshCharacter.surname);
      let displayAvatar = freshCharacter.avatar;
      let realCharacterName: string | undefined;

      if (freshCharacter.activeFakePngId) {
        // Verify permission (degrade gracefully if lost)
        const { hasGamePermission, GamePermissions } = await import('@config/permissions/game');
        const hasFakePngPermission = hasGamePermission(
          GamePermissions.CHAT_USE_FAKE_PNG,
          character.playerStatus || 'draft',
          character.isGestore || false,
          character.gameplayRoles || [],
          character.characterPermissions || []
        );

        if (hasFakePngPermission) {
          const activeFake = freshCharacter.fakePngs?.find(
            (f: any) => f._id.toString() === freshCharacter.activeFakePngId.toString()
          );

          if (activeFake) {
            isMasked = true;
            realCharacterName = displayName;  // Save real name for admin
            displayName = buildFullName(activeFake.name, activeFake.surname);
            displayAvatar = activeFake.avatar;
          }
        }
      }
      // ========== END FAKE PNG MASKING LOGIC ==========

      // Build the location action
      let actionData: any = {
        actionType,
        characterId: freshCharacter._id.toString(),  // REAL ID (ownership)
        characterName: displayName,                  // Fake if masked, real otherwise
        characterAvatar: displayAvatar,              // Fake if masked, real otherwise
        isMasked,
        realCharacterName,  // Only set if masked (admin-only)
        content: content.trim(),
        locationId,
        sessionId, // Copy sessionId from location to action
        timestamp: new Date(),
        visibility: visibility || ChatController.getActionVisibility(actionType),
        characterRoles: character.gameplayRoles || [],
        position: position || undefined,
        isHidden: shouldHide
      };

      // REFACTORED: Use Action Router for modular action handling
      // All 11 action types are now handled through the router
      const handledActionTypes = [
        'standard', 'ooc', 'whisper',
        'dice_roll', 'skill_check', 'stat_check',
        'item_use', 'master', 'moderation',
        'social_confrontation', 'combat_action'
      ];

      logger.debug(`[ChatController] Action type: ${actionType}, handled: ${handledActionTypes.includes(actionType)}`);

      if (handledActionTypes.includes(actionType)) {
        logger.info(`[ChatController] Routing ${actionType} through ActionRouter`);
        // Build ActionInput for router
        const actionInput: ActionInput = {
          actionType,
          content: content.trim(),
          locationId,
          characterId: freshCharacter._id.toString(),
          characterName: displayName,
          characterAvatar: displayAvatar,
          isMasked,
          realCharacterName,
          visibility,
          targetCharacters,
          diceSpec,
          skillId,
          statName,
          position: position || undefined,
          isHidden: shouldHide,
          sessionId,
          characterRoles: character.gameplayRoles || []
        };

        try {
          // Route to appropriate handler
          const router = ChatController.getActionRouter();
          actionData = await router.route(actionInput);
          logger.debug(`[ChatController] ActionData from router:`, {
            actionType: actionData.actionType,
            hasItemEffect: 'itemEffect' in actionData,
            hasConfrontation: 'confrontation' in actionData,
            hasSocialConflict: 'socialConflict' in actionData,
            keys: Object.keys(actionData)
          });
        } catch (error: any) {
          // Handle validation errors from handlers
          if (error.code && error.statusCode) {
            res.status(error.statusCode).json(errorResponse(
              error.message,
              error.code,
              undefined,
              error.statusCode,
              getRequestId(req)
            ));
            return;
          }
          throw error; // Re-throw unexpected errors
        }
      }

      // Save to database
      // Note: Empty subdocuments are automatically removed by ChatSchema pre-save middleware
      const savedAction = await Chat.createAction(actionData);

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
      logger.debug(`ChatsController: io instance: ${io ? 'FOUND' : 'NOT FOUND'}`);

      if (io) {
        const roomName = `location_${locationId}`;

        // Return DB fields directly (no mapping)
        const chatMessage = {
          _id: savedAction._id.toString(),
          actionType: savedAction.actionType,           // DB field (was messageType)
          characterId: savedAction.characterId,
          characterName: savedAction.characterName,
          characterAvatar: savedAction.characterAvatar || undefined,  // Use saved value (fake if masked)
          position: savedAction.position || undefined,
          locationId: savedAction.locationId.toString(),
          content: savedAction.content,                 // DB field (was text)
          diceResult: savedAction.diceResult || undefined,  // DB field (was diceRoll)
          // Fix: Only include socialConflict if it has properties (Mongoose creates empty {} for subdocuments)
          socialConflict: (savedAction.socialConflict && Object.keys(savedAction.socialConflict).length > 0)
            ? savedAction.socialConflict
            : undefined,
          statCheck: (savedAction as unknown as Record<string, unknown>).statCheck || undefined,
          itemEffect: savedAction.itemEffect || undefined,  // DB field (was itemUse)
          targetCharacters: savedAction.targetCharacters || undefined,  // DB field (was whisperVisibility)
          hiddenContent: savedAction.hiddenContent || undefined,
          editHistory: savedAction.editHistory || [],
          timestamp: savedAction.timestamp.toISOString()  // DB field (was createdAt/updatedAt)
        };

        const notification = {
          message: chatMessage,  // ✅ Full message as frontend expects
          locationId,
          locationName: location?.name || 'Location sconosciuta',
          locationSlug: location?.slug || null
        };

        logger.debug(`ChatsController: Emitting notification to room ${roomName} with message ${chatMessage._id}`);
        io.to(roomName).emit('location_message_notification', notification);

        // Debug: Check how many clients are in the room
        const room = io.sockets.adapter.rooms.get(roomName);
        logger.debug(`ChatsController: Clients in room ${roomName}: ${room ? room.size : 0}`);
      } else {
        logger.error('ChatsController: Socket.io instance not found in req.app');
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

      // ========== BOT ROUND GATE ==========
      // Notify bot only after ALL active players in the location have sent a standard action.
      // Supports max 5 non-bot players per bot-enabled location.
      try {
        if (location?.bot_enabled && actionType === 'standard') {
          const { aiGatewayClient } = await import('../services/AIGatewayClient');

          // Re-fetch location to get up-to-date occupants (the outer `location` may be stale)
          const freshLocation = await Location.findById(locationId).lean();
          const allOccupants: any[] = (freshLocation as any)?.occupants || [];
          const botCharacterId = (freshLocation as any)?.botCharacterId;
          const botCharacter = botCharacterId
            ? await Character.findById(botCharacterId).select('_id name bot_id').lean()
            : null;
          const botCharIdStr = botCharacter?._id?.toString();

          const activeNonBotOccupants = allOccupants.filter(
            (occ: any) => occ.isActive && occ.characterId.toString() !== botCharIdStr
          );

          // Fallback: if occupant tracking is out of sync, treat the acting character as 1 active player
          const effectiveCount = activeNonBotOccupants.length > 0 ? activeNonBotOccupants.length : 1;

          if (activeNonBotOccupants.length > 5) {
            logger.warn(`[BotRound] Location ${locationId} has ${activeNonBotOccupants.length} active players (max 5 for bot locations)`);
          }

          // Atomically register this player's action in the current round
          const updatedLoc = await Location.findOneAndUpdate(
            { _id: locationId },
            {
              $addToSet: {
                'botRound.actedCharacterIds': character.characterId,
                'botRound.roundActionIds': savedAction._id,
              },
            },
            { new: true }
          );

          if (!updatedLoc) {
            logger.warn('[BotRound] Could not update location round state');
          } else {
            // Set startedAt on first action of the round
            if (!updatedLoc.botRound?.startedAt) {
              await Location.updateOne({ _id: locationId }, { $set: { 'botRound.startedAt': new Date() } });
            }

            const actedCount = updatedLoc.botRound?.actedCharacterIds?.length ?? 0;
            const expectedCount = Math.min(effectiveCount, 5);

            logger.info(`[BotRound] ${actedCount}/${expectedCount} players acted in round ${updatedLoc.botRound?.roundNumber ?? 0} (occupants tracked: ${activeNonBotOccupants.length})`);

            if (actedCount >= expectedCount && expectedCount > 0) {
              // Atomically claim the right to notify the bot by resetting the round.
              // Only the request that successfully resets sends to the bot (prevents double-send).
              const beforeReset = await Location.findOneAndUpdate(
                { _id: locationId, 'botRound.actedCharacterIds.0': { $exists: true } },
                {
                  $set: { 'botRound.actedCharacterIds': [], 'botRound.roundActionIds': [], 'botRound.startedAt': new Date() },
                  $inc: { 'botRound.roundNumber': 1 },
                }
              );

              if (!beforeReset) {
                logger.info('[BotRound] Round already processed by concurrent request, skipping');
              } else {
                const shouldNotify = !sessionId || !(await GamingSession.findById(sessionId))?.botDisabledForSession;

                if (shouldNotify) {
                  const healthy = await aiGatewayClient.isHealthy();
                  if (healthy) {
                    const roundActionIds = beforeReset.botRound?.roundActionIds || [];

                    // Fetch round actions in chronological order, filtering private messages
                    const roundActionsRaw = await Chat.find({ _id: { $in: roundActionIds } })
                      .sort({ timestamp: 1 }).lean();

                    const roundActions = roundActionsRaw.filter((a: any) =>
                      a.visibility !== 'whisper' && a.visibility !== 'master_only' && !a.isHidden
                    );

                    // Use active non-bot occupants as presentCharacters
                    const presentCharacterIds = activeNonBotOccupants.map((occ: any) => occ.characterId);
                    const presentCharacters = await Character.find({ _id: { $in: presentCharacterIds } })
                      .select('_id name gender apparentAge physicalDescription visibleMarks height eyeColor hairColor').lean();

                    const botLocalAiId = (botCharacter as any)?.bot_id || '';
                    const lastAction = roundActions[roundActions.length - 1];

                    const callbackSecret = appConfig.services.aiGateway.webhookSecret;
                    const backendUrl = appConfig.urls.api;

                    const success = await aiGatewayClient.notifyBotAction({
                      requestId: savedAction._id.toString(),
                      bot: { id: botLocalAiId.toString(), name: botCharacter?.name || 'Bot' },
                      context: {
                        location: {
                          id: locationId,
                          name: location.name,
                          description: location.description,
                        },
                        triggeringAction: lastAction
                          ? {
                              id: lastAction._id.toString(),
                              characterId: lastAction.characterId?.toString(),
                              characterName: lastAction.characterName,
                              content: lastAction.content,
                              type: lastAction.actionType,
                            }
                          : {
                              id: savedAction._id.toString(),
                              characterId: character.characterId,
                              characterName: character.characterName,
                              content: content.trim(),
                              type: actionType,
                            },
                        recentActions: roundActions.map((a: any) => ({
                          characterId: a.characterId?.toString(),
                          characterName: a.characterName,
                          content: a.content,
                          timestamp: a.timestamp?.toISOString(),
                        })),
                        presentCharacters: presentCharacters.map((c: any) => ({
                          id: c._id.toString(),
                          name: c.name,
                          gender: c.gender,
                          apparentAge: c.apparentAge,
                          physicalDescription: c.physicalDescription,
                          visibleMarks: c.visibleMarks,
                          height: c.height,
                          eyeColor: c.eyeColor,
                          hairColor: c.hairColor,
                        })),
                      },
                      callback: callbackSecret
                        ? {
                            url: `${backendUrl}/webhooks/bot-response`,
                            method: 'POST',
                            headers: { Authorization: `Bearer ${callbackSecret}` },
                          }
                        : undefined,
                    });

                    logger.info(`[BotRound] Round ${(beforeReset.botRound?.roundNumber ?? 0)} complete — bot notified with ${roundActions.length} actions`);

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
            }
          }
        }
      } catch (botError) {
        logger.error('[BotRound] Error in bot round gate:', botError);
      }
      // ========== END BOT ROUND GATE ==========

      // Prepare response action data (DB fields - no mapping)
      const responseAction: Record<string, unknown> = {
        _id: savedAction._id.toString(),
        actionType: savedAction.actionType,
        characterId: savedAction.characterId,
        characterName: savedAction.characterName,
        characterAvatar: savedAction.characterAvatar || undefined,  // Use saved value (fake if masked)
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
        const socialConflict = savedAction.socialConflict;
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

    } catch (error: unknown) {
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
   *
   * Refactored to use ChatMessageService + MessageTransformer pattern
   */
  static async getMessages(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(
          errorResponse(
            'Contesto personaggio richiesto',
            'CHARACTER_CONTEXT_REQUIRED',
            undefined,
            401,
            getRequestId(req)
          )
        );
        return;
      }

      const { locationId } = req.params;
      const hours = parseInt(req.query.hours as string) || 3;
      const limit = Math.min(200, Math.max(10, parseInt(req.query.limit as string) || 100));
      const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

      // Calculate time threshold
      const timeThreshold = new Date();
      timeThreshold.setHours(timeThreshold.getHours() - hours);

      // Service handles ALL query, filtering, enrichment with pagination
      const result = await ChatController.chatMessageService.getMessages({
        locationId,
        characterId: character.characterId,
        timeThreshold,
        limit,
        offset,
      });

      logger.info(
        `Retrieved ${result.messages.length} enriched messages for ${character.characterName} in ${locationId} (total: ${result.totalCount}, offset: ${offset})`
      );

      res.json(
        successResponse(
          {
            messages: result.messages,
            totalCount: result.totalCount,
            hasMore: result.hasMore,
            offset,
            limit,
          },
          undefined,
          getRequestId(req)
        )
      );
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Get location actions error:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
      res.status(500).json(
        errorResponse(
          'Failed to retrieve location actions',
          'GET_ACTIONS_ERROR',
          undefined,
          500,
          getRequestId(req)
        )
      );
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
   *
   * IMPORTANT:
   * - master/moderation actions are PUBLIC (everyone can read)
   * - Only masters/moderators can SEND them (permission check elsewhere)
   */
  private static getActionVisibility(actionType: string): 'public' | 'whisper' | 'master_only' {
    switch (actionType) {
      case 'whisper':
        return 'whisper';
      case 'master':
      case 'moderation':
        return 'public';  // ← FIX: Everyone can read, only masters can send
      default:
        return 'public';
    }
  }

  /**
   * Parse dice specification string
   * Format: {count}d{type}[+/-modifier]
   * Examples: "2d6+3", "1d20", "3d8-2", "1d100"
   */
  private static parseDiceSpec(diceSpec: string): {
    count: number;
    type: number;
    modifier: number;
    isValid: boolean;
  } {
    const regex = /^(\d+)d(\d+)([+-]\d+)?$/i;
    const match = diceSpec.match(regex);

    if (!match) {
      return { count: 1, type: 100, modifier: 0, isValid: false };
    }

    const count = parseInt(match[1], 10);
    const type = parseInt(match[2], 10);
    const modifier = match[3] ? parseInt(match[3], 10) : 0;

    const validTypes = [4, 6, 8, 10, 12, 20, 100];
    const isValid =
      count >= 1 && count <= 20 &&
      validTypes.includes(type) &&
      modifier >= -99 && modifier <= 99;

    return { count, type, modifier, isValid };
  }

  /**
   * Dice rolling function with multi-dice support
   * Parses diceSpec and rolls accordingly
   * Format: {count}d{type}[+/-modifier]
   * Examples: "2d6+3", "1d20", "3d8-2", "1d100"
   */
  private static rollDice(diceSpec?: string): {
    dice: string;
    result: number;
    rolls?: number[];
    modifier?: number;
    total: number;
  } {
    const spec = diceSpec || '1d100';
    const parsed = ChatController.parseDiceSpec(spec);

    if (!parsed.isValid) {
      logger.warn(`Invalid dice spec: ${spec}, falling back to 1d100`);
      const result = Math.floor(Math.random() * 100) + 1;
      return { dice: '1d100', result, total: result };
    }

    const rolls: number[] = [];
    for (let i = 0; i < parsed.count; i++) {
      const roll = Math.floor(Math.random() * parsed.type) + 1;
      rolls.push(roll);
    }

    const rollSum = rolls.reduce((sum, r) => sum + r, 0);
    const total = rollSum + parsed.modifier;

    return {
      dice: spec,
      result: rollSum,
      rolls: parsed.count > 1 ? rolls : undefined,
      modifier: parsed.modifier !== 0 ? parsed.modifier : undefined,
      total: total,
    };
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
          'Contesto personaggio richiesto',
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

      // Build enriched message (same format as createMessage)
      const enrichedMessage = {
        _id: action._id.toString(),
        actionType: action.actionType,
        characterId: action.characterId,
        characterName: action.characterName,
        characterAvatar: action.characterAvatar || undefined,
        position: action.position || undefined,
        locationId: action.locationId.toString(),
        content: action.content,
        visibility: action.visibility,
        diceResult: action.diceResult || undefined,
        socialConflict:
          action.socialConflict && Object.keys(action.socialConflict).length > 0
            ? action.socialConflict
            : undefined,
        itemEffect: action.itemEffect || undefined,
        targetCharacters: action.targetCharacters || undefined,
        hiddenContent: action.hiddenContent || undefined,
        editHistory: action.editHistory?.map((entry: any) => ({
          content: entry.content,
          editedAt: entry.editedAt.toISOString(),
          editedBy: entry.editedBy,
        })) || [],
        timestamp: action.timestamp.toISOString(),
        edited: true, // ← Flag to indicate this is an edit
      };

      // Emit WebSocket notification with FULL enriched message
      ChatWebSocketService.emitMessageUpdated({
        locationId: action.locationId.toString(),
        message: enrichedMessage,
      });

      logger.info(`Location action updated: ${actionId} by ${character.characterName}`);

      res.json(
        successResponse(
          {
            message: enrichedMessage,
          },
          undefined,
          getRequestId(req)
        )
      );

    } catch (error: unknown) {
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
          'Contesto personaggio richiesto',
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
      ChatWebSocketService.emitMessageDeleted({
        locationId: locationId.toString(),
        actionId: actionId.toString(),
      });

      logger.info(`Location action deleted: ${actionId} by ${character.characterName}`);

      res.json(successResponse(
        { deleted: true },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
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
          'Contesto personaggio richiesto',
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

      // CHECK: Character has pending reaction to resolve?
      const pendingReactionId = await ChatController.checkPendingReaction(character.characterId, locationId);
      if (pendingReactionId) {
        res.status(400).json(errorResponse(
          'Devi rispondere alla reazione pendente prima di fare altre azioni',
          'PENDING_REACTION_EXISTS',
          { pendingMessageId: pendingReactionId },
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
          attackerValue = (attackerSkillData as { total: number }).total;
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
          defenderValue = (defenderSkillData as { total: number }).total;
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

      const savedAction = await Chat.createAction(actionData);

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
      const responseData: Record<string, unknown> = {
        action: {
          id: savedAction._id
        }
      };

      if (!isRaggirare) {
        const action = responseData.action as Record<string, unknown>;
        action.socialConflict = conflictResult;
        action.messageForAttacker = conflictResult.messageForAttacker;
      }
      // For Raggirare, attacker gets no information about the result

      res.json(successResponse(
        responseData,
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
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
          'Contesto personaggio richiesto',
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
      ChatWebSocketService.emitChatCleared({
        locationId,
        clearedBy: character.characterName,
      });

      logger.info(`Location chat cleared: ${locationId} by ${character.characterName}, deleted ${result.deletedCount} actions`);

      res.json(successResponse(
        { deletedCount: result.deletedCount },
        undefined,
        getRequestId(req)
      ));

    } catch (error: unknown) {
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

        logger.debug('createBotAction: Emitting notification to room:', roomName, notification);
        io.to(roomName).emit('location_message_notification', notification);

        // Debug: Check how many clients are in the room
        const room = io.sockets.adapter.rooms.get(roomName);
        logger.debug('createBotAction: Clients in room', roomName, ':', room ? room.size : 0);
      }

      logger.info(`Bot action created: ${action._id} by bot ${characterName} in location ${locationId}`);

      res.status(201).json(createResponse(
        { actionId: action._id.toString() },
        'Bot action created successfully',
        getRequestId(req)
      ));

    } catch (error: unknown) {
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
          'Contesto personaggio richiesto',
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
        content,
        additionalMessage, // For Raggirare lie text
        forceAbortPendingReaction // User confirmed abort of pending reaction
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

      // CHECK: Attacker has pending reaction to resolve?
      const pendingReaction = await Chat.findOne({
        locationId,
        'confrontation.defenderCharacterId': character.characterId,
        'confrontation.phase': 'waiting_reaction',
      });

      if (pendingReaction) {
        if (!forceAbortPendingReaction) {
          // User has not confirmed abort → block
          res.status(400).json(errorResponse(
            'Devi rispondere alla reazione pendente prima di fare altre azioni',
            'PENDING_REACTION_EXISTS',
            { pendingMessageId: pendingReaction._id },
            400,
            getRequestId(req)
          ));
          return;
        }

        // User confirmed abort → auto-resolve with defender fail
        await ChatController.handlePendingReactionAbort(pendingReaction._id.toString(), character.characterId, req);
        logger.info(`Pending reaction ${pendingReaction._id} aborted by ${character.characterId} to proceed with new action`);
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
          attackerValue = (attackerSkillData as { total: number }).total;
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

      // ═══ SKILL USAGE TRACKING (SOCIAL ONLY, EXCLUDE RAGGIRARE) ═══
      const configService = new ConfigurationService(redis.getClient(), logger);

      if (config.category === 'social' && attackSkill !== 'Raggirare') {
        const usageLimit = await configService.getConfig('confrontation_skill_usage_limit_per_scene') as number;

        if (usageLimit > 0) {
          // Check if skill was already used against this target in this location
          const existingUsage = await CombatEncounter.findOne({
            locationId,
            encounterType: 'social_scene',
            status: { $ne: 'completed' },
            'skillUsageTracking': {
              $elemMatch: {
                characterId: character.characterId,
                targetCharacterId: defenderId,
                skillName: attackSkill
              }
            }
          });

          if (existingUsage) {
            res.status(400).json(errorResponse(
              `Hai già usato ${attackSkill} contro ${defenderCharacter.name} in questa scena`,
              'SKILL_USAGE_LIMIT_EXCEEDED',
              { skill: attackSkill, limit: usageLimit },
              400,
              getRequestId(req)
            ));
            return;
          }
        }
      }

      // ═══ UNIFIED 2-PHASE FLOW (ALL CONFRONTATIONS) ═══

      // Build availableDefenseSkills with __NO_DEFENSE__ option
      const availableDefenseSkills = config.counterSkills.map((cs: any) => ({
        skillName: cs.skillName,
        label: cs.label,
        specialRule: cs.specialRule
      }));

      // Add "Non voglio tirare/difendermi" option (always enabled)
      const allowNoDefense = await configService.getConfig('confrontation_allow_no_defense') as boolean;
      if (allowNoDefense) {
        const noDefenseLabel = config.category === 'social'
          ? 'Non voglio tirare (Accetto automaticamente)'
          : 'Non voglio difendermi (Fallimento automatico)';

        availableDefenseSkills.push({
          skillName: '__NO_DEFENSE__',
          label: noDefenseLabel,
          specialRule: 'auto_fail'
        });
      }

      // Create CombatEncounter to track state
      const encounterType = config.category === 'social' ? 'social_scene' : 'combat';
      const encounter = await CombatEncounter.create({
        locationId,
        sessionId: character.sessionId || 'default-session', // Use character's current session
        encounterType,
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
        skillUsageTracking: encounterType === 'social_scene' ? [{
          characterId: character.characterId,
          targetCharacterId: defenderId,
          skillName: attackSkill,
          usedAt: new Date(),
          additionalContext: additionalMessage || undefined
        }] : [],
        turnHistory: []
      });

      // Create reaction request message (whisper visibility, visible only to attacker and defender)
      const messageData: any = {
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
          type: encounterType,
          encounterId: encounter._id.toString(),
          phase: 'waiting_reaction',
          attackerCharacterId: character.characterId,
          defenderCharacterId: defenderId,
          availableDefenseSkills, // Use the built array with __NO_DEFENSE__
          attackSkill,
          hiddenResultForAttacker: attackSkill === 'Raggirare' // Attacker doesn't see rolls for Raggirare
        }
      };

      // Save Raggirare lie text to hiddenContent (master-visible only)
      if (attackSkill === 'Raggirare' && additionalMessage) {
        messageData.hiddenContent = additionalMessage;
      }

      const message = await Chat.create(messageData);

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
    } catch (error: unknown) {
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
          'Contesto personaggio richiesto',
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

      // Get characters
      const attackerCharacter = await Character.findById(message.confrontation.attackerCharacterId);
      const defenderCharacter = await Character.findById(character.characterId);

      if (!attackerCharacter || !defenderCharacter) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // ═══ CHECK 1: NO-DEFENSE OPTION (AUTO-FAIL) ═══
      if (defenseSkillName === '__NO_DEFENSE__') {
        // Defender chose not to defend - auto-fail
        const attackSkill = message.confrontation.attackSkill;
        const attackerSkillData = attackerCharacter.skills?.[attackSkill];
        let attackerValue = 0;
        if (attackerSkillData !== undefined) {
          if (typeof attackerSkillData === 'number') {
            attackerValue = attackerSkillData;
          } else if (attackerSkillData && typeof attackerSkillData === 'object' && 'total' in attackerSkillData) {
            attackerValue = (attackerSkillData as { total: number }).total;
          }
        }

        const attackRoll = ChatController.rollDice('1d100').result;
        const attackDegree = calculateSuccessDegree(attackRoll, attackerValue).degree;

        // Auto-fail: defender gets fumble, attacker rolls normally
        const updateFields: any = {
          actionType: message.confrontation.type === 'combat' ? 'combat_action' : 'social_confrontation',
          visibility: 'public',
          'confrontation.phase': 'result',
          'confrontation.defenseSkill': 'Nessuna difesa',
          'confrontation.attackRoll': attackRoll,
          'confrontation.defenseRoll': 100, // Fumble
          'confrontation.attackSuccessLevel': attackDegree,
          'confrontation.defenseSuccessLevel': 'fumble',
          'confrontation.outcome': 'hit'
        };

        const updated: any = await Chat.findOneAndUpdate(
          { _id: messageId, actionType: 'confrontation_reaction_request' },
          { $set: updateFields, $unset: { targetCharacters: '', 'confrontation.availableDefenseSkills': '' } },
          { new: true }
        );

        if (updated) {
          await CombatEncounter.updateOne(
            { _id: message.confrontation.encounterId },
            { $set: { status: 'completed', 'currentTurn.status': 'resolved', 'currentTurn.defenseSkill': 'Nessuna difesa' } }
          );

          const io = req.app.get('io');
          if (io) {
            io.to(`location_${message.locationId}`).emit('location_message_notification', {
              locationId: message.locationId,
              actionId: messageId,
              characterName: character.characterName,
              actionType: updated.actionType,
              timestamp: updated.timestamp
            });
          }
        }

        logger.info(`No-defense auto-fail: ${messageId} (${character.characterName} chose not to defend)`);
        res.json(createResponse({ outcome: 'hit', autoFail: true }, 'Defender chose not to defend', getRequestId(req)));
        return;
      }

      // ═══ CHECK 2: CONSTITUTION CHECK (COMBAT ONLY, WOUNDED) ═══
      const configService = new ConfigurationService(redis.getClient(), logger);
      const isCombat = message.confrontation.type === 'combat';

      if (isCombat) {
        const currentHP = defenderCharacter.combat?.currentHP ?? defenderCharacter.derived?.hitPoints ?? 10;
        const maxHP = defenderCharacter.combat?.maxHP ?? defenderCharacter.derived?.hitPoints ?? 10;
        const threshold = await configService.getConfig('combat_wounded_constitution_check_threshold') as number;

        if ((currentHP / maxHP) <= threshold && currentHP > 0) {
          // Wounded - requires constitution check
          const constitutionValue = defenderCharacter.stats?.constitution || 10;
          const constitutionRoll = ChatController.rollDice('1d100').result;
          const constitutionCheck = calculateSuccessDegree(constitutionRoll, constitutionValue);

          if (constitutionCheck.degree === 'failure' || constitutionCheck.degree === 'fumble') {
            // Failed constitution check - cannot defend (same as no-defense)
            const attackSkill = message.confrontation.attackSkill;
            const attackerSkillData = attackerCharacter.skills?.[attackSkill];
            let attackerValue = 0;
            if (attackerSkillData !== undefined) {
              if (typeof attackerSkillData === 'number') {
                attackerValue = attackerSkillData;
              } else if (attackerSkillData && typeof attackerSkillData === 'object' && 'total' in attackerSkillData) {
                attackerValue = (attackerSkillData as { total: number }).total;
              }
            }

            const attackRoll = ChatController.rollDice('1d100').result;
            const attackDegree = calculateSuccessDegree(attackRoll, attackerValue).degree;

            const updateFields: any = {
              actionType: 'combat_action',
              visibility: 'public',
              'confrontation.phase': 'result',
              'confrontation.defenseSkill': 'Impossibile difendersi (ferito)',
              'confrontation.attackRoll': attackRoll,
              'confrontation.defenseRoll': 100,
              'confrontation.attackSuccessLevel': attackDegree,
              'confrontation.defenseSuccessLevel': 'fumble',
              'confrontation.outcome': 'hit',
              'confrontation.constitutionCheckRequired': true,
              'confrontation.constitutionCheckPassed': false,
              'confrontation.constitutionCheckRoll': constitutionRoll
            };

            const updated: any = await Chat.findOneAndUpdate(
              { _id: messageId, actionType: 'confrontation_reaction_request' },
              { $set: updateFields, $unset: { targetCharacters: '', 'confrontation.availableDefenseSkills': '' } },
              { new: true }
            );

            if (updated) {
              await CombatEncounter.updateOne(
                { _id: message.confrontation.encounterId },
                { $set: { status: 'completed', 'currentTurn.status': 'resolved' } }
              );

              const io = req.app.get('io');
              if (io) {
                io.to(`location_${message.locationId}`).emit('location_message_notification', {
                  locationId: message.locationId,
                  actionId: messageId,
                  characterName: character.characterName,
                  actionType: updated.actionType,
                  timestamp: updated.timestamp
                });
              }
            }

            logger.info(`Constitution check failed: ${messageId} (${character.characterName} too wounded to defend, ${constitutionRoll} vs ${constitutionValue})`);
            res.json(createResponse({ outcome: 'hit', constitutionCheckFailed: true }, 'Troppo ferito per difendersi', getRequestId(req)));
            return;
          }

          logger.info(`Constitution check passed: ${character.characterName} can defend (${constitutionRoll} vs ${constitutionValue})`);
        }
      }

      // ═══ NORMAL CONFRONTATION RESOLUTION ═══

      // Get attacker skill value
      const attackSkill = message.confrontation.attackSkill;
      const attackerSkillData = attackerCharacter.skills?.[attackSkill];
      let attackerValue = 0;
      if (attackerSkillData !== undefined) {
        if (typeof attackerSkillData === 'number') {
          attackerValue = attackerSkillData;
        } else if (attackerSkillData && typeof attackerSkillData === 'object' && 'total' in attackerSkillData) {
          attackerValue = (attackerSkillData as { total: number }).total;
        }
      }

      // Get defender skill value
      const defenderSkillData = defenderCharacter.skills?.[defenseSkillName];
      let defenderValue = 0;
      if (defenderSkillData !== undefined) {
        if (typeof defenderSkillData === 'number') {
          defenderValue = defenderSkillData;
        } else if (defenderSkillData && typeof defenderSkillData === 'object' && 'total' in defenderSkillData) {
          defenderValue = (defenderSkillData as { total: number }).total;
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

      // ═══ RAGGIRARE SPECIAL RESULT PRESENTATION ═══
      if (attackSkill === 'Raggirare') {
        // Attacker ALWAYS sees generic message (hiddenResultForAttacker flag)
        // Defender receives message ONLY if they win

        const attackerWins = comparison > 0;
        const originalContent = message.content;

        // Update main message with result (attacker won't see rolls due to hiddenResultForAttacker flag)
        const updateFields: any = {
          actionType: 'social_confrontation',
          visibility: 'public',
          'confrontation.phase': 'result',
          'confrontation.defenseSkill': defenseSkillName,
          'confrontation.attackRoll': attackRoll,
          'confrontation.defenseRoll': defenseRoll,
          'confrontation.attackSuccessLevel': attackDegree,
          'confrontation.defenseSuccessLevel': defenseDegree,
          'confrontation.outcome': attackerWins ? 'attacker_wins' : 'defender_wins'
        };

        const updated: any = await Chat.findOneAndUpdate(
          { _id: messageId, actionType: 'confrontation_reaction_request' },
          { $set: updateFields, $unset: { targetCharacters: '', 'confrontation.availableDefenseSkills': '' } },
          { new: true }
        );

        // Update encounter
        await CombatEncounter.updateOne(
          { _id: message.confrontation.encounterId },
          { $set: { status: 'completed', 'currentTurn.status': 'resolved', 'currentTurn.defenseSkill': defenseSkillName } }
        );

        // Emit update for main message
        const io = req.app.get('io');
        if (io) {
          io.to(`location_${message.locationId}`).emit('location_message_notification', {
            locationId: message.locationId,
            actionId: messageId,
            characterName: character.characterName,
            actionType: updated.actionType,
            timestamp: updated.timestamp
          });
        }

        // CREATE DEFENDER MESSAGE (only if defender wins/tie)
        if (!attackerWins) {
          let defenderMessage = '';

          // Y has hard/extreme/critical success → full message with lie text
          if (defenseDegree === 'hard' || defenseDegree === 'extreme' || defenseDegree === 'critical') {
            defenderMessage = `${attackerCharacter.name} sta evidentemente cercando di nasconderti qualcosa quando dice: "${originalContent}"`;
          }
          // Y has normal success → partial message
          else if (defenseDegree === 'normal') {
            defenderMessage = `Ti rendi conto che ${attackerCharacter.name} ti sta nascondendo qualcosa.`;
          }
          // Y has failure/fumble BUT X failed worse → basic message
          else {
            defenderMessage = `${attackerCharacter.name} sta dicendo una stronzata.`;
          }

          // Create whisper message for defender
          await Chat.create({
            actionType: 'social_confrontation',
            characterId: character.characterId,
            characterName: character.characterName,
            content: defenderMessage,
            locationId: message.locationId,
            visibility: 'whisper',
            targetCharacters: [message.confrontation.defenderCharacterId],
            characterRoles: ['master'], // Visible to defender + master
            timestamp: new Date(),
            confrontation: {
              type: 'social',
              phase: 'result',
              attackerCharacterId: message.confrontation.attackerCharacterId,
              defenderCharacterId: message.confrontation.defenderCharacterId,
              attackSkill: 'Raggirare',
              defenseSkill: defenseSkillName,
              attackRoll,
              defenseRoll,
              attackSuccessLevel: attackDegree,
              defenseSuccessLevel: defenseDegree,
              outcome: 'defender_wins'
            }
          });

          logger.info(`Raggirare detected: ${defenderCharacter.name} received message (${defenseDegree})`);
        } else {
          logger.info(`Raggirare succeeded: ${defenderCharacter.name} did not detect the lie`);
        }

        logger.info(`Raggirare resolved: ${messageId} (${attackerWins ? 'attacker wins' : 'defender wins'}: ${attackDegree} vs ${defenseDegree})`);
        res.json(createResponse({ outcome: attackerWins ? 'success' : 'detected' }, 'Raggirare risolto', getRequestId(req)));
        return;
      }

      // ═══ NORMAL CONFRONTATION: CALCULATE DAMAGE IF HIT (COMBAT ONLY) ═══
      let damageDealt = 0;
      let isCriticalDamage = false;
      let damageFormula = '';

      if (outcome === 'hit' && message.confrontation.type === 'combat') {
        // Import damage calculator
        const { calculateDamage, applyDamage } = await import('../utils/damageCalculator');

        // Determine damage formula (weapon or unarmed)
        const weaponStats = await WeaponService.getEquippedWeapon(attackerCharacter._id.toString());

        if (weaponStats) {
          damageFormula = weaponStats.damageFormula;
          logger.info(`[Combat] ${attackerCharacter.name} uses ${weaponStats.weaponType}: ${damageFormula}`);
        } else {
          damageFormula = '1d3'; // Fallback: unarmed combat
          logger.info(`[Combat] ${attackerCharacter.name} uses unarmed combat: 1d3`);
        }

        // Calculate damage
        const damageResult = calculateDamage(
          damageFormula,
          attackerCharacter.derived?.bonusDamage || '0',
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
    } catch (error: unknown) {
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

  /**
   * Check Pending Reaction
   *
   * Checks if character has pending reaction to resolve.
   * Returns message ID if pending reaction exists, null otherwise.
   *
   * @param characterId - Character to check
   * @param locationId - Current location
   * @returns Pending message ID or null
   */
  static async checkPendingReaction(characterId: string, locationId: string): Promise<string | null> {
    const pending = await Chat.findOne({
      locationId,
      'confrontation.defenderCharacterId': characterId,
      'confrontation.phase': 'waiting_reaction',
    });

    return pending ? pending._id.toString() : null;
  }

  /**
   * Handle Pending Reaction Abort
   *
   * Automatically resolves pending reaction with defender auto-fail.
   * Used when attacker force-aborts to proceed with new action or when timeout expires.
   *
   * @param messageId - Pending reaction request message ID
   * @param abortedByCharacterId - Character who triggered the abort
   * @param req - Express request (for WebSocket IO access)
   */
  static async handlePendingReactionAbort(
    messageId: string,
    abortedByCharacterId: string,
    req: Request
  ): Promise<void> {
    const message: any = await Chat.findById(messageId);
    if (!message || message.confrontation?.phase !== 'waiting_reaction') {
      logger.warn(`Abort failed: message ${messageId} not found or already resolved`);
      return;
    }

    // Get characters
    const attackerCharacter = await Character.findById(message.confrontation.attackerCharacterId);
    const defenderCharacter = await Character.findById(message.confrontation.defenderCharacterId);

    if (!attackerCharacter || !defenderCharacter) {
      logger.error(`Abort failed: characters not found for message ${messageId}`);
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
        attackerValue = (attackerSkillData as { total: number }).total;
      }
    }

    // Roll attack (defender auto-fails)
    const attackRoll = ChatController.rollDice('1d100').result;
    const attackDegree = calculateSuccessDegree(attackRoll, attackerValue).degree;

    // Prepare update fields
    const updateFields: any = {
      actionType: message.confrontation.type === 'combat' ? 'combat_action' : 'social_confrontation',
      visibility: 'public',
      'confrontation.phase': 'result',
      'confrontation.defenseSkill': 'Aborted (auto-fail)',
      'confrontation.attackRoll': attackRoll,
      'confrontation.defenseRoll': 100, // Auto-fumble
      'confrontation.attackSuccessLevel': attackDegree,
      'confrontation.defenseSuccessLevel': 'fumble',
      'confrontation.outcome': 'hit',
      'confrontation.abortedBy': abortedByCharacterId,
      'confrontation.abortedAt': new Date()
    };

    // Calculate damage if combat
    if (message.confrontation.type === 'combat') {
      const { calculateDamage, applyDamage } = await import('../utils/damageCalculator');

      const damageFormula = '1d3'; // Unarmed default
      const damageResult = calculateDamage(
        damageFormula,
        attackerCharacter.derived?.bonusDamage || '0',
        attackDegree
      );

      const damageDealt = damageResult.total;
      const isCriticalDamage = damageResult.isCritical;

      // Apply damage to defender
      const defenderHP = defenderCharacter.combat?.currentHP ?? defenderCharacter.derived?.hitPoints ?? 10;
      const defenderMaxHP = defenderCharacter.combat?.maxHP ?? defenderCharacter.derived?.hitPoints ?? 10;
      const damageResult2 = applyDamage(defenderHP, defenderMaxHP, damageDealt);

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
              source: `${attackerCharacter.name} (${attackSkill}) - Aborted`,
              timestamp: new Date()
            }
          }
        }
      );

      updateFields['confrontation.damageDealt'] = damageDealt;
      updateFields['confrontation.isCriticalDamage'] = isCriticalDamage;
      updateFields['confrontation.damageFormula'] = damageFormula;

      logger.info(`Damage applied (aborted): ${damageDealt} HP to ${defenderCharacter.name}`);
    }

    // Update message
    await Chat.findOneAndUpdate(
      { _id: messageId, actionType: 'confrontation_reaction_request' },
      { $set: updateFields, $unset: { targetCharacters: '', 'confrontation.availableDefenseSkills': '' } },
      { new: true }
    );

    // Update encounter
    await CombatEncounter.updateOne(
      { _id: message.confrontation.encounterId },
      { $set: { status: 'completed', 'currentTurn.status': 'resolved' } }
    );

    // Emit WebSocket update
    const io = req.app.get('io');
    if (io) {
      io.to(`location_${message.locationId}`).emit('location_message_notification', {
        locationId: message.locationId,
        actionId: messageId,
        characterName: attackerCharacter.name,
        actionType: updateFields.actionType,
        timestamp: new Date()
      });
    }

    logger.info(`Pending reaction aborted: ${messageId} by ${abortedByCharacterId}`);
  }

  /**
   * Force Confrontation Outcome (MASTER ONLY)
   * POST /game/chats/force-confrontation-outcome
   *
   * Allows master to forcibly resolve a pending confrontation with custom outcome.
   * Used to bypass stuck situations or apply narrative rulings.
   */
  static async forceConfrontationOutcome(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse(
          'Contesto personaggio richiesto',
          'CHARACTER_CONTEXT_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      // Validate master permission
      if (!character.gameplayRoles?.includes('master')) {
        res.status(403).json(errorResponse(
          'Solo il master può forzare esiti di confronti',
          'MASTER_PERMISSION_REQUIRED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      const { messageId, forcedOutcome, defenderSuccessLevel } = req.body;

      // Validate required fields
      if (!messageId || !forcedOutcome) {
        res.status(400).json(errorResponse(
          'messageId and forcedOutcome are required',
          'MISSING_REQUIRED_FIELDS',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Find message
      const message: any = await Chat.findById(messageId);
      if (!message || message.confrontation?.phase !== 'waiting_reaction') {
        res.status(400).json(errorResponse(
          'Messaggio non valido o già risolto',
          'INVALID_MESSAGE',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Get characters
      const attackerCharacter = await Character.findById(message.confrontation.attackerCharacterId);
      const defenderCharacter = await Character.findById(message.confrontation.defenderCharacterId);

      if (!attackerCharacter || !defenderCharacter) {
        res.status(404).json(errorResponse(
          'Personaggio non trovato',
          'CHARACTER_NOT_FOUND',
          undefined,
          404,
          getRequestId(req)
        ));
        return;
      }

      // Get skill values
      const attackSkill = message.confrontation.attackSkill;
      const defenseSkill = message.confrontation.availableDefenseSkills?.[0]?.skillName || 'Unknown';

      const attackerSkillData = attackerCharacter.skills?.[attackSkill];
      let attackerValue = 0;
      if (attackerSkillData !== undefined) {
        if (typeof attackerSkillData === 'number') {
          attackerValue = attackerSkillData;
        } else if (attackerSkillData && typeof attackerSkillData === 'object' && 'total' in attackerSkillData) {
          attackerValue = (attackerSkillData as { total: number }).total;
        }
      }

      const defenderSkillData = defenderCharacter.skills?.[defenseSkill];
      let defenderValue = 0;
      if (defenderSkillData !== undefined) {
        if (typeof defenderSkillData === 'number') {
          defenderValue = defenderSkillData;
        } else if (defenderSkillData && typeof defenderSkillData === 'object' && 'total' in defenderSkillData) {
          defenderValue = (defenderSkillData as { total: number }).total;
        }
      }

      // Roll dice (for record, outcome is forced)
      const attackRoll = ChatController.rollDice('1d100').result;
      const defenseRoll = ChatController.rollDice('1d100').result;

      // Calculate natural success levels
      const attackDegree = calculateSuccessDegree(attackRoll, attackerValue).degree;
      const naturalDefenseDegree = calculateSuccessDegree(defenseRoll, defenderValue).degree;

      // Apply forced outcome
      const finalDefenseDegree = defenderSuccessLevel || naturalDefenseDegree;
      const outcome = forcedOutcome; // 'attacker_wins' or 'defender_wins'

      // Update message
      const updateFields: any = {
        actionType: message.confrontation.type === 'combat' ? 'combat_action' : 'social_confrontation',
        visibility: 'public',
        'confrontation.phase': 'result',
        'confrontation.defenseSkill': defenseSkill,
        'confrontation.attackRoll': attackRoll,
        'confrontation.defenseRoll': defenseRoll,
        'confrontation.attackSuccessLevel': attackDegree,
        'confrontation.defenseSuccessLevel': finalDefenseDegree,
        'confrontation.outcome': outcome,
        'confrontation.forcedByMaster': true,
        'confrontation.forcedBy': character.characterId,
        'confrontation.forcedAt': new Date()
      };

      // Calculate damage if combat + attacker wins
      if (message.confrontation.type === 'combat' && outcome === 'attacker_wins') {
        const { calculateDamage, applyDamage } = await import('../utils/damageCalculator');

        const damageFormula = '1d3'; // Unarmed default
        const damageResult = calculateDamage(
          damageFormula,
          attackerCharacter.derived?.bonusDamage || '0',
          attackDegree
        );

        const damageDealt = damageResult.total;
        const isCriticalDamage = damageResult.isCritical;

        // Apply damage to defender
        const defenderHP = defenderCharacter.combat?.currentHP ?? defenderCharacter.derived?.hitPoints ?? 10;
        const defenderMaxHP = defenderCharacter.combat?.maxHP ?? defenderCharacter.derived?.hitPoints ?? 10;
        const damageResult2 = applyDamage(defenderHP, defenderMaxHP, damageDealt);

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
                source: `${attackerCharacter.name} (${attackSkill}) - Master Forced`,
                timestamp: new Date()
              }
            }
          }
        );

        updateFields['confrontation.damageDealt'] = damageDealt;
        updateFields['confrontation.isCriticalDamage'] = isCriticalDamage;
        updateFields['confrontation.damageFormula'] = damageFormula;
      }

      // Update message
      const updated: any = await Chat.findOneAndUpdate(
        { _id: messageId, actionType: 'confrontation_reaction_request' },
        { $set: updateFields, $unset: { targetCharacters: '', 'confrontation.availableDefenseSkills': '' } },
        { new: true }
      );

      // Update encounter
      await CombatEncounter.updateOne(
        { _id: message.confrontation.encounterId },
        { $set: { status: 'completed', 'currentTurn.status': 'resolved', 'currentTurn.defenseSkill': defenseSkill } }
      );

      // Emit WebSocket update
      const io = req.app.get('io');
      if (io) {
        io.to(`location_${message.locationId}`).emit('location_message_notification', {
          locationId: message.locationId,
          actionId: messageId,
          characterName: character.characterName,
          actionType: updated.actionType,
          timestamp: updated.timestamp
        });
      }

      logger.info(`Confrontation forced by master: ${messageId} (${outcome}, ${character.characterName})`);
      res.json(createResponse({ action: updated, outcome }, 'Esito forzato dal master', getRequestId(req)));
    } catch (error: unknown) {
      logger.error('Force confrontation outcome error:', error);
      res.status(500).json(errorResponse(
        'Failed to force confrontation outcome',
        'FORCE_OUTCOME_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Semantic search in chat messages
   * GET /api/game/chat/search?q=query&locationId=&characterId=&dateStart=&dateEnd=&page=1&limit=20
   */
  static async searchChat(req: Request, res: Response): Promise<void> {
    try {
      const { q: query, locationId, characterId, dateStart, dateEnd } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'La query di ricerca è obbligatoria',
          code: 'MISSING_QUERY'
        });
        return;
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      // Build filters object
      const filters: Record<string, any> = {};
      if (locationId && typeof locationId === 'string') filters.locationId = locationId;
      if (characterId && typeof characterId === 'string') filters.characterId = characterId;
      if (dateStart && typeof dateStart === 'string') filters.dateStart = dateStart;
      if (dateEnd && typeof dateEnd === 'string') filters.dateEnd = dateEnd;

      let messages: any[] = [];
      let total = 0;
      let searchMethod = 'semantic';

      // Try semantic search first (with timeout)
      try {
        const semanticResults = await Promise.race([
          EmbeddingService.semanticSearch(query.trim(), undefined, limit * 3, 0.3, 'chat', filters),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);

        if (semanticResults && semanticResults.length > 0) {
          const chatIds = semanticResults
            .map((r: any) => r.chatId)
            .slice(skip, skip + limit);

          if (chatIds.length > 0) {
            messages = await Chat.find({
              _id: { $in: chatIds }
            }).lean();

            // Re-order by semantic score
            const scoreMap = new Map(semanticResults.map((r: any) => [r.chatId, r.score]));
            messages.sort((a: any, b: any) => (scoreMap.get(b._id.toString()) || 0) - (scoreMap.get(a._id.toString()) || 0));

            total = messages.length;

            logger.info(`[ChatSearch] Semantic: ${messages.length} results for "${query}" with filters ${JSON.stringify(filters)}`);
          }
        }
      } catch (semanticError) {
        logger.warn('[ChatSearch] Semantic failed, fallback to regex:', semanticError);
        searchMethod = 'regex_fallback';
      }

      // Fallback to regex if semantic search failed or returned no results
      if (messages.length === 0) {
        const filter: Record<string, unknown> = {};
        if (locationId && typeof locationId === 'string') filter.locationId = locationId;
        if (characterId && typeof characterId === 'string') filter.characterId = characterId;
        if (dateStart || dateEnd) {
          const dateFilter: any = {};
          if (dateStart) dateFilter.$gte = new Date(dateStart as string);
          if (dateEnd) dateFilter.$lte = new Date(dateEnd as string);
          filter.timestamp = dateFilter;
        }

        const escapedQuery = escapeRegex(query.trim());

        messages = await Chat.find({
          ...filter,
          content: { $regex: escapedQuery, $options: 'i' }
        }).sort({ timestamp: -1 }).skip(skip).limit(limit).lean();

        total = await Chat.countDocuments({
          ...filter,
          content: { $regex: escapedQuery, $options: 'i' }
        });

        searchMethod = 'regex';
        logger.info(`[ChatSearch] Regex: ${messages.length} results for "${query}" with filters ${JSON.stringify(filters)}`);
      }

      const totalPages = Math.ceil(total / limit);
      const response = {
        ...listResponse(
          messages.map(m => ({
            id: m._id,
            locationId: m.locationId,
            characterId: m.characterId,
            characterName: m.characterName,
            content: m.content,
            timestamp: m.timestamp,
            actionType: m.actionType,
            visibility: m.visibility
          })),
          {
            currentPage: page,
            pageSize: limit,
            totalItems: total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
          },
          undefined,
          getRequestId(req)
        ),
        searchMethod,
      };

      res.json(response);
    } catch (error) {
      logger.error('[ChatSearch] Error:', error);
      res.status(500).json(errorResponse(
        'Impossibile effettuare la ricerca',
        'SEARCH_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * Action Router singleton
   * Lazy initialization with shared ActionContext
   */
  private static actionRouter: ActionRouter | null = null;

  private static getActionRouter(): ActionRouter {
    if (!ChatController.actionRouter) {
      const context: ActionContext = {
        diceService: new DiceService(),
        characterSkillService: new CharacterSkillService(),
        Character,
        Chat,
        Location,
        Skill,
        Item,
        SkillConfrontation,
        CombatEncounter,
        GamingSession,
        calculateSuccessDegree,
        getSuccessDegreeLabel,
        calculateSocialConflict,
        getDefensiveSkill,
        requestId: '', // Will be set per-request if needed
        logger
      };
      ChatController.actionRouter = new ActionRouter(context);
      logger.info('[ChatController] ActionRouter initialized');
    }
    return ChatController.actionRouter;
  }
}