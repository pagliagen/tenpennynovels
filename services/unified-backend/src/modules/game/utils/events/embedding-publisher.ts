/**
 * Event Publisher Utility
 *
 * Publishes events to Redis for async processing by embedding workers
 */

import { RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import {
  REDIS_CHANNELS,
  DocumentEmbeddingEvent,
  DocumentChunkEmbeddingEvent,
  ChatEmbeddingEvent
} from '../../types/embedding-events';

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
    type: 'ambientazione' | 'regolamento' | 'lore',
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

  /**
   * Publish document chunk created event
   */
  async publishDocumentChunkEvent(
    chunkId: string,
    documentId: string,
    slug: string,
    title: string,
    content: string,
    documentType: 'ambientazione' | 'approfondimenti' | 'regolamento',
    order: number,
    headingLevel: 2 | 3,      // NEW: H2 (main sections) + H3 (sub-sections)
    parentSlug?: string        // NEW: for H3 chunks, reference to parent H2 slug
  ): Promise<void> {
    const event: DocumentChunkEmbeddingEvent = {
      eventId: uuidv4(),
      timestamp: new Date(),
      chunkId,
      documentId,
      slug,
      title,
      content,
      documentType,
      order,
      headingLevel,             // NEW
      parentSlug                // NEW
    };

    await this.publisher.publish(
      REDIS_CHANNELS.EMBEDDING_DOCUMENT_CHUNK_CREATED,
      JSON.stringify(event)
    );
  }

  /**
   * Publish chat created event
   */
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
      type: 'ambientazione' | 'regolamento' | 'lore';
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
