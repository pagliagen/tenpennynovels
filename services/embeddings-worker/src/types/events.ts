/**
 * Redis Event Types for Async Embedding Generation
 *
 * This file defines the event types published to Redis when new content
 * needs embedding generation. Workers subscribe to these events and process
 * embeddings asynchronously without blocking the main API response.
 */

import type { DocumentType } from '../config';

export const REDIS_CHANNELS = {
  // Document events (triggers chunking + embeddings)
  EMBEDDING_DOCUMENT_CREATED: 'embedding:document:created',
  EMBEDDING_DOCUMENT_UPDATED: 'embedding:document:updated',
  EMBEDDING_DOCUMENT_DELETED: 'embedding:document:deleted',

  // Document chunk events (legacy - deprecated, handled by Document events)
  EMBEDDING_DOCUMENT_CHUNK_CREATED: 'embedding:document_chunk:created',

  // Chat events (no chunking)
  EMBEDDING_CHAT_CREATED: 'embedding:chat:created',
  EMBEDDING_CHAT_UPDATED: 'embedding:chat:updated',
  EMBEDDING_CHAT_DELETED: 'embedding:chat:deleted',

  // Forum post events (no chunking)
  EMBEDDING_FORUM_POST_CREATED: 'embedding:forum_post:created',
  EMBEDDING_FORUM_POST_UPDATED: 'embedding:forum_post:updated',
  EMBEDDING_FORUM_POST_DELETED: 'embedding:forum_post:deleted',

  // Mail moderation events (OnGame and OffGame)
  EMBEDDING_ONGAME_MESSAGE_CREATED: 'embedding:ongame_message:created',
  EMBEDDING_OFFGAME_MESSAGE_CREATED: 'embedding:offgame_message:created',
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
  type: DocumentType;
}

export interface DocumentChunkEmbeddingEvent extends BaseEmbeddingEvent {
  chunkId: string;
  documentId: string;
  slug: string;
  title: string;
  content: string;
  documentType: DocumentType;
  order: number;
  headingLevel: 2 | 3;
  parentSlug?: string;
}

export interface ChatEmbeddingEvent extends BaseEmbeddingEvent {
  chatId: string;
  characterId: string;
  characterName: string;
  locationId: string;
  content: string;
  actionType: string;
}

export interface ForumPostEmbeddingEvent extends BaseEmbeddingEvent {
  postId: string;
  content: string;
  topicSlug: string;
  discussionSlug: string;
  authorCharacterId: string;
  authorCharacterName: string;
}

export interface OnGameMessageModerationEvent extends BaseEmbeddingEvent {
  messageId: string;
  threadId: string;
  senderId: string;
  recipientId: string;
  messageType: string;
  subject: string;
  content: string;
}

export interface OffGameMessageModerationEvent extends BaseEmbeddingEvent {
  messageId: string;
  threadId: string;
  senderId: string;
  content: string;
}

export interface DeleteEmbeddingEvent extends BaseEmbeddingEvent {
  entityType: 'document' | 'chat' | 'forum_post';
  entityId: string;
}

export type EmbeddingEvent =
  | DocumentEmbeddingEvent
  | DocumentChunkEmbeddingEvent
  | ChatEmbeddingEvent
  | ForumPostEmbeddingEvent
  | OnGameMessageModerationEvent
  | OffGameMessageModerationEvent
  | DeleteEmbeddingEvent;

export function isDocumentEmbeddingEvent(event: EmbeddingEvent): event is DocumentEmbeddingEvent {
  return 'documentId' in event && !('chunkId' in event) && !('entityType' in event);
}

export function isDocumentChunkEmbeddingEvent(event: EmbeddingEvent): event is DocumentChunkEmbeddingEvent {
  return 'chunkId' in event;
}

export function isChatEmbeddingEvent(event: EmbeddingEvent): event is ChatEmbeddingEvent {
  return 'chatId' in event;
}

export function isForumPostEmbeddingEvent(data: unknown): data is ForumPostEmbeddingEvent {
  return typeof data === 'object' && data !== null && 'postId' in data && 'topicSlug' in data && 'discussionSlug' in data;
}

export function isOnGameMessageModerationEvent(event: EmbeddingEvent): event is OnGameMessageModerationEvent {
  return 'messageId' in event && 'messageType' in event && 'subject' in event && 'recipientId' in event;
}

export function isOffGameMessageModerationEvent(event: EmbeddingEvent): event is OffGameMessageModerationEvent {
  return 'messageId' in event && 'threadId' in event && !('messageType' in event) && !('recipientId' in event);
}

export function isDeleteEmbeddingEvent(event: EmbeddingEvent): event is DeleteEmbeddingEvent {
  return 'entityType' in event && 'entityId' in event;
}
