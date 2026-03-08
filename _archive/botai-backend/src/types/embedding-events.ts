/**
 * Redis Event Types for Async Embedding Generation
 *
 * This file defines the event types published to Redis when new content
 * needs embedding generation. Workers subscribe to these events and process
 * embeddings asynchronously without blocking the main API response.
 */

export const REDIS_CHANNELS = {
  EMBEDDING_DOCUMENT_CREATED: 'embedding:document:created',
  EMBEDDING_DOCUMENT_UPDATED: 'embedding:document:updated',
  EMBEDDING_LOCATION_ACTION_CREATED: 'embedding:location_action:created',
  EMBEDDING_BOT_MEMORY_CREATED: 'embedding:bot_memory:created',
} as const;

export type RedisChannel = typeof REDIS_CHANNELS[keyof typeof REDIS_CHANNELS];

/**
 * Base event interface
 */
export interface BaseEmbeddingEvent {
  eventId: string; // Unique event ID for tracking/deduplication
  timestamp: Date;
  retryCount?: number; // For retry logic
}

/**
 * Document embedding event
 * Published when a document is created or updated
 */
export interface DocumentEmbeddingEvent extends BaseEmbeddingEvent {
  documentId: string;
  title: string;
  content: string;
  type: 'ambientazione' | 'regolamento' | 'lore';
}

/**
 * LocationAction embedding event
 * Published when a location action is created
 */
export interface LocationActionEmbeddingEvent extends BaseEmbeddingEvent {
  locationActionId: string;
  characterId: string;
  characterName: string;
  locationId: string;
  content: string;
  actionType: string;
}

/**
 * BotMemory embedding event
 * Published when a bot memory is created
 */
export interface BotMemoryEmbeddingEvent extends BaseEmbeddingEvent {
  memoryId: string;
  botId: string;
  locationId: string;
  content: string;
  participants: string[];
  type: 'conversation' | 'event' | 'observation';
}

/**
 * Union type for all embedding events
 */
export type EmbeddingEvent = DocumentEmbeddingEvent | LocationActionEmbeddingEvent | BotMemoryEmbeddingEvent;

/**
 * Helper to check event type
 */
export function isDocumentEmbeddingEvent(event: EmbeddingEvent): event is DocumentEmbeddingEvent {
  return 'documentId' in event;
}

export function isLocationActionEmbeddingEvent(event: EmbeddingEvent): event is LocationActionEmbeddingEvent {
  return 'locationActionId' in event;
}

export function isBotMemoryEmbeddingEvent(event: EmbeddingEvent): event is BotMemoryEmbeddingEvent {
  return 'memoryId' in event;
}
