import { Server as SocketIOServer } from 'socket.io';
import { WebSocketEvent } from '@database/models';
import { logger } from '../utils/logger';

/**
 * WebSocket Event Store Service
 *
 * ✅ SPRINT 4 - WebSocket Event Replay
 *
 * Centralizes WebSocket event emission + storage for replay functionality.
 * Every WebSocket event is both emitted AND saved to database for 24h.
 */

export interface EmitAndSaveOptions {
  characterId?: string;    // Target character (if event is character-specific)
  locationId?: string;      // Target location (if event is location-specific)
  chatId?: string;          // Target chat (if event is chat-specific)
  ttlHours?: number;        // Time-to-live in hours (default: 24)
}

export class WebSocketEventStore {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * Emit AND save event (for replay)
   *
   * This is the centralized method for all WebSocket events that need replay support.
   */
  async emitAndSave(
    eventType: string,
    payload: any,
    options: EmitAndSaveOptions = {}
  ): Promise<void> {
    try {
      // 1. Emit event via WebSocket (immediate delivery)
      this.io.emit(eventType, payload);

      // 2. Save event to database (for replay after reconnection)
      await (WebSocketEvent as any).saveEvent(eventType, payload, {
        characterId: options.characterId,
        locationId: options.locationId,
        chatId: options.chatId,
        ttlHours: options.ttlHours || 24
      });

      logger.debug('📡 WebSocket: Event emitted and saved', {
        eventType,
        characterId: options.characterId,
        locationId: options.locationId,
        chatId: options.chatId
      });

    } catch (error: any) {
      // Non-blocking: if save fails, at least the event was emitted
      logger.error('❌ WebSocket: Failed to save event (non-blocking):', {
        eventType,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Emit AND save to specific room
   *
   * For location-based or chat-based events that should only go to specific clients.
   */
  async emitToRoomAndSave(
    room: string,
    eventType: string,
    payload: any,
    options: EmitAndSaveOptions = {}
  ): Promise<void> {
    try {
      // 1. Emit to specific room via WebSocket
      this.io.to(room).emit(eventType, payload);

      // 2. Save event to database (for replay)
      await (WebSocketEvent as any).saveEvent(eventType, payload, {
        characterId: options.characterId,
        locationId: options.locationId,
        chatId: options.chatId,
        ttlHours: options.ttlHours || 24
      });

      logger.debug('📡 WebSocket: Event emitted to room and saved', {
        room,
        eventType,
        characterId: options.characterId,
        locationId: options.locationId
      });

    } catch (error: any) {
      // Non-blocking: event still emitted even if save fails
      logger.error('❌ WebSocket: Failed to save room event (non-blocking):', {
        room,
        eventType,
        error: error.message
      });
    }
  }

  /**
   * Emit to specific socket (character-specific event)
   *
   * For events that should only go to a single character.
   */
  async emitToSocketAndSave(
    socketId: string,
    eventType: string,
    payload: any,
    characterId: string,
    options: Omit<EmitAndSaveOptions, 'characterId'> = {}
  ): Promise<void> {
    try {
      // 1. Emit to specific socket
      this.io.to(socketId).emit(eventType, payload);

      // 2. Save event for this character
      await (WebSocketEvent as any).saveEvent(eventType, payload, {
        characterId,
        locationId: options.locationId,
        chatId: options.chatId,
        ttlHours: options.ttlHours || 24
      });

      logger.debug('📡 WebSocket: Event emitted to socket and saved', {
        socketId,
        eventType,
        characterId
      });

    } catch (error: any) {
      logger.error('❌ WebSocket: Failed to save socket event (non-blocking):', {
        socketId,
        eventType,
        characterId,
        error: error.message
      });
    }
  }

  /**
   * Get events since a specific eventId for a character
   *
   * Used for event replay after reconnection.
   */
  async getEventsSince(lastEventId: number, characterId: string, limit: number = 100) {
    try {
      const events = await (WebSocketEvent as any).getEventsSince(lastEventId, characterId, limit);

      logger.info('📡 WebSocket: Retrieved events for replay', {
        characterId,
        lastEventId,
        eventsFound: events.length
      });

      return events;

    } catch (error: any) {
      logger.error('❌ WebSocket: Failed to retrieve events:', {
        characterId,
        lastEventId,
        error: error.message
      });
      return [];
    }
  }
}
