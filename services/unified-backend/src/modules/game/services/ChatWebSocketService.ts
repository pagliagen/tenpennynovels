/**
 * ChatWebSocketService
 *
 * Centralized WebSocket emission service for chat-related events.
 * Handles all Socket.IO broadcasts from ChatController with consistent
 * patterns, logging, and error handling.
 *
 * Benefits:
 * - DRY: Eliminates 9 scattered emit calls in ChatController
 * - Type Safety: Enforces payload contracts with TypeScript interfaces
 * - Consistent Patterns: All emissions use getSocketIO(), standardized logging
 * - Maintainability: Single source of truth for WebSocket emissions
 * - Extensibility: Easy to add middleware (rate limiting, analytics, event replay)
 *
 * @module services/ChatWebSocketService
 * @since 2.3.0
 */

import { Server as SocketIOServer } from 'socket.io';
import { getSocketIO } from '../websocket/socketInstance';
import { logger } from '../logger';
import type {
  MessageCreatedParams,
  MessageNotificationPayload,
  MessageDeletedParams,
  MessageDeletedPayload,
  ChatClearedParams,
  ChatClearedPayload,
  TurnAdvancedParams,
  TurnAdvancedPayload,
  PartialMessageParams,
} from './ChatWebSocketService.types';

/**
 * ChatWebSocketService
 *
 * Static class providing type-safe methods for emitting chat-related WebSocket events.
 * Follows NotificationService pattern (static class, best-effort emissions).
 */
export class ChatWebSocketService {
  /**
   * Get Socket.IO instance with null check
   *
   * @private
   * @returns Socket.IO instance or null if not initialized
   */
  private static getIO(): SocketIOServer | null {
    const io = getSocketIO();
    if (!io) {
      logger.warn('[ChatWebSocketService] Socket.IO not initialized, skipping emission');
    }
    return io;
  }

  /**
   * Get room name for location
   *
   * @private
   * @param locationId - Location ID
   * @returns Room name in format "location_{locationId}"
   */
  private static getLocationRoom(locationId: string): string {
    return `location_${locationId}`;
  }

  /**
   * Log emission with optional client count
   *
   * @private
   * @param eventType - WebSocket event type
   * @param roomName - Room name
   * @param payload - Emission payload
   * @param includeClientCount - Whether to log client count in room
   */
  private static logEmission(
    eventType: string,
    roomName: string,
    payload: any,
    includeClientCount: boolean = false
  ): void {
    const io = this.getIO();

    if (includeClientCount && io) {
      const room = io.sockets.adapter.rooms.get(roomName);
      logger.debug(`[ChatWebSocketService] Emitted '${eventType}' to room ${roomName} (${room ? room.size : 0} clients)`, {
        eventType,
        roomName,
        clientCount: room ? room.size : 0,
        payloadKeys: Object.keys(payload),
      });
    } else {
      logger.debug(`[ChatWebSocketService] Emitted '${eventType}' to room ${roomName}`, {
        eventType,
        roomName,
        payloadKeys: Object.keys(payload),
      });
    }
  }

  // ============ PUBLIC API ============

  /**
   * Emit message created/updated event
   *
   * Sends full enriched message to all clients in location room.
   * Frontend expects: { message: EnrichedChatMessage, locationId, locationName?, locationSlug? }
   *
   * Used by:
   * - createMessage() - New message created
   * - updateMessage() - Message edited (use emitMessageUpdated alias)
   * - createBotMessage() - Bot message created
   *
   * @param params - Message creation parameters
   *
   * @example
   * ```typescript
   * ChatWebSocketService.emitMessageCreated({
   *   locationId,
   *   message: enrichedMessage,
   *   locationName: location.name,
   *   locationSlug: location.slug,
   *   debug: true // Enable client count logging
   * });
   * ```
   */
  static emitMessageCreated(params: MessageCreatedParams): void {
    const io = this.getIO();
    if (!io) return;

    const roomName = this.getLocationRoom(params.locationId);
    const payload: MessageNotificationPayload = {
      message: params.message,
      locationId: params.locationId,
      locationName: params.locationName,
      locationSlug: params.locationSlug,
    };

    io.to(roomName).emit('location_message_notification', payload);
    this.logEmission('location_message_notification', roomName, payload, params.debug);
  }

  /**
   * Emit message updated event (alias for emitMessageCreated)
   *
   * Semantically clearer method name for message edit operations.
   * Uses same payload format as message creation - frontend doesn't differentiate.
   *
   * Used by:
   * - updateMessage() - Message edited
   * - handleConfrontationReaction() - Confrontation resolved (message updated)
   *
   * @param params - Message update parameters (same as MessageCreatedParams)
   *
   * @example
   * ```typescript
   * ChatWebSocketService.emitMessageUpdated({
   *   locationId: action.locationId.toString(),
   *   message: enrichedMessage
   * });
   * ```
   */
  static emitMessageUpdated(params: MessageCreatedParams): void {
    // Same implementation as emitMessageCreated (frontend doesn't differentiate)
    this.emitMessageCreated(params);
  }

  /**
   * Emit message deleted event
   *
   * Notifies all clients in location room that a message has been deleted.
   * Frontend expects: { locationId, actionId }
   *
   * Used by:
   * - deleteMessage() - User or master deleted a message
   *
   * @param params - Message deletion parameters
   *
   * @example
   * ```typescript
   * ChatWebSocketService.emitMessageDeleted({
   *   locationId: locationId.toString(),
   *   actionId: actionId.toString()
   * });
   * ```
   */
  static emitMessageDeleted(params: MessageDeletedParams): void {
    const io = this.getIO();
    if (!io) return;

    const roomName = this.getLocationRoom(params.locationId);
    const payload: MessageDeletedPayload = {
      locationId: params.locationId,
      actionId: params.actionId,
    };

    io.to(roomName).emit('location_action_deleted', payload);
    this.logEmission('location_action_deleted', roomName, payload, params.debug);
  }

  /**
   * Emit chat cleared event
   *
   * Notifies all clients in location room that all messages have been cleared.
   * Frontend expects: { locationId, clearedBy }
   *
   * Used by:
   * - clearChat() - Master cleared all messages in location
   *
   * @param params - Chat cleared parameters
   *
   * @example
   * ```typescript
   * ChatWebSocketService.emitChatCleared({
   *   locationId,
   *   clearedBy: character.characterName
   * });
   * ```
   */
  static emitChatCleared(params: ChatClearedParams): void {
    const io = this.getIO();
    if (!io) return;

    const roomName = this.getLocationRoom(params.locationId);
    const payload: ChatClearedPayload = {
      locationId: params.locationId,
      clearedBy: params.clearedBy,
    };

    io.to(roomName).emit('location_chat_cleared', payload);
    this.logEmission('location_chat_cleared', roomName, payload, params.debug);
  }

  /**
   * Emit turn advanced event
   *
   * Notifies all clients in location room that the turn has advanced to next character.
   * Frontend expects: { locationId, sessionId, currentCharacterId, currentCharacterName, isBot, turnIndex }
   *
   * Used by:
   * - createMessage() - Message created triggered turn advancement (when turn order exists)
   *
   * @param params - Turn advancement parameters
   *
   * @example
   * ```typescript
   * ChatWebSocketService.emitTurnAdvanced({
   *   locationId,
   *   sessionId: session._id.toString(),
   *   currentCharacterId: nextTurn.currentCharacterId,
   *   currentCharacterName: nextTurn.currentCharacterName,
   *   isBot: nextTurn.isBot,
   *   turnIndex: nextTurn.currentTurnIndex
   * });
   * ```
   */
  static emitTurnAdvanced(params: TurnAdvancedParams): void {
    const io = this.getIO();
    if (!io) return;

    const roomName = this.getLocationRoom(params.locationId);
    const payload: TurnAdvancedPayload = {
      locationId: params.locationId,
      sessionId: params.sessionId,
      currentCharacterId: params.currentCharacterId,
      currentCharacterName: params.currentCharacterName,
      isBot: params.isBot,
      turnIndex: params.turnIndex,
    };

    io.to(roomName).emit('turn_advanced', payload);
    this.logEmission('turn_advanced', roomName, payload, params.debug);
  }

  /**
   * DEPRECATED: Emit partial message notification
   *
   * Sends incomplete payload (no full message object) for legacy methods.
   * This method exists only for migration purposes and should NOT be used for new code.
   *
   * WARNING: Frontend expects full message object but this sends only metadata.
   * Migrate to emitMessageCreated() with full EnrichedChatMessage instead.
   *
   * Used by (legacy):
   * - createSocialConflict() - Social conflict created (line 1230)
   * - createBotMessage() - Bot message created (line 1437)
   * - createConfrontationAttack() - Confrontation attack initiated (line 1615)
   * - handleConfrontationReaction() - Confrontation reaction processed (line 1899)
   *
   * @deprecated Use emitMessageCreated() instead with full enriched message
   * @param params - Partial message parameters
   *
   * @example
   * ```typescript
   * // DEPRECATED - Do not use for new code
   * ChatWebSocketService.emitPartialMessageNotification({
   *   locationId,
   *   actionId: savedAction._id,
   *   characterName: character.characterName,
   *   actionType: 'standard',
   *   timestamp: savedAction.timestamp
   * });
   * ```
   */
  static emitPartialMessageNotification(params: PartialMessageParams): void {
    const io = this.getIO();
    if (!io) return;

    const roomName = this.getLocationRoom(params.locationId);
    const payload = {
      locationId: params.locationId,
      actionId: params.actionId,
      characterName: params.characterName,
      actionType: params.actionType,
      timestamp: params.timestamp,
    };

    logger.warn(
      `[ChatWebSocketService] DEPRECATED: emitPartialMessageNotification called for ${params.actionType}. ` +
        `Migrate to emitMessageCreated() with full enriched message.`
    );

    io.to(roomName).emit('location_message_notification', payload);
    this.logEmission('location_message_notification', roomName, payload, params.debug);
  }
}
