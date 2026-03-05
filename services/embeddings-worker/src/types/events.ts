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

  // Location action events (no chunking)
  EMBEDDING_LOCATION_ACTION_CREATED: 'embedding:location_action:created',
  EMBEDDING_LOCATION_ACTION_UPDATED: 'embedding:location_action:updated',
  EMBEDDING_LOCATION_ACTION_DELETED: 'embedding:location_action:deleted',
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
  contentDelta?: any; // TipTap Delta JSON for chunking
  type: 'ambientazione' | 'approfondimenti' | 'regolamento';
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
 * Location embedding event
 * Published when a location is created/updated/deleted
 */
export interface LocationEmbeddingEvent extends BaseEmbeddingEvent {
  locationId: string;
  name: string;
  description: string;
  district: string;
  slug: string;
}

/**
 * LocationAction embedding event
 * Published when a location action is created/updated/deleted
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
 * Delete event (for Document, Location, LocationAction)
 * Published when content is deleted - removes from Qdrant + ElasticSearch
 */
export interface DeleteEmbeddingEvent extends BaseEmbeddingEvent {
  entityType: 'document' | 'location' | 'location_action';
  entityId: string; // documentId, locationId, or locationActionId
}

/**
 * Union type for all embedding events
 */
export type EmbeddingEvent =
  | DocumentEmbeddingEvent
  | DocumentChunkEmbeddingEvent
  | LocationEmbeddingEvent
  | LocationActionEmbeddingEvent
  | DeleteEmbeddingEvent;

/**
 * Helper to check event type
 */
export function isDocumentEmbeddingEvent(event: EmbeddingEvent): event is DocumentEmbeddingEvent {
  return 'documentId' in event && !('chunkId' in event) && !('entityType' in event);
}

export function isDocumentChunkEmbeddingEvent(event: EmbeddingEvent): event is DocumentChunkEmbeddingEvent {
  return 'chunkId' in event;
}

export function isLocationEmbeddingEvent(event: EmbeddingEvent): event is LocationEmbeddingEvent {
  return 'locationId' in event && !('locationActionId' in event) && !('entityType' in event);
}

export function isLocationActionEmbeddingEvent(event: EmbeddingEvent): event is LocationActionEmbeddingEvent {
  return 'locationActionId' in event;
}

export function isDeleteEmbeddingEvent(event: EmbeddingEvent): event is DeleteEmbeddingEvent {
  return 'entityType' in event && 'entityId' in event;
}
