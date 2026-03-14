import { logger } from '../logger';

/**
 * GameEventPublisher - Stub temporaneo
 *
 * TODO: Implementare pubblicazione eventi di gioco su Redis/WebSocket
 * Per ora è uno stub che logga gli eventi senza pubblicarli
 */

class GameEventPublisher {
  async publishRelationshipEvent(event: {
    type: string;
    characterId: string;
    relationshipId: string;
    data?: any;
  }): Promise<void> {
    // TODO: Implementare pubblicazione su Redis/WebSocket
    logger.info(`[GameEventPublisher] Relationship event: ${event.type}`, {
      relationshipId: event.relationshipId,
      characterId: event.characterId
    });
  }

  async publishCharacterEvent(event: {
    type: string;
    characterId: string;
    data?: any;
  }): Promise<void> {
    // TODO: Implementare pubblicazione su Redis/WebSocket
    logger.info(`[GameEventPublisher] Character event: ${event.type}`, {
      characterId: event.characterId
    });
  }

  async publishLocationEvent(event: {
    type: string;
    locationId: string;
    data?: any;
  }): Promise<void> {
    // TODO: Implementare pubblicazione su Redis/WebSocket
    logger.info(`[GameEventPublisher] Location event: ${event.type}`, {
      locationId: event.locationId
    });
  }
}

export const gameEventPublisher = new GameEventPublisher();
