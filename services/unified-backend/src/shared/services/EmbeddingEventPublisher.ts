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

  // Location action events (no chunking)
  EMBEDDING_LOCATION_ACTION_CREATED: 'embedding:location_action:created',
  EMBEDDING_LOCATION_ACTION_UPDATED: 'embedding:location_action:updated',
  EMBEDDING_LOCATION_ACTION_DELETED: 'embedding:location_action:deleted',
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
 * Publish location action created/updated event
 */
export async function publishLocationActionEvent(
  action: 'created' | 'updated',
  locationAction: {
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
      ? REDIS_CHANNELS.EMBEDDING_LOCATION_ACTION_CREATED
      : REDIS_CHANNELS.EMBEDDING_LOCATION_ACTION_UPDATED;

    const event = {
      eventId: crypto.randomUUID(),
      timestamp: new Date(),
      locationActionId: locationAction._id.toString(),
      characterId: locationAction.characterId,
      characterName: locationAction.characterName,
      locationId: locationAction.locationId,
      content: locationAction.content,
      actionType: locationAction.actionType
    };

    await redis.publish(channel, JSON.stringify(event));
    logger.debug(`[EmbeddingEvent] LocationAction ${action}: ${locationAction._id}`);
  } catch (error: any) {
    logger.error(`[EmbeddingEvent] Failed to publish location action ${action}:`, error);
  }
}

/**
 * Publish location action deleted event
 */
export async function publishLocationActionDeletedEvent(locationActionId: string): Promise<void> {
  try {
    const event = {
      eventId: crypto.randomUUID(),
      timestamp: new Date(),
      entityType: 'location_action' as const,
      entityId: locationActionId
    };

    await redis.publish(REDIS_CHANNELS.EMBEDDING_LOCATION_ACTION_DELETED, JSON.stringify(event));
    logger.debug(`[EmbeddingEvent] LocationAction deleted: ${locationActionId}`);
  } catch (error: any) {
    logger.error('[EmbeddingEvent] Failed to publish location action deleted:', error);
  }
}
