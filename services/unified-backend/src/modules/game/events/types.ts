/**
 * Event Handling System - Type Definitions
 *
 * ✅ SPRINT 4: Refactor RedisEventManager God Object
 *
 * Centralized type definitions for the refactored event handling system.
 */

import { Server as SocketIOServer, RemoteSocket } from 'socket.io';

/**
 * Base interface for all Redis events
 */
export interface RedisEvent {
  type: string;
  timestamp?: string;
  source?: string;
  [key: string]: any;
}

/**
 * Redis channel names
 */
export enum RedisChannel {
  USER_EVENTS = 'user:events',
  CHARACTER_EVENTS = 'character:events',
  CHARACTER_REVIEW = 'character:review_completed',
  GAME_EVENTS = 'game:events',
  WEATHER_CHANGED = 'game:weather_changed',
  LOCATION_EVENTS = 'location:events',
  CORPORATION_EVENTS = 'corporation:events',
  RELATIONSHIP_EVENTS = 'relationship:events',
  TICKET_EVENTS = 'ticket:events',
  SYSTEM_BROADCAST = 'system:broadcast'
}

/**
 * Base interface for event handlers
 *
 * All specialized event handlers implement this interface.
 */
export interface IEventHandler {
  /**
   * Handle a Redis event
   *
   * @param event - Parsed event data
   * @returns Promise that resolves when event is handled
   */
  handle(event: RedisEvent): Promise<void>;

  /**
   * Get the event types this handler can process
   *
   * @returns Array of event type strings
   */
  getSupportedEventTypes(): string[];
}

/**
 * Context provided to event handlers
 */
export interface EventHandlerContext {
  /**
   * Socket.io server instance for WebSocket emits
   */
  io: SocketIOServer;

  /**
   * Find a socket by user ID
   */
  findUserSocket(userId: string): Promise<RemoteSocket<any, any> | undefined>;

  /**
   * Find a socket by character ID
   */
  findCharacterSocket(characterId: string): Promise<RemoteSocket<any, any> | undefined>;

  /**
   * Notify all members of a group (corporation, etc.)
   */
  notifyGroupMembers(groupType: string, groupId: string, event: any): Promise<void>;
}

/**
 * Factory function type for creating event handlers
 */
export type EventHandlerFactory = (context: EventHandlerContext) => IEventHandler;
