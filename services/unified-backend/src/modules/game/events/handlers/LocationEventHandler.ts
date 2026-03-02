/**
 * Location Event Handler
 *
 * ✅ SPRINT 4: Refactor RedisEventManager God Object
 * ✅ USES ROOM-BASED BROADCASTS (Scalability fix)
 *
 * Handles all location-related events:
 * - Player entered/left location
 * - Character moved between locations
 * - Global presence updates
 * - Location chat messages
 */

import { BaseEventHandler } from '../BaseEventHandler';
import { RedisEvent } from '../types';
import { logger } from '../../utils/logger';

export class LocationEventHandler extends BaseEventHandler {
  getSupportedEventTypes(): string[] {
    return [
      'player_entered_location',
      'player_left_location',
      'location_chat_message',
      'character_moved',
      'globalPresence_update',
      'globalPresence_update_single'
    ];
  }

  async handle(event: RedisEvent): Promise<void> {
    this.logEventHandling(event.type, event);

    switch (event.type) {
      case 'player_entered_location':
        await this.handlePlayerEnteredLocation(event);
        break;

      case 'player_left_location':
        await this.handlePlayerLeftLocation(event);
        break;

      case 'location_chat_message':
        await this.handleLocationChatMessage(event);
        break;

      case 'character_moved':
        await this.handleCharacterMoved(event);
        break;

      case 'globalPresence_update':
        await this.handleGlobalPresenceUpdate(event);
        break;

      case 'globalPresence_update_single':
        await this.handleGlobalPresenceUpdateSingle(event);
        break;

      default:
        logger.debug(`[LocationEventHandler] Unhandled event type: ${event.type}`);
    }
  }

  /**
   * Handle player entered location
   * Adds player to location room
   */
  private async handlePlayerEnteredLocation(event: any): Promise<void> {
    const userSocket = await this.findUserSocket(event.userId);
    if (userSocket) {
      await userSocket.join(`location_${event.locationId}`);
    }
  }

  /**
   * Handle player left location
   * Removes player from location room
   */
  private async handlePlayerLeftLocation(event: any): Promise<void> {
    const userSocket = await this.findUserSocket(event.userId);
    if (userSocket) {
      await userSocket.leave(`location_${event.locationId}`);
    }
  }

  /**
   * Handle location chat message
   * Broadcasts message to location room
   */
  private async handleLocationChatMessage(event: any): Promise<void> {
    this.io.to(`location_${event.locationId}`).emit('chat_message', event.message);
  }

  /**
   * Handle character movement between locations
   * ✅ USES ROOM-BASED BROADCASTS (not global)
   */
  private async handleCharacterMoved(event: any): Promise<void> {
    logger.info('[LocationEventHandler] Handling character_moved event', event);

    // Find the character's WebSocket connection
    const characterSocket = await this.findCharacterSocket(event.characterId);
    if (!characterSocket) {
      logger.warn('[LocationEventHandler] Character socket not found for character_moved event', {
        characterId: event.characterId,
        characterName: event.characterName
      });
      return;
    }

    // If character moved to a new location (not parked at London)
    if (event.newLocationId) {
      // Get list of characters already in this location from WebSocket rooms
      const socketsInLocation = await this.io.in(`location_${event.newLocationId}`).fetchSockets();
      const presentCharacters = socketsInLocation
        .filter(s => s.data.character && s.data.character.characterId !== event.characterId) // Exclude the character who just moved
        .map(s => ({
          characterId: s.data.character.characterId,
          characterName: s.data.character.characterName,
          locationId: event.newLocationId
        }));

      logger.info('[LocationEventHandler] Sending location_joined event to character', {
        characterId: event.characterId,
        locationId: event.newLocationId,
        locationName: event.locationName,
        presentCharactersCount: presentCharacters.length
      });

      // Send location_joined event to trigger auto-redirect
      characterSocket.emit('location_joined', {
        locationId: event.newLocationId,
        locationName: event.locationName,
        timestamp: event.timestamp,
        presentCharacters: presentCharacters
      });

      // ✅ ROOM-BASED BROADCASTS: Notify only relevant location rooms
      if (event.oldLocationId) {
        logger.debug(`[LocationEventHandler] Broadcasting player_left to room location_${event.oldLocationId}`);
        this.io.to(`location_${event.oldLocationId}`).emit('player_left', {
          characterId: event.characterId,
          characterName: event.characterName,
          locationId: event.oldLocationId,
          timestamp: event.timestamp
        });
      }

      logger.debug(`[LocationEventHandler] Broadcasting player_entered to room location_${event.newLocationId}`);
      this.io.to(`location_${event.newLocationId}`).emit('player_entered', {
        characterId: event.characterId,
        characterName: event.characterName,
        locationId: event.newLocationId,
        timestamp: event.timestamp
      });

      // ✅ REMOVED GLOBAL BROADCASTS: Was causing scalability issues (broadcast to ALL clients)
      // Frontend can fetch location presence on-demand instead of receiving global updates
    }

    logger.info('[LocationEventHandler] character_moved event handled successfully');
  }

  /**
   * Handle global presence update (full broadcast)
   */
  private async handleGlobalPresenceUpdate(event: any): Promise<void> {
    logger.info('[LocationEventHandler] Handling globalPresence_update event', {
      characterCount: event.globalPresence?.length,
      timestamp: event.timestamp
    });

    // Broadcast the complete globalPresence data to all clients
    // This ensures all clients have the most up-to-date presence information
    this.io.emit('global_presence_update', {
      type: 'full_update',
      globalPresence: event.globalPresence,
      timestamp: event.timestamp
    });

    logger.info('[LocationEventHandler] globalPresence_update broadcasted to all clients');
  }

  /**
   * Handle single character global presence update (targeted)
   */
  private async handleGlobalPresenceUpdateSingle(event: any): Promise<void> {
    logger.info('[LocationEventHandler] Handling globalPresence_update_single event', {
      targetCharacterId: event.characterId,
      characterCount: event.globalPresence?.length,
      timestamp: event.timestamp
    });

    // Find the specific character's WebSocket connection
    const characterSocket = await this.findCharacterSocket(event.characterId);
    if (!characterSocket) {
      logger.warn('[LocationEventHandler] Character socket not found for single globalPresence update', {
        characterId: event.characterId
      });
      return;
    }

    // Send globalPresence update ONLY to this specific character
    characterSocket.emit('global_presence_update', {
      type: 'full_update',
      globalPresence: event.globalPresence,
      timestamp: event.timestamp
    });

    logger.info('[LocationEventHandler] globalPresence_update sent to single client', {
      characterId: event.characterId
    });
  }
}
