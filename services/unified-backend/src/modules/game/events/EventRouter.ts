/**
 * Event Router
 *
 * ✅ SPRINT 4: Refactor RedisEventManager God Object
 *
 * Central router that dispatches Redis events to specialized handlers.
 * Replaces the monolithic switch statements in RedisEventManager.
 */

import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../utils/logger';
import { IEventHandler, RedisEvent, RedisChannel, EventHandlerContext } from './types';

// Import all event handlers
import { CharacterEventHandler } from './handlers/CharacterEventHandler';
import { CharacterReviewEventHandler } from './handlers/CharacterReviewEventHandler';
import { LocationEventHandler } from './handlers/LocationEventHandler';
import { UserEventHandler } from './handlers/UserEventHandler';
import { GameEventHandler } from './handlers/GameEventHandler';
import { TicketEventHandler } from './handlers/TicketEventHandler';

export class EventRouter {
  private handlers: Map<string, IEventHandler> = new Map();
  private io: SocketIOServer;
  private context: EventHandlerContext;

  constructor(io: SocketIOServer) {
    this.io = io;

    // Create event handler context with utility methods
    this.context = {
      io,
      findUserSocket: this.findUserSocket.bind(this),
      findCharacterSocket: this.findCharacterSocket.bind(this),
      notifyGroupMembers: this.notifyGroupMembers.bind(this)
    };

    // Initialize all event handlers
    this.registerHandler('user', new UserEventHandler(this.context));
    this.registerHandler('character', new CharacterEventHandler(this.context));
    this.registerHandler('character_review', new CharacterReviewEventHandler(this.context));
    this.registerHandler('location', new LocationEventHandler(this.context));
    this.registerHandler('game', new GameEventHandler(this.context));
    this.registerHandler('ticket', new TicketEventHandler(this.context));

    logger.info('✅ Event Router initialized with all handlers');
  }

  /**
   * Register an event handler
   */
  private registerHandler(domain: string, handler: IEventHandler): void {
    this.handlers.set(domain, handler);
    logger.debug(`[EventRouter] Registered handler for domain: ${domain}`, {
      supportedEvents: handler.getSupportedEventTypes()
    });
  }

  /**
   * Route an event to the appropriate handler based on channel
   */
  async routeEvent(channel: RedisChannel, event: RedisEvent): Promise<void> {
    try {
      const handler = this.getHandlerForChannel(channel);

      if (!handler) {
        logger.warn(`[EventRouter] No handler found for channel: ${channel}`);
        return;
      }

      await handler.handle(event);

    } catch (error: any) {
      logger.error(`[EventRouter] Error routing event from channel ${channel}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        eventType: event.type
      });
    }
  }

  /**
   * Get the appropriate handler for a Redis channel
   */
  private getHandlerForChannel(channel: RedisChannel): IEventHandler | undefined {
    switch (channel) {
      case RedisChannel.USER_EVENTS:
        return this.handlers.get('user');

      case RedisChannel.CHARACTER_EVENTS:
        return this.handlers.get('character');

      case RedisChannel.CHARACTER_REVIEW:
        return this.handlers.get('character_review');

      case RedisChannel.LOCATION_EVENTS:
        return this.handlers.get('location');

      case RedisChannel.GAME_EVENTS:
      case RedisChannel.WEATHER_CHANGED:
      case RedisChannel.CORPORATION_EVENTS:
      case RedisChannel.RELATIONSHIP_EVENTS:
        return this.handlers.get('game');

      case RedisChannel.TICKET_EVENTS:
        return this.handlers.get('ticket');

      default:
        return undefined;
    }
  }

  /**
   * Utility: Find socket by user ID
   */
  private async findUserSocket(userId: string): Promise<any> {
    const sockets = await this.io.fetchSockets();
    return sockets.find(socket => socket.data.userId === userId);
  }

  /**
   * Utility: Find socket by character ID
   */
  private async findCharacterSocket(characterId: string): Promise<any> {
    const sockets = await this.io.fetchSockets();

    logger.debug('[EventRouter] Searching for character socket', {
      targetCharacterId: characterId,
      totalSockets: sockets.length,
      socketsWithCharacter: sockets.filter(s => s.data.character).map(s => ({
        characterId: s.data.character.characterId,
        characterName: s.data.character.characterName
      }))
    });

    const foundSocket = sockets.find(socket => socket.data.character?.characterId === characterId);

    logger.debug('[EventRouter] Search result', {
      characterId,
      found: !!foundSocket
    });

    return foundSocket;
  }

  /**
   * Utility: Notify all members of a group
   */
  private async notifyGroupMembers(groupType: string, groupId: string, event: any): Promise<void> {
    this.io.to(`${groupType}_${groupId}`).emit(`${groupType}_event`, event);
  }
}
