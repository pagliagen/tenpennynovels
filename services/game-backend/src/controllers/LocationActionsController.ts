import { Request, Response } from 'express';
import { LocationAction } from '../../../../packages/database/models';
import { logger } from '../utils/logger';
import { getRedisPublisher } from '../config/redis';
import { EmbeddingEventPublisher } from '../utils/events/embedding-publisher';

export class LocationActionsController {
  
  /**
   * Create a new location action (message)
   * POST /game/locations/actions
   */
  static async createAction(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json({ success: false, error: 'Character context required' });
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
        itemId
      } = req.body;

      // Validate required fields
      if (!actionType || !content || !locationId) {
        res.status(400).json({ 
          success: false, 
          error: 'actionType, content, and locationId are required' 
        });
        return;
      }

      // Validate action type permissions
      const isValidAction = LocationActionsController.validateActionPermission(
        actionType, 
        character.gameplayRoles || []
      );
      
      if (!isValidAction) {
        res.status(403).json({ 
          success: false, 
          error: `You don't have permission to perform ${actionType} actions` 
        });
        return;
      }

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
        characterRoles: character.gameplayRoles || []
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
        actionData.diceResult = {
          ...rollResult,
          skillName,
          target: targetValue,
          success: rollResult.result <= targetValue
        };
      }

      // Handle stat checks
      if (actionType === 'stat_check' && statName && targetValue !== undefined) {
        const rollResult = LocationActionsController.rollDice('1d100');
        actionData.diceResult = {
          ...rollResult,
          statName,
          target: targetValue,
          success: rollResult.result <= targetValue
        };
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

      res.json({
        success: true,
        action: {
          id: savedAction._id,
          actionType: savedAction.actionType,
          characterName: savedAction.characterName,
          content: savedAction.content,
          timestamp: savedAction.timestamp,
          visibility: savedAction.visibility,
          diceResult: savedAction.diceResult,
          itemEffect: savedAction.itemEffect
        }
      });

    } catch (error: any) {
      const err = error as Error;
      logger.error('Create location action error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create location action' 
      });
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
        res.status(401).json({ success: false, error: 'Character context required' });
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

      // Filter master_only messages based on character roles
      const filteredActions = actions.filter((action: any) => {
        if (action.visibility === 'master_only') {
          return character.gameplayRoles?.some((role: string) => 
            ['master', 'moderatore', 'gestore'].includes(role)
          );
        }
        return true;
      });

      logger.info(`Retrieved ${filteredActions.length} location actions for ${character.characterName} in ${locationId}`);

      res.json({
        success: true,
        actions: filteredActions,
        meta: {
          locationId,
          hoursBack: hours,
          totalCount: filteredActions.length,
          timeThreshold: timeThreshold.toISOString()
        }
      });

    } catch (error: any) {
      const err = error as Error;
      logger.error('Get location actions error:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      res.status(500).json({ 
        success: false, 
        error: 'Failed to retrieve location actions' 
      });
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
    
    // For d100 rolls, determine success (lower is better in Call of Cthulhu)
    const success = diceSize === 100 ? result <= 50 : undefined;
    
    return { dice: diceSpec, result, success };
  }
}