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
  EMBEDDING_DOCUMENT_CHUNK_CREATED: 'embedding:document_chunk:created',
  EMBEDDING_CHAT_CREATED: 'embedding:chat:created',
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
 * DocumentChunk embedding event
 * Published when a document chunk is created (H2/H3 section)
 */
export interface DocumentChunkEmbeddingEvent extends BaseEmbeddingEvent {
  chunkId: string;
  documentId: string;
  slug: string;
  title: string;
  content: string;
  documentType: 'ambientazione' | 'approfondimenti' | 'regolamento';  // FIX: Added approfondimenti (seeder uses 3 types)
  order: number;
  headingLevel: 2 | 3;      // H2 (main sections) + H3 (sub-sections)
  parentSlug?: string;       // For H3 chunks, reference to parent H2 slug
}

/**
 * Chat embedding event
 * Published when a chat is created
 */
export interface ChatEmbeddingEvent extends BaseEmbeddingEvent {
  chatId: string;
  characterId: string;
  characterName: string;
  locationId: string;
  content: string;
  actionType: string;
}

/**
 * Union type for all embedding events
 */
export type EmbeddingEvent = DocumentEmbeddingEvent | DocumentChunkEmbeddingEvent | ChatEmbeddingEvent;

/**
 * Helper to check event type
 */
export function isDocumentEmbeddingEvent(event: EmbeddingEvent): event is DocumentEmbeddingEvent {
  return 'documentId' in event && !('chunkId' in event);
}

export function isDocumentChunkEmbeddingEvent(event: EmbeddingEvent): event is DocumentChunkEmbeddingEvent {
  return 'chunkId' in event;
}

export function isChatEmbeddingEvent(event: EmbeddingEvent): event is ChatEmbeddingEvent {
  return 'chatId' in event;
}
