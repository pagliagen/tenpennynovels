/**
 * Embedding Worker
 *
 * Subscribes to Redis events and generates embeddings asynchronously
 * for Documents and LocationActions without blocking API responses
 */

import type { RedisClientType } from 'redis';
import mongoose from 'mongoose';
import {
  REDIS_CHANNELS,
  DocumentEmbeddingEvent,
  LocationActionEmbeddingEvent,
  isDocumentEmbeddingEvent,
  isLocationActionEmbeddingEvent
} from '../types/events';

const EMBEDDINGS_SERVICE_URL = process.env.EMBEDDINGS_SERVICE_URL || 'http://127.0.0.1:5001';
const EMBEDDING_MODEL = 'paraphrase-multilingual-MiniLM-L12-v2';

export class EmbeddingWorker {
  private subscriber: any; // Use any to avoid Redis type version conflicts
  private isRunning: boolean = false;

  constructor(redisSubscriber: any) {
    this.subscriber = redisSubscriber;
  }

  /**
   * Start listening to embedding events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️  Worker already running');
      return;
    }

    console.log('🚀 Starting Embedding Worker...');
    this.isRunning = true;

    // Subscribe to all embedding channels
    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_DOCUMENT_CREATED,
      (message: string) => this.handleDocumentEvent(message, false)
    );

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_DOCUMENT_UPDATED,
      (message: string) => this.handleDocumentEvent(message, true)
    );

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_LOCATION_ACTION_CREATED,
      (message: string) => this.handleLocationActionEvent(message)
    );

    console.log('✅ Embedding Worker started');
    console.log(`   Listening to channels:`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_DOCUMENT_CREATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_DOCUMENT_UPDATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_LOCATION_ACTION_CREATED}`);
  }

  /**
   * Stop listening to events
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping Embedding Worker...');
    await this.subscriber.unsubscribe();
    this.isRunning = false;
    console.log('✅ Embedding Worker stopped');
  }

  /**
   * Handle document embedding event
   */
  private async handleDocumentEvent(message: string, isUpdate: boolean): Promise<void> {
    try {
      const event: DocumentEmbeddingEvent = JSON.parse(message);
      console.log(`📄 Processing document embedding: ${event.title} (${event.documentId})`);

      // Generate embedding
      const text = `${event.title}\n\n${event.content}`;
      const truncatedText = text.length > 2000 ? text.substring(0, 2000) : text;

      const embedding = await this.generateEmbedding(truncatedText);

      if (!embedding) {
        console.error(`❌ Failed to generate embedding for document ${event.documentId}`);
        return;
      }

      // Update document with embedding
      const Document = mongoose.model('Document');
      await Document.findByIdAndUpdate(event.documentId, {
        contentEmbedding: embedding,
        embeddingModel: EMBEDDING_MODEL,
        embeddingGeneratedAt: new Date()
      });

      console.log(`✅ Document embedding saved: ${event.title}`);

    } catch (error) {
      console.error('❌ Error processing document embedding event:', error);
    }
  }

  /**
   * Handle location action embedding event
   */
  private async handleLocationActionEvent(message: string): Promise<void> {
    try {
      const event: LocationActionEmbeddingEvent = JSON.parse(message);
      console.log(`🎭 Processing location action embedding: ${event.locationActionId}`);

      // Get location name
      const Location = mongoose.model('Location');
      const location = await Location.findById(event.locationId).select('name').lean() as any;

      if (!location) {
        console.error(`❌ Location not found: ${event.locationId}`);
        return;
      }

      // Generate embedding with context: "CharacterName a LocationName: content"
      const locationName = location.name as string;
      const text = `${event.characterName} a ${locationName}: ${event.content}`;
      const embedding = await this.generateEmbedding(text);

      if (!embedding) {
        console.error(`❌ Failed to generate embedding for location action ${event.locationActionId}`);
        return;
      }

      // Update location action with embedding using native MongoDB
      const db = mongoose.connection.db;
      if (!db) {
        console.error('❌ Database connection not available');
        return;
      }

      const result = await db.collection('locationactions').updateOne(
        { _id: new mongoose.Types.ObjectId(event.locationActionId) },
        {
          $set: {
            locationName: locationName,
            contentEmbedding: embedding,
            embeddingModel: EMBEDDING_MODEL,
            embeddingGeneratedAt: new Date()
          }
        }
      );

      if (result.matchedCount === 0) {
        console.error(`❌ LocationAction not found for update: ${event.locationActionId}`);
        return;
      }

      if (result.modifiedCount === 0) {
        console.warn(`⚠️  LocationAction found but not modified: ${event.locationActionId}`);
      }

      console.log(`✅ Location action embedding saved: ${event.characterName} @ ${locationName} (modified: ${result.modifiedCount})`);

    } catch (error) {
      console.error('❌ Error processing location action embedding event:', error);
    }
  }

  /**
   * Generate embedding via HTTP service
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        console.error(`Embeddings service error: ${response.status}`);
        return null;
      }

      const result = await response.json() as { success: boolean; embedding?: number[] };
      return result.success && result.embedding ? result.embedding : null;

    } catch (error) {
      console.error('Error calling embeddings service:', error);
      return null;
    }
  }
}
