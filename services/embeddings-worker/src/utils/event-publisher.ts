/**
 * Event Publisher Utility
 *
 * Publishes events to Redis for async processing by embedding workers
 */

import { RedisClientType } from 'redis';
import { randomUUID as uuidv4 } from 'crypto';
import {
  REDIS_CHANNELS,
  DocumentEmbeddingEvent,
  ChatEmbeddingEvent
} from '../types/events';
import type { DocumentType } from '../config';

export class EmbeddingEventPublisher {
  private publisher: RedisClientType;

  constructor(redisPublisher: RedisClientType) {
    this.publisher = redisPublisher;
  }

  /**
   * Publish document created/updated event
   */
  async publishDocumentEvent(
    documentId: string,
    title: string,
    content: string,
    type: DocumentType,
    isUpdate: boolean = false
  ): Promise<void> {
    const event: DocumentEmbeddingEvent = {
      eventId: uuidv4(),
      timestamp: new Date(),
      documentId,
      title,
      content,
      type
    };

    const channel = isUpdate
      ? REDIS_CHANNELS.EMBEDDING_DOCUMENT_UPDATED
      : REDIS_CHANNELS.EMBEDDING_DOCUMENT_CREATED;

    await this.publisher.publish(channel, JSON.stringify(event));
  }

  async publishChatEvent(
    chatId: string,
    characterId: string,
    characterName: string,
    locationId: string,
    content: string,
    actionType: string
  ): Promise<void> {
    const event: ChatEmbeddingEvent = {
      eventId: uuidv4(),
      timestamp: new Date(),
      chatId,
      characterId,
      characterName,
      locationId,
      content,
      actionType
    };

    await this.publisher.publish(
      REDIS_CHANNELS.EMBEDDING_CHAT_CREATED,
      JSON.stringify(event)
    );
  }

  /**
   * Bulk publish events (for seeding)
   */
  async publishDocumentEventsBatch(
    documents: Array<{
      documentId: string;
      title: string;
      content: string;
      type: DocumentType;
    }>
  ): Promise<void> {
    const pipeline = this.publisher.multi();

    for (const doc of documents) {
      const event: DocumentEmbeddingEvent = {
        eventId: uuidv4(),
        timestamp: new Date(),
        documentId: doc.documentId,
        title: doc.title,
        content: doc.content,
        type: doc.type
      };

      pipeline.publish(
        REDIS_CHANNELS.EMBEDDING_DOCUMENT_CREATED,
        JSON.stringify(event)
      );
    }

    await pipeline.exec();
  }
}
