/**
 * ChatWebSocketService Type Definitions
 *
 * TypeScript interfaces for WebSocket emission parameters and payloads.
 * Ensures type-safe WebSocket events for chat-related operations.
 *
 * @module services/ChatWebSocketService.types
 * @since 2.3.0
 */

import type { EnrichedChatMessage } from '../transformers/types';

/**
 * Base parameters for all WebSocket emissions
 */
interface BaseEmissionParams {
  /** Location ID (room target) */
  locationId: string;
  /** Enable client count logging (debug mode) */
  debug?: boolean;
}

/**
 * Message created/updated emission parameters
 *
 * Used by: emitMessageCreated(), emitMessageUpdated()
 */
export interface MessageCreatedParams extends BaseEmissionParams {
  /** Full enriched message object */
  message: EnrichedChatMessage;
  /** Location name (optional metadata) */
  locationName?: string;
  /** Location slug (optional metadata for URLs) */
  locationSlug?: string | null;
}

/**
 * Message notification payload (what frontend receives)
 *
 * Frontend expects this structure in location_message_notification event
 */
export interface MessageNotificationPayload {
  /** Full enriched message object */
  message: EnrichedChatMessage;
  /** Location ID */
  locationId: string;
  /** Location name (optional) */
  locationName?: string;
  /** Location slug (optional) */
  locationSlug?: string | null;
}

/**
 * Message deleted emission parameters
 *
 * Used by: emitMessageDeleted()
 */
export interface MessageDeletedParams extends BaseEmissionParams {
  /** Message ID to delete */
  actionId: string;
}

/**
 * Message deleted payload (what frontend receives)
 *
 * Frontend expects this structure in location_action_deleted event
 */
export interface MessageDeletedPayload {
  /** Location ID */
  locationId: string;
  /** Message ID that was deleted */
  actionId: string;
}

/**
 * Chat cleared emission parameters
 *
 * Used by: emitChatCleared()
 */
export interface ChatClearedParams extends BaseEmissionParams {
  /** Character name who cleared the chat */
  clearedBy: string;
}

/**
 * Chat cleared payload (what frontend receives)
 *
 * Frontend expects this structure in location_chat_cleared event
 */
export interface ChatClearedPayload {
  /** Location ID */
  locationId: string;
  /** Character name who cleared the chat */
  clearedBy: string;
}

/**
 * Turn advanced emission parameters
 *
 * Used by: emitTurnAdvanced()
 */
export interface TurnAdvancedParams extends BaseEmissionParams {
  /** Gaming session ID */
  sessionId: string;
  /** Character ID whose turn it is now */
  currentCharacterId: string;
  /** Character name whose turn it is now */
  currentCharacterName: string;
  /** Whether current turn belongs to a bot */
  isBot: boolean;
  /** Turn index in the turn order */
  turnIndex: number;
}

/**
 * Turn advanced payload (what frontend receives)
 *
 * Frontend expects this structure in turn_advanced event
 */
export interface TurnAdvancedPayload {
  /** Location ID */
  locationId: string;
  /** Gaming session ID */
  sessionId: string;
  /** Character ID whose turn it is now */
  currentCharacterId: string;
  /** Character name whose turn it is now */
  currentCharacterName: string;
  /** Whether current turn belongs to a bot */
  isBot: boolean;
  /** Turn index in the turn order */
  turnIndex: number;
}

/**
 * DEPRECATED: Partial message notification parameters
 *
 * Used by: emitPartialMessageNotification()
 *
 * WARNING: This sends incomplete payload (no full message object).
 * Should be migrated to emitMessageCreated() with full EnrichedChatMessage.
 *
 * @deprecated Use MessageCreatedParams instead
 */
export interface PartialMessageParams extends BaseEmissionParams {
  /** Action/Message ID */
  actionId: string;
  /** Character name */
  characterName: string;
  /** Action type */
  actionType: string;
  /** Timestamp */
  timestamp: Date;
}
