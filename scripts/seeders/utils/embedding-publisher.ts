/**
 * Embedding Event Publisher for Seeders
 *
 * Simplified version of unified-backend/src/modules/game/utils/events/embedding-publisher.ts
 * Only includes publishDocumentChunkEvent() method (seeder doesn't need document/location actions)
 *
 * Publishes events to Redis for async processing by embedding workers
 */

import { RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import {
  REDIS_CHANNELS,
  DocumentChunkEmbeddingEvent,
} from './embedding-events.js';

export class EmbeddingSeederPublisher {
  private publisher: RedisClientType;

  constructor(redisPublisher: RedisClientType) {
    this.publisher = redisPublisher;
  }

  /**
   * Publish document chunk created event
   * Worker will generate embedding and update MongoDB + Qdrant
   */
  async publishDocumentChunkEvent(
    chunkId: string,
    documentId: string,
    slug: string,
    title: string,
    content: string,
    documentType: 'ambientazione' | 'approfondimenti' | 'regolamento',
    order: number,
    headingLevel: 2 | 3,
    parentSlug?: string
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
      headingLevel,
      parentSlug
    };

    await this.publisher.publish(
      REDIS_CHANNELS.EMBEDDING_DOCUMENT_CHUNK_CREATED,
      JSON.stringify(event)
    );

    console.log(`   [Event] Published embedding event for: ${title}`);
  }
}
