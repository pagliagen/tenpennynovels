/**
 * Base Event Handler
 *
 * ✅ SPRINT 4: Refactor RedisEventManager God Object
 *
 * Abstract base class providing common functionality for all event handlers.
 */

import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../logger';
import { IEventHandler, RedisEvent, EventHandlerContext } from './types';

export abstract class BaseEventHandler implements IEventHandler {
  protected io: SocketIOServer;
  protected context: EventHandlerContext;

  constructor(context: EventHandlerContext) {
    this.io = context.io;
    this.context = context;
  }

  /**
   * Handle a Redis event (must be implemented by subclasses)
   */
  abstract handle(event: RedisEvent): Promise<void>;

  /**
   * Get supported event types (must be implemented by subclasses)
   */
  abstract getSupportedEventTypes(): string[];

  /**
   * Utility: Find socket by user ID
   */
  protected async findUserSocket(userId: string): Promise<any> {
    return this.context.findUserSocket(userId);
  }

  /**
   * Utility: Find socket by character ID
   */
  protected async findCharacterSocket(characterId: string): Promise<any> {
    return this.context.findCharacterSocket(characterId);
  }

  /**
   * Utility: Notify group members
   */
  protected async notifyGroupMembers(groupType: string, groupId: string, event: any): Promise<void> {
    return this.context.notifyGroupMembers(groupType, groupId, event);
  }

  /**
   * Utility: Log event handling
   */
  protected logEventHandling(eventType: string, details?: any): void {
    logger.debug(`[${this.constructor.name}] Handling ${eventType}`, details);
  }

  /**
   * Utility: Log error
   */
  protected logError(eventType: string, error: any): void {
    logger.error(`[${this.constructor.name}] Error handling ${eventType}:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
