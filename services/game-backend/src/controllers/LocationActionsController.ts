import { Request, Response } from 'express';
import { LocationAction, GamingSession, Location, Character } from '../../../database/models';
import { logger } from '../utils/logger';
import { getRedisPublisher } from '../config/redis';
import { EmbeddingEventPublisher } from '../utils/events/embedding-publisher';
import { successResponse, errorResponse, createResponse, getRequestId } from '../utils/apiResponse';
import { calculateSuccessDegree, SuccessDegree } from '../utils/successDegrees';
import { calculateSocialConflict, isValidSocialSkillPair, getDefensiveSkill } from '../utils/socialConflicts';

export class LocationActionsController {
  
  /**
   * Create a new location action (message)
   * POST /game/locations/actions
   */
  static async createAction(req: Request, res: Response): Promise<void> {
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
        skillName,
        statName,
        targetValue,
        itemId,
        tags,
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
      const isValidAction = LocationActionsController.validateActionPermission(
        actionType, 
        character.gameplayRoles || []
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

      // Check if action mode is active and if this action should be hidden
      let shouldHide = false;
      if (isHidden !== undefined) {
        shouldHide = isHidden;
      } else {
        // Check if location has active action mode
        const Location = require('../../../database/models').Location;
        const location = await Location.findById(locationId);
        if (location?.activeSession?.sessionId) {
          const session = await GamingSession.findById(location.activeSession.sessionId);
          if (session?.actionModeActive && session.actionModeEndsAt && new Date() < session.actionModeEndsAt) {
            shouldHide = true;
          }
        }
      }

      // Extract single tag from tags array (first tag if multiple)
      const currentTag = Array.isArray(tags) && tags.length > 0 ? tags[0] : null;

      // Build the location action
      const actionData: any = {
        actionType,
        characterId: character.characterId,
        characterName: character.characterName,
        characterSurname: character.characterSurname,
        content: content.trim(),
        locationId,
        timestamp: new Date(),
        visibility: visibility || LocationActionsController.getActionVisibility(actionType),
        characterRoles: character.gameplayRoles || [],
        tags: currentTag ? [currentTag] : [],
        isHidden: shouldHide
      };

      // Handle special action types
      if (actionType === 'whisper' && targetCharacters) {
        actionData.targetCharacters = targetCharacters;
      }

      // Handle dice rolling actions
      if (actionType === 'dice_roll' && diceSpec) {
        actionData.diceResult = LocationActionsController.rollDice(diceSpec);
      }

      // Handle skill checks
      if (actionType === 'skill_check' && skillName && targetValue !== undefined) {
        const rollResult = LocationActionsController.rollDice('1d100');
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
        const rollResult = LocationActionsController.rollDice('1d100');
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
      const savedAction = await (LocationAction.createAction(actionData) as any);

      // Update occupant tag if a tag was provided
      if (currentTag) {
        try {
          const location = await Location.findById(locationId);
          if (location) {
            await location.updateOccupantTag(character.characterId, currentTag);
            logger.info(`Updated occupant tag for ${character.characterName} in ${locationId}: ${currentTag}`);
          }
        } catch (error) {
          // Don't fail the request if tag update fails
          logger.error('Failed to update occupant tag:', error);
        }
      }

      // Publish Redis event for async embedding generation
      try {
        const redisPublisher = getRedisPublisher();
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

      // Emit WebSocket notification (not the full data, just a ping)
      const io = req.app.get('io');
      console.log('🔌 LocationActionsController: io instance:', io ? 'FOUND' : 'NOT FOUND');
      
      if (io) {
        const roomName = `location_${locationId}`;
        const notification = {
          locationId,
          actionId: savedAction._id,
          characterName: character.characterName,
          actionType,
          timestamp: savedAction.timestamp
        };
        
        console.log('🔔 LocationActionsController: Emitting notification to room:', roomName, notification);
        io.to(roomName).emit('location_message_notification', notification);
        
        // Debug: Check how many clients are in the room
        const room = io.sockets.adapter.rooms.get(roomName);
        console.log('👥 LocationActionsController: Clients in room', roomName, ':', room ? room.size : 0);
      } else {
        console.error('❌ LocationActionsController: Socket.io instance not found in req.app');
      }

      logger.info(`Location action created: ${character.characterName} (${actionType}) in ${locationId}`);

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
  static async getLocationActions(req: Request, res: Response): Promise<void> {
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

      // Filter master_only messages and hidden actions based on character roles and action mode
      const filteredActions = actions.filter((action: any) => {
        // Filter master_only messages
        if (action.visibility === 'master_only') {
          const hasMasterRole = character.gameplayRoles?.some((role: string) => 
            ['master', 'moderatore', 'gestore'].includes(role)
          );
          if (!hasMasterRole) return false;
        }
        
        // Filter hidden actions (action mode)
        if (action.isHidden && !action.revealedAt && isActionModeActive) {
          // Action mode still active: only show to sender
          return action.characterId === character.characterId;
        }
        
        return true;
      }).map((action: any) => {
        // Normalize action: ensure tags field is always present (even if empty array)
        const normalizedAction: any = {
          ...action,
          tags: action.tags || []
        };
        
        // Filter socialConflict data based on visibility rules
        if (normalizedAction.socialConflict) {
          const socialConflict = normalizedAction.socialConflict;
          
          // If socialConflict is visible only to defender
          if (socialConflict.visibleToDefenderOnly) {
            const isAttacker = action.characterId === character.characterId;
            const isDefender = action.targetCharacters?.includes(character.characterId);
            
            // Attacker should NEVER see socialConflict data for Raggirare
            if (isAttacker) {
              delete normalizedAction.socialConflict;
            }
            // Defender can see it only if they detected something (result !== 'victory')
            else if (!isDefender || socialConflict.result === 'victory') {
              delete normalizedAction.socialConflict;
            }
            // Other users should never see it
            else if (!isDefender) {
              delete normalizedAction.socialConflict;
            }
          }
          // For non-hidden social conflicts, everyone can see them
        }
        
        return normalizedAction;
      });

      logger.info(`Retrieved ${filteredActions.length} location actions for ${character.characterName} in ${locationId}`);

      res.json(successResponse(
        {
          actions: filteredActions,
          meta: {
            locationId,
            hoursBack: hours,
            totalCount: filteredActions.length,
            timeThreshold: timeThreshold.toISOString()
          }
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
   */
  private static validateActionPermission(actionType: string, roles: string[]): boolean {
    switch (actionType) {
      case 'master':
        return roles.includes('master') || roles.includes('gestore');
      case 'moderation':
        return roles.includes('moderatore') || roles.includes('gestore');
      case 'standard':
      case 'whisper':
      case 'ooc':
      case 'dice_roll':
      case 'skill_check':
      case 'stat_check':
      case 'item_use':
        return roles.includes('personaggio') || roles.includes('master') || 
               roles.includes('moderatore') || roles.includes('gestore');
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
  private static rollDice(diceSpec: string): { dice: string; result: number; success?: boolean } {
    const match = diceSpec.match(/^(\d+)d(\d+)(?:[+\-](\d+))?$/i);
    
    if (!match) {
      return { dice: diceSpec, result: 0 };
    }
    
    const numDice = parseInt(match[1]);
    const diceSize = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;
    
    let total = 0;
    for (let i = 0; i < numDice; i++) {
      total += Math.floor(Math.random() * diceSize) + 1;
    }
    
    const result = total + modifier;
    
    // For normal dice rolls, return only the result without success/failure judgment
    return { dice: diceSpec, result };
  }

  /**
   * Update an existing location action (edit)
   * PATCH /game/locations/actions/:actionId
   */
  static async updateAction(req: Request, res: Response): Promise<void> {
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
      const isMaster = character.gameplayRoles?.includes('master') || character.gameplayRoles?.includes('gestore');
      
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
  static async deleteAction(req: Request, res: Response): Promise<void> {
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
                       character.gameplayRoles?.includes('gestore');
      
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
        attackerValue,
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

      // Get defender skill value (handle both number and SkillBreakdown)
      const defenderSkillData = defenderCharacter.skills?.get(defenderSkill);
      let defenderValue = 0;
      
      if (defenderSkillData !== undefined) {
        if (typeof defenderSkillData === 'number') {
          defenderValue = defenderSkillData;
        } else if (defenderSkillData && typeof defenderSkillData === 'object' && 'total' in defenderSkillData) {
          defenderValue = defenderSkillData.total;
        }
      }

      // If skill doesn't exist or is 0, use default value of 1 (minimum skill level)
      if (defenderValue === 0) {
        defenderValue = 1;
        logger.warn(`Defender skill ${defenderSkill} not found or is 0 for character ${defenderCharacterId}, using default value of 1`);
      }

      // Roll dice for both characters
      const attackerRoll = LocationActionsController.rollDice('1d100').result;
      const defenderRoll = LocationActionsController.rollDice('1d100').result;

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
        characterSurname: character.characterSurname,
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

      const savedAction = await LocationAction.createAction(actionData);

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
  static async clearChat(req: Request, res: Response): Promise<void> {
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
                       character.gameplayRoles?.includes('gestore');
      
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
}