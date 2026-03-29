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
  ChatEmbeddingEvent,
  ForumPostEmbeddingEvent,
  OnGameMessageModerationEvent,
  OffGameMessageModerationEvent,
  DeleteEmbeddingEvent,
  EmbeddingEvent,
  isDocumentEmbeddingEvent,
  isDocumentChunkEmbeddingEvent,
  isChatEmbeddingEvent,
  isForumPostEmbeddingEvent,
  isOnGameMessageModerationEvent,
  isOffGameMessageModerationEvent,
  isDeleteEmbeddingEvent
} from '../types/events';
import { PythonEmbeddingService, ModerationResult } from '../services/PythonEmbeddingService';
import { DLQService } from '../services/DLQService';
import { parseChunks, ParsedChunk } from '../utils/ChunkParser';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  validateDocumentEvent,
  validateChatEvent,
} from '../utils/validation';

export class EmbeddingWorker {
  private subscriber: any; // Redis subscriber
  private redis: any; // Redis client for caching
  private qdrant: QdrantClient; // Qdrant vector DB client
  private elasticsearch: ElasticsearchClient; // ElasticSearch full-text search client
  private queue: Bull.Queue;
  private pythonService: PythonEmbeddingService; // Python subprocess for embeddings
  private isRunning: boolean = false;

  private moderationConfigCache: { enabled: boolean; threshold: number } | null = null;
  private moderationConfigCacheTime: number = 0;

  constructor(redisSubscriber: any, pythonService: PythonEmbeddingService) {
    this.subscriber = redisSubscriber;
    this.pythonService = pythonService;

    // ✅ Initialize Qdrant client
    this.qdrant = new QdrantClient({ url: config.services.qdrant.url });

    // ✅ Initialize ElasticSearch client (v8 client for ES 8.x)
    this.elasticsearch = new ElasticsearchClient({ node: config.services.elasticsearch.url });

    // ✅ Bull queue with retry
    this.queue = new Bull('embeddings', {
      redis: config.database.redisUrl,
      defaultJobOptions: {
        attempts: config.queue.maxAttempts,
        backoff: {
          type: 'exponential',
          delay: config.queue.backoffDelay
        },
        removeOnComplete: config.queue.keepCompleted,
        removeOnFail: false    // DON'T auto-remove failed jobs - use DLQ
      }
    });

    this.queue.process(config.queue.concurrency, async (job) => {
      return this.processEmbedding(job.data);
    });

    // Queue event listeners
    this.queue.on('completed', (job, result) => {
      console.log(`✅ Job ${job.id} completed`);
    });

    // Failed job handler → DLQ
    this.queue.on('failed', async (job, err) => {
      console.error(`❌ Job ${job.id} failed after ${job.attemptsMade} attempts:`, err.message);

      if (job.attemptsMade >= config.queue.maxAttempts) {
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
      this.redis = createClient({ url: config.database.redisUrl });
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

      const hasForumPosts = collections.collections.some(c => c.name === 'forum_posts');
      if (!hasForumPosts) {
        console.log('📦 Creating Qdrant collection: forum_posts');
        await this.qdrant.createCollection('forum_posts', {
          vectors: {
            size: 384,
            distance: 'Cosine'
          }
        });
      }

      const hasChatMessages = collections.collections.some(c => c.name === 'chat_messages');
      if (!hasChatMessages) {
        console.log('📦 Creating Qdrant collection: chat_messages');
        await this.qdrant.createCollection('chat_messages', {
          vectors: {
            size: 384,
            distance: 'Cosine'
          }
        });
      }

      // ✅ Ensure ElasticSearch document_chunks index
      const chunkIndexExists = await this.elasticsearch.indices.exists({
        index: `${config.services.elasticsearch.indexPrefix}_document_chunks`
      });

      if (!chunkIndexExists) {
        console.log(`📦 Creating ElasticSearch index: ${config.services.elasticsearch.indexPrefix}_document_chunks`);
        await this.elasticsearch.indices.create({
          index: `${config.services.elasticsearch.indexPrefix}_document_chunks`,
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

      const forumIndexExists = await this.elasticsearch.indices.exists({
        index: `${config.services.elasticsearch.indexPrefix}_forum_posts`
      });

      if (!forumIndexExists) {
        console.log(`📦 Creating ElasticSearch index: ${config.services.elasticsearch.indexPrefix}_forum_posts`);
        await this.elasticsearch.indices.create({
          index: `${config.services.elasticsearch.indexPrefix}_forum_posts`,
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
                postId: { type: 'keyword' },
                topicSlug: { type: 'keyword' },
                discussionSlug: { type: 'keyword' },
                authorCharacterId: { type: 'keyword' },
                authorCharacterName: { type: 'text' },
                content: { type: 'text', analyzer: 'italian' },
                createdAt: { type: 'date' }
              }
            }
          }
        });
      }

      const chatIndexExists = await this.elasticsearch.indices.exists({
        index: `${config.services.elasticsearch.indexPrefix}_chat_messages`
      });

      if (!chatIndexExists) {
        console.log(`📦 Creating ElasticSearch index: ${config.services.elasticsearch.indexPrefix}_chat_messages`);
        await this.elasticsearch.indices.create({
          index: `${config.services.elasticsearch.indexPrefix}_chat_messages`,
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
                chatId: { type: 'keyword' },
                locationId: { type: 'keyword' },
                characterId: { type: 'keyword' },
                characterName: { type: 'text' },
                content: { type: 'text', analyzer: 'italian' },
                timestamp: { type: 'date' },
                actionType: { type: 'keyword' },
                visibility: { type: 'keyword' }
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
      REDIS_CHANNELS.EMBEDDING_CHAT_CREATED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add({ ...event, _source: 'created' }, {
          jobId: `action-${event.chatId}-${Date.now()}`
        });
        console.log(`🎭 Queued chat: ${event.characterName}`);
      }
    );

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_CHAT_UPDATED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add({ ...event, _source: 'updated' }, {
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

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_FORUM_POST_CREATED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add({ ...event, _source: 'created' }, {
          jobId: `forum-${event.postId}-${Date.now()}`
        });
        console.log(`💬 Queued forum post: ${event.authorCharacterName}`);
      }
    );

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_FORUM_POST_UPDATED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add({ ...event, _source: 'updated' }, {
          jobId: `forum-upd-${event.postId}-${Date.now()}`
        });
        console.log(`💬 Queued forum post update: ${event.authorCharacterName}`);
      }
    );

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_FORUM_POST_DELETED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add(event, {
          jobId: `forum-del-${event.entityId}-${Date.now()}`
        });
        console.log(`🗑️  Queued forum post deletion: ${event.entityId}`);
      }
    );

    // Mail moderation subscriptions
    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_ONGAME_MESSAGE_CREATED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add(event, {
          jobId: `ongame-mod-${event.messageId}-${Date.now()}`
        });
        console.log(`📧 Queued OnGame message moderation: ${event.subject}`);
      }
    );

    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMBEDDING_OFFGAME_MESSAGE_CREATED,
      (message: string) => {
        const event = JSON.parse(message);
        this.queue.add(event, {
          jobId: `offgame-mod-${event.messageId}-${Date.now()}`
        });
        console.log(`💬 Queued OffGame message moderation: ${event.messageId}`);
      }
    );

    console.log(`✅ Embedding Worker started with concurrency ${config.queue.concurrency}`);
    console.log(`   Listening to channels:`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_DOCUMENT_CREATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_DOCUMENT_UPDATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_DOCUMENT_DELETED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_DOCUMENT_CHUNK_CREATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_CHAT_CREATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_CHAT_UPDATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_CHAT_DELETED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_FORUM_POST_CREATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_FORUM_POST_UPDATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_FORUM_POST_DELETED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_ONGAME_MESSAGE_CREATED}`);
    console.log(`   - ${REDIS_CHANNELS.EMBEDDING_OFFGAME_MESSAGE_CREATED}`);
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
    } else if (isForumPostEmbeddingEvent(event)) {
      await this.handleForumPostEvent(event as ForumPostEmbeddingEvent);
    } else if (isDocumentEmbeddingEvent(event)) {
      await this.handleDocumentEvent(event);
    } else if (isDocumentChunkEmbeddingEvent(event)) {
      await this.handleDocumentChunkEvent(event);
    } else if (isChatEmbeddingEvent(event)) {
      await this.handleChatEvent(event);
    } else if (isOnGameMessageModerationEvent(event)) {
      await this.handleOnGameMessageModeration(event);
    } else if (isOffGameMessageModerationEvent(event)) {
      await this.handleOffGameMessageModeration(event);
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
              await this.redis.setEx(cacheKey, config.embeddings.cacheTTL, JSON.stringify(embedding));
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
        await this.redis.setEx(cacheKey, config.embeddings.cacheTTL, JSON.stringify(embedding));
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
   * Handle chat embedding event (embedding + optional moderation)
   */
  private async handleChatEvent(event: ChatEmbeddingEvent): Promise<void> {
    try {
      console.log(`🎭 Processing chat embedding: ${event.chatId}`);

      // Type-safe Location query result
      interface LocationQueryResult {
        _id: string;
        name: string;
        slug: string;
      }

      const Location = mongoose.model('Location');
      const location = await Location.findById(event.locationId)
        .select('name slug')
        .lean() as LocationQueryResult | null;

      if (!location) {
        throw new Error(`Location not found: ${event.locationId}`);
      }

      const locationName = location.name;
      const locationSlug = location.slug ?? '';
      const text = `${event.characterName} a ${locationName}: ${event.content}`;

      // ✅ Check cache for embedding
      const cacheKey = `embedding:${this.hashContent(text)}`;
      let embedding: number[] | null = null;

      if (this.redis) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          embedding = JSON.parse(cached);
        }
      }

      if (!embedding) {
        embedding = await this.generateEmbedding(text);
        if (!embedding) {
          throw new Error(`Failed to generate embedding for chat ${event.chatId}`);
        }
        if (this.redis) {
          await this.redis.setEx(cacheKey, config.embeddings.cacheTTL, JSON.stringify(embedding));
        }
      }

      // Note: Moderation disabled - dead code removed (event._source was always undefined)
      const moderation: ModerationResult | null = null;

      // ✅ Save embedding + moderation to DB
      await this.saveChatEmbeddingAndModeration(event.chatId, locationName, embedding, moderation);

      console.log(`✅ Chat processed: ${event.characterName} @ ${locationName}`);

    } catch (error) {
      console.error('❌ Error processing chat embedding event:', error);
      throw error;
    }
  }

  /**
   * Handle forum post embedding event (embedding + moderation)
   */
  private async handleForumPostEvent(event: ForumPostEmbeddingEvent): Promise<void> {
    try {
      console.log(`💬 Processing forum post embedding: ${event.postId}`);

      const text = `${event.authorCharacterName} in ${event.topicSlug}/${event.discussionSlug}: ${event.content}`;

      const cacheKey = `embedding:${this.hashContent(text)}`;
      let embedding: number[] | null = null;

      if (this.redis) {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          embedding = JSON.parse(cached);
        }
      }

      if (!embedding) {
        embedding = await this.generateEmbedding(text);
        if (!embedding) {
          throw new Error(`Failed to generate embedding for forum post ${event.postId}`);
        }
        if (this.redis) {
          await this.redis.setEx(cacheKey, config.embeddings.cacheTTL, JSON.stringify(embedding));
        }
      }

      let moderation: ModerationResult | null = null;
      const moderationConfig = await this.getModerationConfig();

      if (moderationConfig.enabled) {
        try {
          moderation = await this.pythonService.moderateText(event.content);
          console.log(`🛡️ Moderation: ${moderation.label} (${moderation.score}) for ${event.authorCharacterName}`);

          if (moderation.label === 'toxic' && moderation.score >= moderationConfig.threshold) {
            await this.createForumModerationAlert(event, moderation);
          }
        } catch (moderationError) {
          console.error('⚠️ Moderation failed (embedding will still be saved):', moderationError);
        }
      }

      await this.saveForumPostEmbeddingAndModeration(event, embedding, moderation);

      console.log(`✅ Forum post processed: ${event.authorCharacterName} @ ${event.topicSlug}/${event.discussionSlug}`);

    } catch (error) {
      console.error('❌ Error processing forum post embedding event:', error);
      throw error;
    }
  }

  /**
   * Create a ModerationAlert record for a toxic forum post
   */
  private async createForumModerationAlert(
    event: ForumPostEmbeddingEvent,
    moderation: ModerationResult
  ): Promise<void> {
    try {
      const db = mongoose.connection.db;
      if (!db) return;

      await db.collection('moderation_alerts').insertOne({
        source: 'forum',
        forumPostId: event.postId,
        characterId: event.authorCharacterId,
        characterName: event.authorCharacterName,
        topicSlug: event.topicSlug,
        discussionSlug: event.discussionSlug,
        content: event.content,
        toxicityScore: moderation.score,
        moderationLabel: moderation.label,
        moderationModel: config.moderation.model,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`🚨 ModerationAlert created: score=${moderation.score} for ${event.authorCharacterName}`);
    } catch (error) {
      console.error('⚠️ Failed to create ModerationAlert:', error);
    }
  }

  /**
   * Handle OnGame message moderation
   */
  private async handleOnGameMessageModeration(event: OnGameMessageModerationEvent): Promise<void> {
    try {
      console.log(`📧 Processing OnGame message moderation: ${event.subject}`);

      const moderationConfig = await this.getModerationConfig();

      if (!moderationConfig.enabled) {
        console.log('   ⏭️  Moderation disabled, skipping');
        return;
      }

      let moderation: ModerationResult | null = null;
      try {
        moderation = await this.pythonService.moderateText(event.content);
        console.log(`   🛡️ Moderation: ${moderation.label} (${moderation.score})`);

        // Update message with moderation results
        const db = mongoose.connection.db;
        if (db) {
          await db.collection('ongame_messages').updateOne(
            { _id: new mongoose.Types.ObjectId(event.messageId) },
            {
              $set: {
                moderationScore: moderation.score,
                moderationLabel: moderation.label,
                moderationModel: config.moderation.model,
                moderationProcessedAt: new Date()
              }
            }
          );
        }

        // Create alert if toxic
        if (moderation.label === 'toxic' && moderation.score >= moderationConfig.threshold) {
          await this.createOnGameModerationAlert(event, moderation);
        }
      } catch (moderationError) {
        console.error('⚠️ OnGame message moderation failed:', moderationError);
      }

      console.log(`✅ OnGame message moderation completed: ${event.messageId}`);
    } catch (error) {
      console.error('❌ Error processing OnGame message moderation:', error);
      throw error;
    }
  }

  /**
   * Handle OffGame message moderation
   */
  private async handleOffGameMessageModeration(event: OffGameMessageModerationEvent): Promise<void> {
    try {
      console.log(`💬 Processing OffGame message moderation: ${event.messageId}`);

      const moderationConfig = await this.getModerationConfig();

      if (!moderationConfig.enabled) {
        console.log('   ⏭️  Moderation disabled, skipping');
        return;
      }

      let moderation: ModerationResult | null = null;
      try {
        moderation = await this.pythonService.moderateText(event.content);
        console.log(`   🛡️ Moderation: ${moderation.label} (${moderation.score})`);

        // Update message with moderation results
        const db = mongoose.connection.db;
        if (db) {
          await db.collection('offgame_messages').updateOne(
            { _id: new mongoose.Types.ObjectId(event.messageId) },
            {
              $set: {
                moderationScore: moderation.score,
                moderationLabel: moderation.label,
                moderationModel: config.moderation.model,
                moderationProcessedAt: new Date()
              }
            }
          );
        }

        // Create alert if toxic
        if (moderation.label === 'toxic' && moderation.score >= moderationConfig.threshold) {
          await this.createOffGameModerationAlert(event, moderation);
        }
      } catch (moderationError) {
        console.error('⚠️ OffGame message moderation failed:', moderationError);
      }

      console.log(`✅ OffGame message moderation completed: ${event.messageId}`);
    } catch (error) {
      console.error('❌ Error processing OffGame message moderation:', error);
      throw error;
    }
  }

  /**
   * Create a ModerationAlert record for a toxic OnGame message
   */
  private async createOnGameModerationAlert(
    event: OnGameMessageModerationEvent,
    moderation: ModerationResult
  ): Promise<void> {
    try {
      const db = mongoose.connection.db;
      if (!db) return;

      // Fetch sender and recipient character names
      const Character = mongoose.model('Character');
      const [sender, recipient] = await Promise.all([
        Character.findById(event.senderId).select('name surname').lean<{ name: string; surname?: string } | null>(),
        Character.findById(event.recipientId).select('name surname').lean<{ name: string; surname?: string } | null>()
      ]);

      const senderName = sender ? `${sender.name} ${sender.surname || ''}`.trim() : 'Unknown';
      const recipientName = recipient ? `${recipient.name} ${recipient.surname || ''}`.trim() : 'Unknown';

      await db.collection('moderation_alerts').insertOne({
        source: 'ongame_message',
        onGameMessageId: event.messageId,
        onGameThreadId: event.threadId,
        mailSenderId: event.senderId,
        mailSenderName: senderName,
        mailRecipientId: event.recipientId,
        mailRecipientName: recipientName,
        mailSubject: event.subject,
        mailMessageType: event.messageType,
        characterId: event.senderId,
        characterName: senderName,
        content: event.content.substring(0, 2000), // Truncate to schema limit
        toxicityScore: moderation.score,
        moderationLabel: moderation.label,
        moderationModel: config.moderation.model,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`   🚨 ModerationAlert created: score=${moderation.score} for ${senderName}`);
    } catch (error) {
      console.error('⚠️ Failed to create OnGame ModerationAlert:', error);
    }
  }

  /**
   * Create a ModerationAlert record for a toxic OffGame message
   */
  private async createOffGameModerationAlert(
    event: OffGameMessageModerationEvent,
    moderation: ModerationResult
  ): Promise<void> {
    try {
      const db = mongoose.connection.db;
      if (!db) return;

      // Fetch sender character name
      const Character = mongoose.model('Character');
      const sender = await Character.findById(event.senderId).select('name surname').lean<{ name: string; surname?: string } | null>();

      const senderName = sender ? `${sender.name} ${sender.surname || ''}`.trim() : 'Unknown';

      await db.collection('moderation_alerts').insertOne({
        source: 'offgame_message',
        offGameMessageId: event.messageId,
        offGameThreadId: event.threadId,
        mailSenderId: event.senderId,
        mailSenderName: senderName,
        characterId: event.senderId,
        characterName: senderName,
        content: event.content.substring(0, 2000), // Truncate to schema limit
        toxicityScore: moderation.score,
        moderationLabel: moderation.label,
        moderationModel: config.moderation.model,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`   🚨 ModerationAlert created: score=${moderation.score} for ${senderName}`);
    } catch (error) {
      console.error('⚠️ Failed to create OffGame ModerationAlert:', error);
    }
  }

  /**
   * Save forum post moderation results to MongoDB + embedding to Qdrant + ElasticSearch
   */
  private async saveForumPostEmbeddingAndModeration(
    event: ForumPostEmbeddingEvent,
    embedding: number[],
    moderation: ModerationResult | null
  ): Promise<void> {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const updateFields: any = {};

    if (moderation) {
      updateFields.moderationScore = moderation.score;
      updateFields.moderationLabel = moderation.label;
      updateFields.moderationModel = config.moderation.model;
      updateFields.moderationProcessedAt = new Date();
    }

    if (Object.keys(updateFields).length > 0) {
      const result = await db.collection('forum_posts').updateOne(
        { _id: new mongoose.Types.ObjectId(event.postId) },
        { $set: updateFields }
      );

      if (result.matchedCount === 0) {
        throw new Error(`Forum post not found: ${event.postId}`);
      }
    }

    try {
      await this.qdrant.upsert('forum_posts', {
        wait: true,
        points: [{
          id: this.objectIdToUUID(event.postId),
          vector: embedding,
          payload: {
            postId: event.postId,
            topicSlug: event.topicSlug,
            discussionSlug: event.discussionSlug,
            authorCharacterId: event.authorCharacterId,
            authorCharacterName: event.authorCharacterName,
            type: 'forum_post'
          }
        }]
      });
    } catch (error) {
      console.error('❌ Failed to save to Qdrant (MongoDB saved):', error);
    }

    try {
      await this.elasticsearch.index({
        index: `${config.services.elasticsearch.indexPrefix}_forum_posts`,
        id: event.postId,
        document: {
          postId: event.postId,
          topicSlug: event.topicSlug,
          discussionSlug: event.discussionSlug,
          authorCharacterId: event.authorCharacterId,
          authorCharacterName: event.authorCharacterName,
          content: event.content,
          createdAt: new Date()
        }
      });
    } catch (esError) {
      console.error('❌ Failed to index to ElasticSearch:', esError);
    }
  }

  /**
   * Get AI moderation configuration (cached)
   */
  private async getModerationConfig(): Promise<{ enabled: boolean; threshold: number }> {
    const now = Date.now();
    if (this.moderationConfigCache && (now - this.moderationConfigCacheTime) < config.moderation.configCacheTTL) {
      return this.moderationConfigCache;
    }

    try {
      const db = mongoose.connection.db;
      if (!db) {
        return { enabled: false, threshold: 0.7 };
      }

      const [enabledDoc, thresholdDoc] = await Promise.all([
        db.collection('system_configurations').findOne({ configKey: 'ai_moderation_enabled' }),
        db.collection('system_configurations').findOne({ configKey: 'ai_moderation_threshold' })
      ]);

      this.moderationConfigCache = {
        enabled: enabledDoc?.value === true,
        threshold: typeof thresholdDoc?.value === 'number' ? thresholdDoc.value : 0.7
      };
      this.moderationConfigCacheTime = now;

      return this.moderationConfigCache;
    } catch (error) {
      console.error('⚠️ Failed to read moderation config, defaulting to disabled:', error);
      return { enabled: false, threshold: 0.7 };
    }
  }

  /**
   * Create a ModerationAlert record for a toxic message
   */
  private async createModerationAlert(
    event: ChatEmbeddingEvent,
    locationName: string,
    locationSlug: string,
    moderation: ModerationResult
  ): Promise<void> {
    try {
      const db = mongoose.connection.db;
      if (!db) return;

      await db.collection('moderation_alerts').insertOne({
        source: 'chat',
        chatId: event.chatId,
        characterId: event.characterId,
        characterName: event.characterName,
        locationId: event.locationId,
        locationName,
        locationSlug,
        content: event.content,
        toxicityScore: moderation.score,
        moderationLabel: moderation.label,
        moderationModel: config.moderation.model,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`🚨 ModerationAlert created: score=${moderation.score} for ${event.characterName}`);
    } catch (error) {
      console.error('⚠️ Failed to create ModerationAlert:', error);
    }
  }

  /**
   * Save chat embedding and moderation results to MongoDB + Qdrant
   */
  private async saveChatEmbeddingAndModeration(
    chatId: string,
    locationName: string,
    embedding: number[],
    moderation: ModerationResult | null
  ): Promise<void> {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    const updateFields: any = {
      locationName,
      contentEmbedding: embedding,
      embeddingModel: config.embeddings.model,
      embeddingGeneratedAt: new Date()
    };

    if (moderation) {
      updateFields.moderationScore = moderation.score;
      updateFields.moderationLabel = moderation.label;
      updateFields.moderationModel = config.moderation.model;
      updateFields.moderationProcessedAt = new Date();
    }

    const result = await db.collection('chats').updateOne(
      { _id: new mongoose.Types.ObjectId(chatId) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      throw new Error(`Chat not found: ${chatId}`);
    }

    // Fetch full chat document for Qdrant/ElasticSearch indexing
    const chat = await db.collection('chats').findOne({ _id: new mongoose.Types.ObjectId(chatId) });
    if (!chat) {
      throw new Error(`Chat document not found after update: ${chatId}`);
    }

    // Save to Qdrant (chat_messages collection)
    try {
      await this.qdrant.upsert('chat_messages', {
        wait: true,
        points: [{
          id: this.objectIdToUUID(chatId),
          vector: embedding,
          payload: {
            chatId,
            locationId: chat.locationId?.toString() || '',
            characterId: chat.characterId?.toString() || '',
            characterName: chat.characterName || '',
            actionType: chat.actionType || 'say',
            visibility: chat.visibility || 'public',
            type: 'chat'
          }
        }]
      });
    } catch (error) {
      console.error('❌ Failed to save to Qdrant (MongoDB saved):', error);
    }

    // Save to ElasticSearch (chat_messages index)
    try {
      await this.elasticsearch.index({
        index: `${config.services.elasticsearch.indexPrefix}_chat_messages`,
        id: chatId,
        document: {
          chatId,
          locationId: chat.locationId?.toString() || '',
          characterId: chat.characterId?.toString() || '',
          characterName: chat.characterName || '',
          content: chat.content || '',
          timestamp: chat.timestamp || new Date(),
          actionType: chat.actionType || 'say',
          visibility: chat.visibility || 'public'
        }
      });
    } catch (error) {
      console.error('❌ Failed to save to ElasticSearch (MongoDB+Qdrant saved):', error);
    }
  }

  /**
   * Handle delete event (document, chat, forum_post)
   * Removes embeddings from Qdrant + ElasticSearch
   */
  private async handleDeleteEvent(event: DeleteEmbeddingEvent): Promise<void> {
    try {
      const entityType = event.entityType as string;
      if (entityType === 'location') {
        console.warn('⚠️ Ignoring legacy location delete (locations are not indexed in Qdrant)');
        return;
      }

      console.log(`🗑️  Processing deletion: ${event.entityType} ${event.entityId}`);

      switch (event.entityType) {
        case 'document':
          await this.deleteDocumentEmbeddings(event.entityId);
          break;
        case 'chat':
          await this.deleteChatEmbedding(event.entityId);
          break;
        case 'forum_post':
          await this.deleteForumPostEmbedding(event.entityId);
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
  private detectEventType(data: any):
    | 'document'
    | 'document_chunk'
    | 'chat'
    | 'forum_post'
    | 'delete' {
    if (data.entityType && data.entityId) return 'delete';
    if (data.chunkId) return 'document_chunk';
    if (data.postId && data.topicSlug) return 'forum_post';
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
      embeddingModel: config.embeddings.model,
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
    documentType: 'ambientazione' | 'regolamento' | 'lore'
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
            embeddingModel: config.embeddings.model,
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
        index: `${config.services.elasticsearch.indexPrefix}_document_chunks`,
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
        index: `${config.services.elasticsearch.indexPrefix}_document_chunks`,
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

  // saveChatEmbedding replaced by saveChatEmbeddingAndModeration above

  /**
   * Delete all document chunks (Qdrant + ElasticSearch)
   * Called when a document is deleted
   */
  private async deleteDocumentEmbeddings(documentId: string): Promise<void> {
    try {
      // Delete from ElasticSearch (all chunks for this document)
      await this.elasticsearch.deleteByQuery({
        index: `${config.services.elasticsearch.indexPrefix}_document_chunks`,
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
   * Delete chat embedding from Qdrant
   */
  private async deleteChatEmbedding(chatId: string): Promise<void> {
    try {
      await this.qdrant.delete('chat_messages', {
        wait: true,
        points: [this.objectIdToUUID(chatId)]
      });

      await this.elasticsearch.delete({
        index: `${config.services.elasticsearch.indexPrefix}_chat_messages`,
        id: chatId
      }).catch(() => {});

      console.log(`✅ Deleted chat embedding from Qdrant + ElasticSearch`);
    } catch (error) {
      console.error(`❌ Failed to delete chat:`, error);
      throw error;
    }
  }

  /**
   * Delete forum post embedding from Qdrant + ElasticSearch
   */
  private async deleteForumPostEmbedding(postId: string): Promise<void> {
    try {
      await this.qdrant.delete('forum_posts', {
        wait: true,
        points: [this.objectIdToUUID(postId)]
      });

      await this.elasticsearch.delete({
        index: `${config.services.elasticsearch.indexPrefix}_forum_posts`,
        id: postId
      }).catch(() => {});

      console.log(`✅ Deleted forum post embedding from Qdrant + ElasticSearch`);
    } catch (error) {
      console.error(`❌ Failed to delete forum post:`, error);
      throw error;
    }
  }
}
