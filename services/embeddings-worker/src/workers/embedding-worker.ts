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
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import {
  REDIS_CHANNELS,
  DocumentEmbeddingEvent,
  DocumentChunkEmbeddingEvent,
  LocationEmbeddingEvent,
  ChatEmbeddingEvent,
  DeleteEmbeddingEvent,
  EmbeddingEvent,
  isDocumentEmbeddingEvent,
  isDocumentChunkEmbeddingEvent,
  isLocationEmbeddingEvent,
  isChatEmbeddingEvent,
  isDeleteEmbeddingEvent
} from '../types/events';
import { PythonEmbeddingService } from '../services/PythonEmbeddingService';
import { DLQService } from '../services/DLQService';
import { parseChunks, ParsedChunk } from '../utils/ChunkParser';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const ELASTICSEARCH_INDEX_PREFIX = process.env.ELASTICSEARCH_INDEX_PREFIX || 'tenpennynovels';
const EMBEDDING_MODEL = 'paraphrase-multilingual-MiniLM-L12-v2';
const CACHE_TTL = 3600; // 1 hour

export class EmbeddingWorker {
  private subscriber: any; // Redis subscriber
  private redis: any; // Redis client for caching
  private qdrant: QdrantClient; // Qdrant vector DB client
  private elasticsearch: ElasticsearchClient; // ElasticSearch full-text search client
  private queue: Bull.Queue;
  private pythonService: PythonEmbeddingService; // Python subprocess for embeddings
  private isRunning: boolean = false;

  constructor(redisSubscriber: any, pythonService: PythonEmbeddingService) {
    this.subscriber = redisSubscriber;
    this.pythonService = pythonService;

    // ✅ Initialize Qdrant client
    this.qdrant = new QdrantClient({ url: QDRANT_URL });

    // ✅ Initialize ElasticSearch client (v8 client for ES 8.x)
    this.elasticsearch = new ElasticsearchClient({ node: ELASTICSEARCH_URL });

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
   * Ensure Qdrant collections and ElasticSearch indices exist
   */
  private async ensureCollections(): Promise<void> {
    try {
      console.log('🔍 Checking Qdrant collections and ElasticSearch indices...');

      // ✅ Ensure Qdrant document_chunks collection
      const collections = await this.qdrant.getCollections();
      const hasDocumentChunks = collections.collections.some(c => c.name === 'document_chunks');
      const hasDocuments = collections.collections.some(c => c.name === 'documents');

      if (!hasDocumentChunks) {
        console.log('📦 Creating Qdrant collection: document_chunks');
        await this.qdrant.createCollection('document_chunks', {
          vectors: {
            size: 384, // paraphrase-multilingual-MiniLM-L12-v2
            distance: 'Cosine'
          }
        });
      }

      if (!hasDocuments) {
        console.log('📦 Creating Qdrant collection: documents');
        await this.qdrant.createCollection('documents', {
          vectors: {
            size: 384,
            distance: 'Cosine'
          }
        });
      }

      // ✅ Ensure ElasticSearch document_chunks index
      const chunkIndexExists = await this.elasticsearch.indices.exists({
        index: `${ELASTICSEARCH_INDEX_PREFIX}_document_chunks`
      });

      if (!chunkIndexExists) {
        console.log(`📦 Creating ElasticSearch index: ${ELASTICSEARCH_INDEX_PREFIX}_document_chunks`);
        await this.elasticsearch.indices.create({
          index: `${ELASTICSEARCH_INDEX_PREFIX}_document_chunks`,
          body: {
            settings: {
              analysis: {
                analyzer: {
                  italian: {
                    type: 'standard'
                  }
                }
              }
            },
            mappings: {
              properties: {
                chunkId: { type: 'keyword' },
                documentId: { type: 'keyword' },
                slug: { type: 'keyword' },
                heading: { type: 'text', analyzer: 'italian' },
                content: { type: 'text', analyzer: 'italian' },
                documentType: { type: 'keyword' },
                headingLevel: { type: 'integer' },
                parentSlug: { type: 'keyword' },
                isActive: { type: 'boolean' },
                createdAt: { type: 'date' }
              }
            }
          }
        });
      }

      console.log('✅ Collections and indices ready');

    } catch (error) {
      console.error('❌ Failed to ensure collections:', error);
      throw error;
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

    // ✅ Ensure collections exist before processing
    await this.ensureCollections();

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
      REDIS_CHANNELS.EMBEDDING_DOCUMENT_DELETED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add(event, {
          jobId: `doc-del-${event.entityId}-${Date.now()}`
        });
        console.log(`🗑️  Queued document deletion: ${event.entityId}`);
      }
    );

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_LOCATION_CREATED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add(event, {
          jobId: `loc-${event.locationId}-${Date.now()}`
        });
        console.log(`📍 Queued location: ${event.name}`);
      }
    );

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_LOCATION_UPDATED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add(event, {
          jobId: `loc-upd-${event.locationId}-${Date.now()}`
        });
        console.log(`📍 Queued location update: ${event.name}`);
      }
    );

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_LOCATION_DELETED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add(event, {
          jobId: `loc-del-${event.entityId}-${Date.now()}`
        });
        console.log(`🗑️  Queued location deletion: ${event.entityId}`);
      }
    );

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_CHAT_CREATED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add(event, {
          jobId: `action-${event.chatId}-${Date.now()}`
        });
        console.log(`🎭 Queued chat: ${event.characterName}`);
      }
    );

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_CHAT_UPDATED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add(event, {
          jobId: `action-upd-${event.chatId}-${Date.now()}`
        });
        console.log(`🎭 Queued chat update: ${event.characterName}`);
      }
    );

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_CHAT_DELETED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add(event, {
          jobId: `action-del-${event.entityId}-${Date.now()}`
        });
        console.log(`🗑️  Queued chat deletion: ${event.entityId}`);
      }
    );

    console.log('✅ Embedding Worker started with concurrency 5');
    console.log(`   Listening to channels:`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_DOCUMENT_CREATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_DOCUMENT_UPDATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_DOCUMENT_DELETED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_DOCUMENT_CHUNK_CREATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_LOCATION_CREATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_LOCATION_UPDATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_LOCATION_DELETED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_CHAT_CREATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_CHAT_UPDATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_CHAT_DELETED}`);
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
  private async processEmbedding(event: EmbeddingEvent): Promise<void> {
    if (isDeleteEmbeddingEvent(event)) {
      await this.handleDeleteEvent(event);
    } else if (isDocumentEmbeddingEvent(event)) {
      await this.handleDocumentEvent(event);
    } else if (isDocumentChunkEmbeddingEvent(event)) {
      await this.handleDocumentChunkEvent(event);
    } else if (isLocationEmbeddingEvent(event)) {
      await this.handleLocationEvent(event);
    } else if (isChatEmbeddingEvent(event)) {
      await this.handleChatEvent(event);
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
      console.log(`📄 Processing document: ${event.title} (${event.documentId})`);

      // ✅ Parse contentDelta to extract chunks
      if (!event.contentDelta) {
        console.warn(`⚠️  No contentDelta provided for ${event.title}, skipping chunking`);
        return;
      }

      const chunks: ParsedChunk[] = parseChunks(event.contentDelta);
      console.log(`   📑 Extracted ${chunks.length} chunks from document`);

      if (chunks.length === 0) {
        console.warn(`⚠️  No chunks extracted from ${event.title}`);
        return;
      }

      // ✅ Process each chunk: generate embedding + save to DB/Qdrant/ElasticSearch
      let processedChunks = 0;
      const errors: Error[] = [];

      for (const chunk of chunks) {
        try {
          const chunkText = `${event.title}\n${chunk.heading}\n\n${chunk.content}`;

          // Check cache
          const cacheKey = `embedding:${this.hashContent(chunkText)}`;
          let embedding: number[] | null = null;

          if (this.redis) {
            const cached = await this.redis.get(cacheKey);
            if (cached) {
              embedding = JSON.parse(cached);
            }
          }

          // Generate embedding if not cached
          if (!embedding) {
            embedding = await this.generateEmbedding(chunkText);
            if (!embedding) {
              const error = new Error(`Failed to generate embedding for chunk: ${chunk.heading}`);
              console.error(`   ❌ ${error.message}`);
              errors.push(error);
              continue;
            }

            // Cache for 1 hour
            if (this.redis) {
              await this.redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(embedding));
            }
          }

          // Save chunk to MongoDB + Qdrant + ElasticSearch
          await this.saveDocumentChunk(event.documentId, chunk, embedding, event.type);
          processedChunks++;

        } catch (chunkError) {
          console.error(`   ❌ Error processing chunk "${chunk.heading}":`, chunkError);
          errors.push(chunkError as Error);
        }
      }

      // If ANY chunk failed, throw error to trigger Bull retry
      if (errors.length > 0) {
        throw new Error(`Failed to process ${errors.length}/${chunks.length} chunks. First error: ${errors[0].message}`);
      }

      console.log(`✅ Document chunked and embedded: ${event.title} (${processedChunks}/${chunks.length} chunks)`);

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
   * Handle chat embedding event
   */
  private async handleChatEvent(event: ChatEmbeddingEvent): Promise<void> {
    try {
      console.log(`🎭 Processing chat embedding: ${event.chatId}`);

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
          await this.saveChatEmbedding(event.chatId, locationName, embedding);
          console.log(`✅ Location action embedding from cache: ${event.characterName}`);
          return;
        }
      }

      // ✅ Generate embedding
      const embedding = await this.generateEmbedding(text);

      if (!embedding) {
        throw new Error(`Failed to generate embedding for chat ${event.chatId}`);
      }

      // ✅ Cache
      if (this.redis) {
        await this.redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(embedding));
      }

      // ✅ Save to DB
      await this.saveChatEmbedding(event.chatId, locationName, embedding);

      console.log(`✅ Location action embedding saved: ${event.characterName} @ ${locationName}`);

    } catch (error) {
      console.error('❌ Error processing chat embedding event:', error);
      throw error; // Re-throw to trigger Bull retry
    }
  }

  /**
   * Handle location embedding event (created/updated)
   */
  private async handleLocationEvent(event: LocationEmbeddingEvent): Promise<void> {
    try {
      console.log(`📍 Processing location embedding: ${event.name}`);

      // Generate text from location data
      const text = `${event.name}\n${event.district}\n\n${event.description}`;

      // ✅ Check cache
      const cacheKey = `embedding:${this.hashContent(text)}`;
      if (this.redis) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          const embedding = JSON.parse(cached);
          await this.saveLocationEmbedding(event.locationId, embedding);
          console.log(`✅ Location embedding from cache: ${event.name}`);
          return;
        }
      }

      // ✅ Generate embedding
      const embedding = await this.generateEmbedding(text);

      if (!embedding) {
        throw new Error(`Failed to generate embedding for location ${event.locationId}`);
      }

      // ✅ Cache
      if (this.redis) {
        await this.redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(embedding));
      }

      // ✅ Save to Qdrant
      await this.saveLocationEmbedding(event.locationId, embedding);

      console.log(`✅ Location embedding saved: ${event.name}`);

    } catch (error) {
      console.error('❌ Error processing location embedding event:', error);
      throw error; // Re-throw to trigger Bull retry
    }
  }

  /**
   * Handle delete event (Document, Location, Chat)
   * Removes embeddings from Qdrant + ElasticSearch
   */
  private async handleDeleteEvent(event: DeleteEmbeddingEvent): Promise<void> {
    try {
      console.log(`🗑️  Processing deletion: ${event.entityType} ${event.entityId}`);

      switch (event.entityType) {
        case 'document':
          await this.deleteDocumentEmbeddings(event.entityId);
          break;
        case 'location':
          await this.deleteLocationEmbedding(event.entityId);
          break;
        case 'chat':
          await this.deleteChatEmbedding(event.entityId);
          break;
      }

      console.log(`✅ Embeddings deleted: ${event.entityType} ${event.entityId}`);

    } catch (error) {
      console.error(`❌ Error deleting ${event.entityType} embeddings:`, error);
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
  private detectEventType(data: any): 'document' | 'document_chunk' | 'chat' {
    if (data.chunkId) return 'document_chunk';
    if (data.chatId) return 'chat';
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
   * Save document chunk embedding to Qdrant + ElasticSearch
   */
  /**
   * Save document chunk to MongoDB + Qdrant + ElasticSearch
   */
  private async saveDocumentChunk(
    documentId: string,
    chunk: ParsedChunk,
    embedding: number[],
    documentType: 'ambientazione' | 'approfondimenti' | 'regolamento'
  ): Promise<void> {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection not available');
    }

    // Generate IDs
    const chunkId = crypto.randomUUID();
    const pointId = crypto.randomUUID();

    // ✅ Save chunk to MongoDB documentchunks collection
    try {
      await db.collection('documentchunks').updateOne(
        {
          documentId,
          slug: chunk.slug
        },
        {
          $set: {
            chunkId,
            documentId,
            slug: chunk.slug,
            heading: chunk.heading,
            content: chunk.content,
            headingLevel: chunk.headingLevel,
            parentSlug: chunk.parentSlug,
            order: chunk.order,
            isActive: true,
            embeddingModel: EMBEDDING_MODEL,
            lastUpdated: new Date()
          }
        },
        { upsert: true }
      );
    } catch (mongoError) {
      console.error('❌ Failed to save chunk to MongoDB:', mongoError);
      // Don't throw - continue with Qdrant/ES
    }

    // ✅ Save to Qdrant (vector search)
    await this.qdrant.upsert('document_chunks', {
      wait: true,
      points: [{
        id: pointId,
        vector: embedding,
        payload: {
          chunkId,
          documentId,
          slug: chunk.slug,
          heading: chunk.heading,
          documentType,
          headingLevel: chunk.headingLevel,
          parentSlug: chunk.parentSlug,
          isActive: true,
          order: chunk.order
        }
      }]
    });

    // ✅ Save to ElasticSearch (keyword search)
    try {
      await this.elasticsearch.index({
        index: `${ELASTICSEARCH_INDEX_PREFIX}_document_chunks`,
        id: chunkId,
        document: {
          chunkId,
          documentId,
          slug: chunk.slug,
          heading: chunk.heading,
          content: chunk.content,
          documentType,
          headingLevel: chunk.headingLevel,
          parentSlug: chunk.parentSlug,
          isActive: true,
          order: chunk.order
        }
      });
    } catch (esError) {
      console.error('❌ Failed to index to ElasticSearch:', esError);
      // Don't throw - Qdrant save succeeded
    }
  }

  private async saveDocumentChunkEmbedding(
    event: DocumentChunkEmbeddingEvent,
    embedding: number[]
  ): Promise<void> {
    // Generate UUID for Qdrant point ID
    const pointId = crypto.randomUUID();

    // ✅ Save to Qdrant (vector search)
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
          headingLevel: event.headingLevel,
          parentSlug: event.parentSlug,
          isActive: true,
          order: event.order
        }
      }]
    });

    console.log(`✅ Chunk embedding saved to Qdrant (type: ${event.documentType}, level: H${event.headingLevel})`);

    // ✅ ALSO save to ElasticSearch (keyword search)
    try {
      await this.elasticsearch.index({
        index: `${ELASTICSEARCH_INDEX_PREFIX}_document_chunks`,
        id: event.chunkId,
        document: {
          chunkId: event.chunkId,
          documentId: event.documentId,
          slug: event.slug,
          heading: event.title,
          content: event.content,
          documentType: event.documentType,
          headingLevel: event.headingLevel,
          parentSlug: event.parentSlug,
          isActive: true,
          order: event.order
        }
      });
      console.log(`✅ Chunk also indexed to ElasticSearch (keyword search)`);
    } catch (error) {
      console.error('❌ Failed to index to ElasticSearch (Qdrant saved):', error);
      // Don't throw - Qdrant save succeeded, ElasticSearch is optional
    }
  }

  /**
   * Save chat embedding to MongoDB + Qdrant
   */
  private async saveChatEmbedding(chatId: string, locationName: string, embedding: number[]): Promise<void> {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    // ✅ Save to MongoDB
    const result = await db.collection('chats').updateOne(
      { _id: new mongoose.Types.ObjectId(chatId) },
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
      throw new Error(`Chat not found: ${chatId}`);
    }

    // ✅ ALSO save to Qdrant (for fast vector search)
    try {
      await this.qdrant.upsert('chats', {
        wait: true,
        points: [{
          id: this.objectIdToUUID(chatId),
          vector: embedding,
          payload: {
            chatId,
            locationName,
            type: 'chat'
          }
        }]
      });
      console.log(`✅ Embedding saved to MongoDB + Qdrant`);
    } catch (error) {
      console.error('❌ Failed to save to Qdrant (MongoDB saved):', error);
      // Don't throw - MongoDB save succeeded, Qdrant is optional
    }
  }

  /**
   * Save location embedding to Qdrant
   */
  private async saveLocationEmbedding(locationId: string, embedding: number[]): Promise<void> {
    try {
      await this.qdrant.upsert('chats', {
        wait: true,
        points: [{
          id: this.objectIdToUUID(locationId),
          vector: embedding,
          payload: {
            locationId,
            type: 'location'
          }
        }]
      });
      console.log(`✅ Location embedding saved to Qdrant`);
    } catch (error) {
      console.error('❌ Failed to save location to Qdrant:', error);
      throw error;
    }
  }

  /**
   * Delete all document chunks (Qdrant + ElasticSearch)
   * Called when a document is deleted
   */
  private async deleteDocumentEmbeddings(documentId: string): Promise<void> {
    try {
      // Delete from ElasticSearch (all chunks for this document)
      await this.elasticsearch.deleteByQuery({
        index: `${ELASTICSEARCH_INDEX_PREFIX}_document_chunks`,
        body: {
          query: {
            term: { documentId }
          }
        }
      });

      // Delete from Qdrant (filter by documentId in payload)
      await this.qdrant.delete('document_chunks', {
        wait: true,
        filter: {
          must: [{ key: 'documentId', match: { value: documentId } }]
        }
      });

      console.log(`✅ Deleted all chunks for document ${documentId}`);
    } catch (error) {
      console.error(`❌ Failed to delete document chunks:`, error);
      throw error;
    }
  }

  /**
   * Delete location embedding from Qdrant
   */
  private async deleteLocationEmbedding(locationId: string): Promise<void> {
    try {
      await this.qdrant.delete('chats', {
        wait: true,
        points: [this.objectIdToUUID(locationId)]
      });
      console.log(`✅ Deleted location embedding from Qdrant`);
    } catch (error) {
      console.error(`❌ Failed to delete location:`, error);
      throw error;
    }
  }

  /**
   * Delete chat embedding from Qdrant
   */
  private async deleteChatEmbedding(chatId: string): Promise<void> {
    try {
      await this.qdrant.delete('chats', {
        wait: true,
        points: [this.objectIdToUUID(chatId)]
      });
      console.log(`✅ Deleted chat embedding from Qdrant`);
    } catch (error) {
      console.error(`❌ Failed to delete chat:`, error);
      throw error;
    }
  }
}
