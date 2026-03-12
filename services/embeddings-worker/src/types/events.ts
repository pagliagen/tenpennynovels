/**
 * Redis Event Types for Async Embedding Generation
 *
 * This file defines the event types published to Redis when new content
 * needs embedding generation. Workers subscribe to these events and process
 * embeddings asynchronously without blocking the main API response.
 */

export const REDIS_CHANNELS = {
  // Document events (triggers chunking + embeddings)
  EMBEDDING_DOCUMENT_CREATED: 'embedding:document:created',
  EMBEDDING_DOCUMENT_UPDATED: 'embedding:document:updated',
  EMBEDDING_DOCUMENT_DELETED: 'embedding:document:deleted',

  // Document chunk events (legacy - deprecated, handled by Document events)
  EMBEDDING_DOCUMENT_CHUNK_CREATED: 'embedding:document_chunk:created',

  // Location events (no chunking)
  EMBEDDING_LOCATION_CREATED: 'embedding:location:created',
  EMBEDDING_LOCATION_UPDATED: 'embedding:location:updated',
  EMBEDDING_LOCATION_DELETED: 'embedding:location:deleted',

  // Chat events (no chunking)
  EMBEDDING_CHAT_CREATED: 'embedding:chat:created',
  EMBEDDING_CHAT_UPDATED: 'embedding:chat:updated',
  EMBEDDING_CHAT_DELETED: 'embedding:chat:deleted',
} as const;

export type RedisChannel = typeof REDIS_CHANNELS[keyof typeof REDIS_CHANNELS];

export interface BaseEmbeddingEvent {
  eventId: string;
  timestamp: Date;
  retryCount?: number;
}

export interface DocumentEmbeddingEvent extends BaseEmbeddingEvent {
  documentId: string;
  title: string;
  content: string;
  contentDelta?: any;
  type: 'ambientazione' | 'approfondimenti' | 'regolamento';
}

export interface DocumentChunkEmbeddingEvent extends BaseEmbeddingEvent {
  chunkId: string;
  documentId: string;
  slug: string;
  title: string;
  content: string;
  documentType: 'ambientazione' | 'approfondimenti' | 'regolamento';
  order: number;
  headingLevel: 2 | 3;
  parentSlug?: string;
}

export interface LocationEmbeddingEvent extends BaseEmbeddingEvent {
  locationId: string;
  name: string;
  description: string;
  district: string;
  slug: string;
}

export interface ChatEmbeddingEvent extends BaseEmbeddingEvent {
  chatId: string;
  characterId: string;
  characterName: string;
  locationId: string;
  content: string;
  actionType: string;
}

export interface DeleteEmbeddingEvent extends BaseEmbeddingEvent {
  entityType: 'document' | 'location' | 'chat';
  entityId: string;
}

export type EmbeddingEvent =
  | DocumentEmbeddingEvent
  | DocumentChunkEmbeddingEvent
  | LocationEmbeddingEvent
  | ChatEmbeddingEvent
  | DeleteEmbeddingEvent;

export function isDocumentEmbeddingEvent(event: EmbeddingEvent): event is DocumentEmbeddingEvent {
  return 'documentId' in event && !('chunkId' in event) && !('entityType' in event);
}

export function isDocumentChunkEmbeddingEvent(event: EmbeddingEvent): event is DocumentChunkEmbeddingEvent {
  return 'chunkId' in event;
}

export function isLocationEmbeddingEvent(event: EmbeddingEvent): event is LocationEmbeddingEvent {
  return 'locationId' in event && !('chatId' in event) && !('entityType' in event);
}

export function isChatEmbeddingEvent(event: EmbeddingEvent): event is ChatEmbeddingEvent {
  return 'chatId' in event;
}

export function isDeleteEmbeddingEvent(event: EmbeddingEvent): event is DeleteEmbeddingEvent {
  return 'entityType' in event && 'entityId' in event;
}
