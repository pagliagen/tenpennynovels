/**
 * Game Event Handler
 *
 * ✅ SPRINT 4: Refactor RedisEventManager God Object
 *
 * Handles all game-related events:
 * - Player actions
 * - Location changes
 * - Dice rolls
 * - Item usage
 * - Weather changes
 * - Corporation events
 * - Relationship events
 */

import { BaseEventHandler } from '../BaseEventHandler';
import { RedisEvent } from '../types';
import { logger } from '../../logger';

export class GameEventHandler extends BaseEventHandler {
  getSupportedEventTypes(): string[] {
    return [
      'player_action',
      'location_change',
      'dice_roll',
      'item_used',
      'weather_changed',
      'corporation_member_joined',
      'corporation_member_left',
      'corporation_salary_paid',
      'relationship_proposed',
      'relationship_accepted',
      'relationship_rejected'
    ];
  }

  async handle(event: RedisEvent): Promise<void> {
    this.logEventHandling(event.type, event);

    switch (event.type) {
      case 'player_action':
        await this.handlePlayerAction(event);
        break;

      case 'location_change':
        await this.handleLocationChange(event);
        break;

      case 'dice_roll':
        await this.handleDiceRoll(event);
        break;

      case 'item_used':
        await this.handleItemUsed(event);
        break;

      case 'weather_changed':
        await this.handleWeatherChanged(event);
        break;

      case 'corporation_member_joined':
      case 'corporation_member_left':
      case 'corporation_salary_paid':
        await this.handleCorporationEvent(event);
        break;

      case 'relationship_proposed':
        await this.handleRelationshipProposed(event);
        break;

      case 'relationship_accepted':
      case 'relationship_rejected':
        await this.handleRelationshipResponse(event);
        break;

      default:
        logger.debug(`[GameEventHandler] Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle player action
   */
  private async handlePlayerAction(event: any): Promise<void> {
    // Placeholder for future implementation
  }

  /**
   * Handle location change
   * Updates location occupancy
   */
  private async handleLocationChange(event: any): Promise<void> {
    this.io.to(`location_${event.fromLocationId}`).emit('player_left', {
      characterId: event.characterId,
      characterName: event.characterName,
      timestamp: event.timestamp
    });

    this.io.to(`location_${event.toLocationId}`).emit('player_entered', {
      characterId: event.characterId,
      characterName: event.characterName,
      timestamp: event.timestamp
    });
  }

  /**
   * Handle dice roll
   * Broadcasts result to location
   */
  private async handleDiceRoll(event: any): Promise<void> {
    this.io.to(`location_${event.locationId}`).emit('dice_roll_result', {
      characterId: event.characterId,
      characterName: event.characterName,
      diceResult: event.result,
      timestamp: event.timestamp
    });
  }

  /**
   * Handle item usage
   * Broadcasts to location if public
   */
  private async handleItemUsed(event: any): Promise<void> {
    if (event.isPublic) {
      this.io.to(`location_${event.locationId}`).emit('item_used', {
        characterId: event.characterId,
        characterName: event.characterName,
        itemName: event.itemName,
        effect: event.effect,
        timestamp: event.timestamp
      });
    }
  }

  /**
   * Handle weather change
   * Broadcasts to all connected clients when master advances game time
   */
  private async handleWeatherChanged(event: any): Promise<void> {
    logger.info('[GameEventHandler] Received weather_changed event:', {
      campaignId: event.campaignId,
      condition: event.weather?.currentCondition,
      temperature: event.weather?.temperature,
      moonPhase: event.weather?.moonPhase,
      gameDate: event.gameDate
    });

    // Broadcast weather change to ALL clients (global event)
    // All players in the campaign see the same weather
    this.io.emit('weather_changed', {
      weather: {
        currentCondition: event.weather?.currentCondition,
        temperature: event.weather?.temperature,
        moonPhase: event.weather?.moonPhase
      },
      gameDate: event.gameDate,
      timestamp: new Date().toISOString()
    });

    logger.info('[GameEventHandler] Weather change broadcasted to all clients');
  }

  /**
   * Handle corporation events
   * Notifies relevant users about corporation changes
   */
  private async handleCorporationEvent(event: any): Promise<void> {
    await this.notifyGroupMembers('corporation', event.corporationId, event);
  }

  /**
   * Handle relationship proposal
   * Notifies target character about relationship proposal
   */
  private async handleRelationshipProposed(event: any): Promise<void> {
    this.io.to(`user_${event.toUserId}`).emit('relationship_proposal', {
      fromCharacterId: event.fromCharacterId,
      fromCharacterName: event.fromCharacterName,
      relationshipType: event.relationshipType,
      proposalId: event.proposalId,
      message: event.message,
      timestamp: event.timestamp
    });
  }

  /**
   * Handle relationship response
   * Notifies proposer about relationship response
   */
  private async handleRelationshipResponse(event: any): Promise<void> {
    this.io.to(`user_${event.fromUserId}`).emit('relationship_response', {
      toCharacterId: event.toCharacterId,
      toCharacterName: event.toCharacterName,
      relationshipType: event.relationshipType,
      accepted: event.type === 'relationship_accepted',
      message: event.message,
      timestamp: event.timestamp
    });
  }
}
