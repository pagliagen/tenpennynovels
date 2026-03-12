/**
 * Embedding Event Publisher
 *
 * Centralizes Redis event publishing for embeddings.
 * Used by Mongoose model hooks to automatically trigger embedding generation.
 */

import { redis } from '../../config/runtime/redis';
import { logger } from '@shared/utils/logger';
import crypto from 'crypto';

export const REDIS_CHANNELS = {
  // Document events (triggers chunking + embeddings)
  EMBEDDING_DOCUMENT_CREATED: 'embedding:document:created',
  EMBEDDING_DOCUMENT_UPDATED: 'embedding:document:updated',
  EMBEDDING_DOCUMENT_DELETED: 'embedding:document:deleted',

  // Location events (no chunking)
  EMBEDDING_LOCATION_CREATED: 'embedding:location:created',
  EMBEDDING_LOCATION_UPDATED: 'embedding:location:updated',
  EMBEDDING_LOCATION_DELETED: 'embedding:location:deleted',

  // Chat events (no chunking)
  EMBEDDING_CHAT_CREATED: 'embedding:chat:created',
  EMBEDDING_CHAT_UPDATED: 'embedding:chat:updated',
  EMBEDDING_CHAT_DELETED: 'embedding:chat:deleted',
} as const;

/**
 * Publish document created/updated event
 * Triggers chunking + embedding generation in embeddings-worker
 */
export async function publishDocumentEvent(
  action: 'created' | 'updated',
  document: {
    _id: string;
    title: string;
    content: string;
    type: 'ambientazione' | 'approfondimenti' | 'regolamento';
  }
): Promise<void> {
  try {
    const channel = action === 'created'
      ? REDIS_CHANNELS.EMBEDDING_DOCUMENT_CREATED
      : REDIS_CHANNELS.EMBEDDING_DOCUMENT_UPDATED;

    const event = {
      eventId: crypto.randomUUID(),
      timestamp: new Date(),
      documentId: document._id.toString(),
      title: document.title,
      content: document.content,
      type: document.type
    };

    await redis.publish(channel, JSON.stringify(event));
    logger.debug(`[EmbeddingEvent] Document ${action}: ${document.title}`);
  } catch (error: any) {
    logger.error(`[EmbeddingEvent] Failed to publish document ${action}:`, error);
  }
}

/**
 * Publish document deleted event
 * Triggers cleanup of chunks + embeddings in embeddings-worker
 */
export async function publishDocumentDeletedEvent(documentId: string): Promise<void> {
  try {
    const event = {
      eventId: crypto.randomUUID(),
      timestamp: new Date(),
      entityType: 'document' as const,
      entityId: documentId
    };

    await redis.publish(REDIS_CHANNELS.EMBEDDING_DOCUMENT_DELETED, JSON.stringify(event));
    logger.debug(`[EmbeddingEvent] Document deleted: ${documentId}`);
  } catch (error: any) {
    logger.error('[EmbeddingEvent] Failed to publish document deleted:', error);
  }
}

/**
 * Publish location created/updated event
 */
export async function publishLocationEvent(
  action: 'created' | 'updated',
  location: {
    _id: string;
    name: string;
    description: string;
    district: string;
    slug: string;
  }
): Promise<void> {
  try {
    const channel = action === 'created'
      ? REDIS_CHANNELS.EMBEDDING_LOCATION_CREATED
      : REDIS_CHANNELS.EMBEDDING_LOCATION_UPDATED;

    const event = {
      eventId: crypto.randomUUID(),
      timestamp: new Date(),
      locationId: location._id.toString(),
      name: location.name,
      description: location.description,
      district: location.district,
      slug: location.slug
    };

    await redis.publish(channel, JSON.stringify(event));
    logger.debug(`[EmbeddingEvent] Location ${action}: ${location.name}`);
  } catch (error: any) {
    logger.error(`[EmbeddingEvent] Failed to publish location ${action}:`, error);
  }
}

/**
 * Publish location deleted event
 */
export async function publishLocationDeletedEvent(locationId: string): Promise<void> {
  try {
    const event = {
      eventId: crypto.randomUUID(),
      timestamp: new Date(),
      entityType: 'location' as const,
      entityId: locationId
    };

    await redis.publish(REDIS_CHANNELS.EMBEDDING_LOCATION_DELETED, JSON.stringify(event));
    logger.debug(`[EmbeddingEvent] Location deleted: ${locationId}`);
  } catch (error: any) {
    logger.error('[EmbeddingEvent] Failed to publish location deleted:', error);
  }
}

/**
 * Publish chat created/updated event
 */
export async function publishChatEvent(
  action: 'created' | 'updated',
  chat: {
    _id: string;
    characterId: string;
    characterName: string;
    locationId: string;
    content: string;
    actionType: string;
  }
): Promise<void> {
  try {
    const channel = action === 'created'
      ? REDIS_CHANNELS.EMBEDDING_CHAT_CREATED
      : REDIS_CHANNELS.EMBEDDING_CHAT_UPDATED;

    const event = {
      eventId: crypto.randomUUID(),
      timestamp: new Date(),
      chatId: chat._id.toString(),
      characterId: chat.characterId,
      characterName: chat.characterName,
      locationId: chat.locationId,
      content: chat.content,
      actionType: chat.actionType
    };

    await redis.publish(channel, JSON.stringify(event));
    logger.debug(`[EmbeddingEvent] Chat ${action}: ${chat._id}`);
  } catch (error: any) {
    logger.error(`[EmbeddingEvent] Failed to publish chat ${action}:`, error);
  }
}

/**
 * Publish chat deleted event
 */
export async function publishChatDeletedEvent(chatId: string): Promise<void> {
  try {
    const event = {
      eventId: crypto.randomUUID(),
      timestamp: new Date(),
      entityType: 'chat' as const,
      entityId: chatId
    };

    await redis.publish(REDIS_CHANNELS.EMBEDDING_CHAT_DELETED, JSON.stringify(event));
    logger.debug(`[EmbeddingEvent] Chat deleted: ${chatId}`);
  } catch (error: any) {
    logger.error('[EmbeddingEvent] Failed to publish chat deleted:', error);
  }
}
