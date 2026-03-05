/**
 * Embedding Worker with Bull Queue
 *
 * Subscribes to Redis events and processes embeddings asynchronously
 * with retry queue, caching, and concurrency control
 */

import type { RedisClientType } from 'redis';
import { createClient } from 'redis';
import mongoose from 'mongoose';
import Bull from 'bull';
import crypto from 'crypto';
import { QdrantClient } from '@qdrant/js-client-rest';
import {
  REDIS_CHANNELS,
  DocumentEmbeddingEvent,
  DocumentChunkEmbeddingEvent,
  LocationActionEmbeddingEvent,
  isDocumentEmbeddingEvent,
  isDocumentChunkEmbeddingEvent,
  isLocationActionEmbeddingEvent
} from '../types/events';
import { PythonEmbeddingService } from '../services/PythonEmbeddingService';
import { DLQService } from '../services/DLQService';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const EMBEDDING_MODEL = 'paraphrase-multilingual-MiniLM-L12-v2';
const CACHE_TTL = 3600; // 1 hour

export class EmbeddingWorker {
  private subscriber: any; // Redis subscriber
  private redis: any; // Redis client for caching
  private qdrant: QdrantClient; // Qdrant vector DB client
  private queue: Bull.Queue;
  private pythonService: PythonEmbeddingService; // Python subprocess for embeddings
  private isRunning: boolean = false;

  constructor(redisSubscriber: any, pythonService: PythonEmbeddingService) {
    this.subscriber = redisSubscriber;
    this.pythonService = pythonService;

    // ✅ Initialize Qdrant client
    this.qdrant = new QdrantClient({ url: QDRANT_URL });

    // ✅ Bull queue with retry
    this.queue = new Bull('embeddings', {
      redis: REDIS_URL,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: false    // DON'T auto-remove failed jobs - use DLQ
      }
    });

    // ✅ Process queue with concurrency 5
    this.queue.process(5, async (job) => {
      return this.processEmbedding(job.data);
    });

    // Queue event listeners
    this.queue.on('completed', (job, result) => {
      console.log(`✅ Job ${job.id} completed`);
    });

    // Failed job handler → DLQ
    this.queue.on('failed', async (job, err) => {
      console.error(`❌ Job ${job.id} failed after ${job.attemptsMade} attempts:`, err.message);

      // After max attempts, move to DLQ
      if (job.attemptsMade >= 3) {
        const eventType = this.detectEventType(job.data);
        const retryable = !this.isPermanentError(err);

        await DLQService.addFailedJob(
          job.id as string,
          eventType,
          job.data,
          err.message,
          job.attemptsMade,
          retryable
        );

        // Now safe to remove from Bull queue
        await job.remove();
      }
    });

    // Initialize Redis client for caching
    this.initRedisCache();
  }

  /**
   * Initialize Redis cache client
   */
  private async initRedisCache(): Promise<void> {
    try {
      this.redis = createClient({ url: REDIS_URL });
      this.redis.on('error', (err: Error) => {
        console.error('Redis Cache Error:', err);
      });
      await this.redis.connect();
      console.log('✅ Redis cache client connected');
    } catch (error) {
      console.error('❌ Redis cache initialization failed:', error);
    }
  }

  /**
   * Start listening to embedding events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️  Worker already running');
      return;
    }

    console.log('🚀 Starting Embedding Worker with Bull Queue...');
    this.isRunning = true;

    // Subscribe to all embedding channels
    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_DOCUMENT_CREATED,
      (message: string) => {
        const event = JSON.parse(message);
        // ✅ Add to queue instead of processing immediately
        this.queue.add(event, {
          jobId: `doc-${event.documentId}-${Date.now()}` // Unique job ID
        });
        console.log(`📄 Queued document embedding: ${event.title}`);
      }
    );

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_DOCUMENT_UPDATED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add(event, {
          jobId: `doc-upd-${event.documentId}-${Date.now()}`
        });
        console.log(`📄 Queued document update: ${event.title}`);
      }
    );

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_DOCUMENT_CHUNK_CREATED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add(event, {
          jobId: `chunk-${event.chunkId}-${Date.now()}`
        });
        console.log(`📑 Queued document chunk: ${event.title} (#${event.slug})`);
      }
    );

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_LOCATION_ACTION_CREATED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add(event, {
          jobId: `loc-${event.locationActionId}-${Date.now()}`
        });
        console.log(`🎭 Queued location action: ${event.characterName}`);
      }
    );

    console.log('✅ Embedding Worker started with concurrency 5');
    console.log(`   Listening to channels:`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_DOCUMENT_CREATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_DOCUMENT_UPDATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_DOCUMENT_CHUNK_CREATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_LOCATION_ACTION_CREATED}`);
  }

  /**
   * Stop listening to events and close queue
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping Embedding Worker...');
    await this.subscriber.unsubscribe();
    await this.queue.close();
    if (this.redis) {
      await this.redis.disconnect();
    }
    this.isRunning = false;
    console.log('✅ Embedding Worker stopped');
  }

  /**
   * Process embedding event (called by Bull queue)
   */
  private async processEmbedding(event: DocumentEmbeddingEvent | DocumentChunkEmbeddingEvent | LocationActionEmbeddingEvent): Promise<void> {
    if (isDocumentEmbeddingEvent(event)) {
      await this.handleDocumentEvent(event);
    } else if (isDocumentChunkEmbeddingEvent(event)) {
      await this.handleDocumentChunkEvent(event);
    } else if (isLocationActionEmbeddingEvent(event)) {
      await this.handleLocationActionEvent(event);
    }
  }

  /**
   * Hash content for cache key
   */
  private hashContent(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Convert MongoDB ObjectId to UUID format for Qdrant
   * Qdrant requires UUID or unsigned integer IDs
   */
  private objectIdToUUID(objectId: string): string {
    // Convert MongoDB ObjectId (24 hex chars) to UUID format (32 hex chars with dashes)
    // Format: 8-4-4-4-12 hex digits
    const hex = objectId.padEnd(32, '0'); // Pad to 32 chars
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
  }

  /**
   * Handle document embedding event
   */
  private async handleDocumentEvent(event: DocumentEmbeddingEvent): Promise<void> {
    try {
      console.log(`📄 Processing document embedding: ${event.title} (${event.documentId})`);

      const text = `${event.title}\n\n${event.content}`;

      // ✅ Check cache first
      const cacheKey = `embedding:${this.hashContent(text)}`;
      if (this.redis) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          const embedding = JSON.parse(cached);
          await this.saveDocumentEmbedding(event.documentId, embedding, event.type);
          console.log(`✅ Document embedding from cache: ${event.title}`);
          return;
        }
      }

      // ✅ Generate embedding
      const embedding = await this.generateEmbedding(text);

      if (!embedding) {
        throw new Error(`Failed to generate embedding for document ${event.documentId}`);
      }

      // ✅ Cache for 1 hour
      if (this.redis) {
        await this.redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(embedding));
      }

      // ✅ Save to DB + Qdrant
      await this.saveDocumentEmbedding(event.documentId, embedding, event.type);

      console.log(`✅ Document embedding saved: ${event.title}`);

    } catch (error) {
      console.error('❌ Error processing document embedding event:', error);
      throw error; // Re-throw to trigger Bull retry
    }
  }

  /**
   * Handle document chunk embedding event
   */
  private async handleDocumentChunkEvent(event: DocumentChunkEmbeddingEvent): Promise<void> {
    try {
      console.log(`📑 Processing document chunk embedding: ${event.title} (#${event.slug})`);

      const text = `${event.title}\n\n${event.content}`;

      // ✅ Check cache first
      const cacheKey = `embedding:${this.hashContent(text)}`;
      if (this.redis) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          const embedding = JSON.parse(cached);
          await this.saveDocumentChunkEmbedding(event, embedding);
          console.log(`✅ Chunk embedding from cache: ${event.title}`);
          return;
        }
      }

      // ✅ Generate embedding
      const embedding = await this.generateEmbedding(text);

      if (!embedding) {
        throw new Error(`Failed to generate embedding for chunk ${event.chunkId}`);
      }

      // ✅ Cache for 1 hour
      if (this.redis) {
        await this.redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(embedding));
      }

      // ✅ Save to DB + Qdrant
      await this.saveDocumentChunkEmbedding(event, embedding);

      console.log(`✅ Chunk embedding saved: ${event.title} (#${event.slug})`);

    } catch (error) {
      console.error('❌ Error processing chunk embedding event:', error);
      throw error; // Re-throw to trigger Bull retry
    }
  }

  /**
   * Handle location action embedding event
   */
  private async handleLocationActionEvent(event: LocationActionEmbeddingEvent): Promise<void> {
    try {
      console.log(`🎭 Processing location action embedding: ${event.locationActionId}`);

      // Get location name
      const Location = mongoose.model('Location');
      const location = await Location.findById(event.locationId).select('name').lean() as any;

      if (!location) {
        throw new Error(`Location not found: ${event.locationId}`);
      }

      // Generate text with context
      const locationName = location.name as string;
      const text = `${event.characterName} a ${locationName}: ${event.content}`;

      // ✅ Check cache
      const cacheKey = `embedding:${this.hashContent(text)}`;
      if (this.redis) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          const embedding = JSON.parse(cached);
          await this.saveLocationActionEmbedding(event.locationActionId, locationName, embedding);
          console.log(`✅ Location action embedding from cache: ${event.characterName}`);
          return;
        }
      }

      // ✅ Generate embedding
      const embedding = await this.generateEmbedding(text);

      if (!embedding) {
        throw new Error(`Failed to generate embedding for location action ${event.locationActionId}`);
      }

      // ✅ Cache
      if (this.redis) {
        await this.redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(embedding));
      }

      // ✅ Save to DB
      await this.saveLocationActionEmbedding(event.locationActionId, locationName, embedding);

      console.log(`✅ Location action embedding saved: ${event.characterName} @ ${locationName}`);

    } catch (error) {
      console.error('❌ Error processing location action embedding event:', error);
      throw error; // Re-throw to trigger Bull retry
    }
  }

  /**
   * Generate embedding via Python subprocess
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      return await this.pythonService.generateEmbedding(text);
    } catch (error: any) {
      console.error('Error generating embedding:', error.message);
      throw error; // Re-throw to trigger Bull retry
    }
  }

  /**
   * Detect event type from job data
   */
  private detectEventType(data: any): 'document' | 'document_chunk' | 'location_action' {
    if (data.chunkId) return 'document_chunk';
    if (data.locationActionId) return 'location_action';
    return 'document';
  }

  /**
   * Check if error is permanent (validation, missing data)
   */
  private isPermanentError(error: Error): boolean {
    const permanentErrors = [
      'Invalid text',
      'Missing',
      'not found',
      'Too long',
      'Text cannot be empty'
    ];
    return permanentErrors.some(msg => error.message.includes(msg));
  }

  /**
   * Save document embedding to MongoDB + Qdrant
   */
  private async saveDocumentEmbedding(
    documentId: string,
    embedding: number[],
    documentType: 'ambientazione' | 'regolamento' | 'lore'
  ): Promise<void> {
    // ✅ Save to MongoDB
    const Document = mongoose.model('Document');
    await Document.findByIdAndUpdate(documentId, {
      contentEmbedding: embedding,
      embeddingModel: EMBEDDING_MODEL,
      embeddingGeneratedAt: new Date()
    });

    // ✅ ALSO save to Qdrant (for fast vector search)
    try {
      await this.qdrant.upsert('documents', {
        wait: true,
        points: [{
          id: this.objectIdToUUID(documentId),
          vector: embedding,
          payload: {
            documentId,
            documentType  // ✅ Use actual document type instead of 'document' literal
          }
        }]
      });
      console.log(`✅ Embedding saved to MongoDB + Qdrant (type: ${documentType})`);
    } catch (error) {
      console.error('❌ Failed to save to Qdrant (MongoDB saved):', error);
      // Don't throw - MongoDB save succeeded, Qdrant is optional
    }
  }

  /**
   * Save document chunk embedding to MongoDB + Qdrant
   */
  private async saveDocumentChunkEmbedding(
    event: DocumentChunkEmbeddingEvent,
    embedding: number[]
  ): Promise<void> {
    // ✅ Save to MongoDB
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const result = await db.collection('documentchunks').updateOne(
      { _id: new mongoose.Types.ObjectId(event.chunkId) },
      {
        $set: {
          contentEmbedding: embedding,
          embeddingModel: EMBEDDING_MODEL,
          embeddingGeneratedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      throw new Error(`DocumentChunk not found: ${event.chunkId}`);
    }

    // ✅ ALSO save to Qdrant (for fast vector search)
    try {
      // Generate UUID for Qdrant point ID
      const pointId = crypto.randomUUID();

      await this.qdrant.upsert('document_chunks', {
        wait: true,
        points: [{
          id: pointId,
          vector: embedding,
          payload: {
            chunkId: event.chunkId,
            documentId: event.documentId,
            slug: event.slug,
            heading: event.title,
            documentType: event.documentType,
            headingLevel: event.headingLevel,      // NEW: H2 vs H3
            parentSlug: event.parentSlug,          // NEW: parent H2 slug for H3 chunks
            isActive: true,
            order: event.order
          }
        }]
      });
      console.log(`✅ Chunk embedding saved to MongoDB + Qdrant (type: ${event.documentType}, level: H${event.headingLevel})`);
    } catch (error) {
      console.error('❌ Failed to save to Qdrant (MongoDB saved):', error);
      // Don't throw - MongoDB save succeeded, Qdrant is optional
    }
  }

  /**
   * Save location action embedding to MongoDB + Qdrant
   */
  private async saveLocationActionEmbedding(locationActionId: string, locationName: string, embedding: number[]): Promise<void> {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    // ✅ Save to MongoDB
    const result = await db.collection('locationactions').updateOne(
      { _id: new mongoose.Types.ObjectId(locationActionId) },
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
      throw new Error(`LocationAction not found: ${locationActionId}`);
    }

    // ✅ ALSO save to Qdrant (for fast vector search)
    try {
      await this.qdrant.upsert('location_actions', {
        wait: true,
        points: [{
          id: this.objectIdToUUID(locationActionId),
          vector: embedding,
          payload: {
            locationActionId,
            locationName,
            type: 'location_action'
          }
        }]
      });
      console.log(`✅ Embedding saved to MongoDB + Qdrant`);
    } catch (error) {
      console.error('❌ Failed to save to Qdrant (MongoDB saved):', error);
      // Don't throw - MongoDB save succeeded, Qdrant is optional
    }
  }
}
