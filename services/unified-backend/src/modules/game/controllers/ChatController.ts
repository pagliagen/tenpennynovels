import { Request, Response } from 'express';
import { Character } from '@core/character/models/Character';
import { Location } from '@core/location/models/Location';
import { Chat } from '@core/chat/models/Chat';
import { ChatBackup } from '@core/chat/models/ChatBackup';
import { actionTypeRegistry } from '@core/chat/actionTypes/registry';
import { Skill } from '@database/models';
import { logger } from '../logger';
import { successResponse, errorResponse, createResponse, listResponse, getRequestId } from '@shared/utils/apiResponse';
import { ConfigurationService } from '@shared/services/ConfigurationService';
import { redis } from '@config/runtime/redis';
import { escapeRegex } from '@shared/utils/validation';
import { EmbeddingService } from '@features/documenti/api';
import { Item } from '@features/oggetti/api';

import { calculateSuccessDegree, getSuccessDegreeLabel } from '../utils/successDegrees';
import { getSocketIO } from '../websocket/socketInstance';
import { appConfig } from '@config/runtime';

// Action Router (Refactored architecture)
import { ActionRouter } from '../actions/ActionRouter';
import { ActionContext, ActionInput } from '../actions/types';
import { DiceService } from '../services/DiceService';
import { CharacterSkillService } from '../services/CharacterSkillService';

// Message Transformer (Phase 2 refactoring)
import { ChatMessageService } from '../services/ChatMessageService';

// Chat Scene Service (segmentazione chat in scene narrative per personaggio)
import { ChatSceneService } from '@features/fineSessione/api';

// WebSocket Service (Centralized emissions)
import { ChatWebSocketService } from '../services/ChatWebSocketService';

// Finestra entro cui un giocatore (non master) può modificare una propria azione già inviata.
const EDIT_TIME_WINDOW_MS = 30 * 1000;

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
        isHidden,
        locationPngId // Optional: override with a location-scoped PNG persona (master/owner only)
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
      const isValidAction = await actionTypeRegistry.canCreate(
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

      // Check if this action should be hidden (explicit override only)
      const shouldHide = isHidden !== undefined ? isHidden : false;

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
      let displayName = freshCharacter.name;
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

      // ========== LOCATION PNG OVERRIDE (master or location owner only) ==========
      // Explicit per-message choice (unlike the sticky personal fakePngs above),
      // sourced from Location.locationPngs. Takes precedence when provided.
      if (locationPngId && location) {
        const isMasterForLocationPng = character.gameplayRoles?.includes('master') || character.isGestore || false;
        const isLocationOwner = location.access?.ownerId?.toString() === character.characterId;

        if (isMasterForLocationPng || isLocationOwner) {
          const locationPng = (location.locationPngs || []).find(
            (p: any) => p._id?.toString() === locationPngId
          );

          if (locationPng) {
            isMasked = true;
            realCharacterName = realCharacterName || displayName; // preserve real name for admin
            displayName = buildFullName(locationPng.name, locationPng.surname);
            displayAvatar = locationPng.avatar;
          } else {
            logger.warn(`[ChatController] locationPngId ${locationPngId} not found on location ${locationId}`);
          }
        } else {
          logger.warn(`[ChatController] Character ${character.characterId} attempted locationPngId override without permission`);
        }
      }
      // ========== END LOCATION PNG OVERRIDE ==========

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
        visibility: visibility || actionTypeRegistry.getDefaultVisibility(actionType),
        characterRoles: character.gameplayRoles || [],
        position: position || undefined,
        isHidden: shouldHide
      };

      // REFACTORED: Use Action Router for modular action handling
      // 9 tipi passano da qui; social_confrontation/combat_action/
      // confrontation_reaction_request non hanno mai un handler in
      // ActionRouter — solo le route dedicate di features/confronti li
      // creano (actionTypeRegistry.canCreate ritorna sempre false per loro
      // su questo percorso generico, il controllo sopra li ha gia' respinti
      // prima di arrivare qui).
      const handledActionTypes = [
        'standard', 'ooc', 'whisper',
        'dice_roll', 'skill_check', 'stat_check',
        'item_use', 'master', 'moderation'
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
          itemId,
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

      // Fire-and-forget: segmentazione in "scene" narrative per il download
      // personale del personaggio. Non deve mai ritardare risposta/broadcast.
      if (actionData.actionType === 'standard') {
        ChatSceneService.handleStandardMessage({
          chatMessageId: savedAction._id.toString(),
          locationId,
          locationName: location?.name,
          characterId: freshCharacter._id.toString(),
          characterName: displayName,
          content: content.trim(),
          timestamp: savedAction.timestamp
        }).catch((error) => {
          logger.error('[ChatScene] handleStandardMessage failed', { error, locationId });
        });
      }

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

        // Resolve whisper target names for display (sender/targets/master already
        // authorized to see the message itself, so this adds no new exposure)
        let whisperEnrichment: { targetCharacterIds: string[]; targetCharacterNames: string[] } | undefined;
        if (savedAction.visibility === 'whisper' && savedAction.targetCharacters?.length) {
          const targetChars = await Character.find({ _id: { $in: savedAction.targetCharacters } })
            .select('_id name')
            .lean();
          const nameById = new Map(targetChars.map((c: any) => [c._id.toString(), c.name]));
          whisperEnrichment = {
            targetCharacterIds: savedAction.targetCharacters,
            targetCharacterNames: savedAction.targetCharacters.map((id: string) => nameById.get(id) || 'Unknown')
          };
        }

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
          visibility: savedAction.visibility,            // Needed by frontend for client-side visibility filtering
          diceResult: savedAction.diceResult || undefined,  // DB field (was diceRoll)
          // Fix: Only include socialConflict if it has properties (Mongoose creates empty {} for subdocuments)
          socialConflict: (savedAction.socialConflict && Object.keys(savedAction.socialConflict).length > 0)
            ? savedAction.socialConflict
            : undefined,
          statCheck: (savedAction as unknown as Record<string, unknown>).statCheck || undefined,
          itemEffect: savedAction.itemEffect || undefined,  // DB field (was itemUse)
          targetCharacters: savedAction.targetCharacters || undefined,  // DB field (was whisperVisibility)
          whisper: whisperEnrichment,
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

        // SECURITY: Non-public messages must NEVER be broadcast to the whole
        // location room. The full message content (whisper text, master/mod
        // narration, hidden action-mode content) is only sent to sockets that
        // are actually authorized to see it, mirroring ChatMessageService.canSeeAction.
        // Broadcasting unfiltered to `roomName` would leak private content to every
        // client's network layer regardless of what the UI chooses to render.
        const isHiddenUntilRevealed = !!savedAction.isHidden && !savedAction.revealedAt;

        if (savedAction.visibility === 'whisper') {
          // "staff" reaches every connected master — canSeeAction grants master
          // visibility into every whisper, so live delivery must match.
          const recipientRooms = [
            `character_${savedAction.characterId}`,
            'staff',
            ...(savedAction.targetCharacters || []).map((id: string) => `character_${id}`),
          ];
          io.to(recipientRooms).emit('location_message_notification', notification);
          logger.debug(`ChatsController: Emitted whisper notification to ${recipientRooms.length} character room(s) + staff`, { messageId: chatMessage._id });
        } else if (savedAction.visibility === 'master_only') {
          // "staff" reaches every connected master; targetCharacters (if the
          // master picked specific pg for an "esito riservato") are added on top.
          const recipientRooms = [
            `character_${savedAction.characterId}`,
            'staff',
            ...(savedAction.targetCharacters || []).map((id: string) => `character_${id}`),
          ];
          io.to(recipientRooms).emit('location_message_notification', notification);
          logger.debug(`ChatsController: Emitted master_only notification to sender + staff + ${(savedAction.targetCharacters || []).length} targeted character room(s)`, { messageId: chatMessage._id });
        } else if (isHiddenUntilRevealed) {
          io.to(`character_${savedAction.characterId}`).emit('location_message_notification', notification);
          logger.debug(`ChatsController: Emitted hidden action-mode notification to sender only`, { messageId: chatMessage._id });
        } else {
          logger.debug(`ChatsController: Emitting notification to room ${roomName} with message ${chatMessage._id}`);
          io.to(roomName).emit('location_message_notification', notification);

          // Debug: Check how many clients are in the room
          const room = io.sockets.adapter.rooms.get(roomName);
          logger.debug(`ChatsController: Clients in room ${roomName}: ${room ? room.size : 0}`);
        }
      } else {
        logger.error('ChatsController: Socket.io instance not found in req.app');
      }

      logger.info(`Location action created: ${character.characterName} (${actionType}) in ${locationId}`);

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
      const hours = Number.parseInt(req.query.hours as string) || 3;
      const limit = Math.min(200, Math.max(10, Number.parseInt(req.query.limit as string) || 100));
      const offset = Math.max(0, Number.parseInt(req.query.offset as string) || 0);

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

      // Check time limit for non-masters
      if (!isMaster) {
        const timeWindowAgo = new Date(Date.now() - EDIT_TIME_WINDOW_MS);
        if (action.timestamp < timeWindowAgo) {
          res.status(403).json(errorResponse(
            `You can only edit actions within ${EDIT_TIME_WINDOW_MS / 1000} seconds of posting`,
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

      // Route the broadcast the same way createMessage does — a whisper or
      // master_only edit must reach only sender/targets/master, never the
      // whole location room. editHistory (pre-edit content) is master-only
      // regardless of visibility, so it's always stripped from the broadcast;
      // the HTTP response below stays full since it only reaches the editor.
      const broadcastMessage = { ...enrichedMessage, editHistory: [] };
      const io = getSocketIO();
      if (io) {
        const notification = {
          message: broadcastMessage,
          locationId: action.locationId.toString(),
        };

        if (action.visibility === 'whisper') {
          const recipientRooms = [
            `character_${action.characterId}`,
            'staff',
            ...(action.targetCharacters || []).map((id: string) => `character_${id}`),
          ];
          io.to(recipientRooms).emit('location_message_notification', notification);
        } else if (action.visibility === 'master_only') {
          const recipientRooms = [
            `character_${action.characterId}`,
            'staff',
            ...(action.targetCharacters || []).map((id: string) => `character_${id}`),
          ];
          io.to(recipientRooms).emit('location_message_notification', notification);
        } else {
          io.to(`location_${action.locationId}`).emit('location_message_notification', notification);
        }
      }

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

      // Check time limit for non-masters
      if (!isMaster) {
        const timeWindowAgo = new Date(Date.now() - EDIT_TIME_WINDOW_MS);
        if (action.timestamp < timeWindowAgo) {
          res.status(403).json(errorResponse(
            `You can only delete actions within ${EDIT_TIME_WINDOW_MS / 1000} seconds of posting`,
            'DELETE_TIME_EXPIRED',
            undefined,
            403,
            getRequestId(req)
          ));
          return;
        }
      }

      const locationId = action.locationId;

      // Soft delete: kept in the permanent archive (deletedAt set) for master/
      // gestionale log access; the post-findOneAndUpdate hook on Chat removes
      // the mirrored row from ChatBackup, so it disappears from the live game
      // view immediately instead of waiting out the TTL.
      await Chat.findByIdAndUpdate(actionId, { deletedAt: new Date() }, { new: true });

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

      // Clears only the live/backup view — the permanent Chat archive (and
      // therefore the master/gestionale log) is untouched.
      const result = await ChatBackup.deleteMany({ locationId });

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

      const page = Math.max(1, Number.parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit as string) || 20));
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

  /**
   * Etichette di successo configurabili da admin (skill_check_success_level_labels,
   * sezione skill_check_system): valgono per qualsiasi tiro basato su abilità/caratteristica.
   * Fallback silenzioso ai default se Redis/DB non rispondono: un tiro non deve fallire
   * per un problema sulla configurazione delle etichette.
   */
  private static async getConfiguredSuccessDegreeLabel(degree: Parameters<typeof getSuccessDegreeLabel>[0]): Promise<string> {
    try {
      const configService = new ConfigurationService(redis.getClient(), logger);
      const customLabels = await configService.getConfig('skill_check_success_level_labels');
      return getSuccessDegreeLabel(degree, customLabels);
    } catch (error) {
      logger.warn('[ChatController] Failed to load skill_check_success_level_labels, using defaults', { error });
      return getSuccessDegreeLabel(degree);
    }
  }

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
        calculateSuccessDegree,
        getSuccessDegreeLabel: ChatController.getConfiguredSuccessDegreeLabel,
        requestId: '', // Will be set per-request if needed
        logger
      };
      ChatController.actionRouter = new ActionRouter(context);
      logger.info('[ChatController] ActionRouter initialized');
    }
    return ChatController.actionRouter;
  }
}