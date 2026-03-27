---
type: rules
category: backend
scope: embeddings-worker
criticality: high
last_updated: 2026-03-27
---

# Embeddings Worker Service

Async embedding generation, Qdrant vector storage, semantic search processing with Bull queue, Redis cache, and Python subprocess for sentence-transformers model.

**Port:** 5001 (internal only - accessed by unified-backend)
**Deployment:** PM2 fork mode (1 instance)
**Tech Stack:** Express (HTTP endpoint), Bull (queue), Python subprocess, Qdrant, ElasticSearch, Redis

**Memory reference:** 2026-02-23 - Docker embeddings + semantic search architecture production-ready.

## Architecture Overview

```
[Unified Backend]
    ↓
    ├─ Async: Redis pub/sub → [Bull Queue] → [Embedding Worker]
    │                               ↓
    │                         [Python Service] (sentence-transformers)
    │                               ↓
    │                         [Qdrant] (vector storage)
    │                               ↓
    │                         [ElasticSearch] (full-text search)
    │
    └─ Sync: HTTP POST /embed → [Python Service] → Response
```

### Components

1. **HTTP Server (Express 5001):** Sync embedding generation endpoint
2. **Bull Queue:** Async job processing with retry, concurrency control
3. **Python Service:** Subprocess running sentence-transformers model
4. **Qdrant:** Vector database for ANN (Approximate Nearest Neighbor) search
5. **ElasticSearch:** Full-text search index (keyword matching)
6. **Redis Cache:** MD5 hash-based caching (1h TTL)
7. **Dead Letter Queue (DLQ):** Failed job storage with retry flag

## Service Orchestration

**File:** `services/embeddings-worker/src/index.ts`

```typescript
#!/usr/bin/env tsx

// CRITICAL: Load .env BEFORE any imports
require('dotenv').config();

import { createClient } from 'redis';
import mongoose from 'mongoose';
import { PythonEmbeddingService } from './services/PythonEmbeddingService';
import { EmbeddingsHttpServer } from './http/EmbeddingsHttpServer';
import { EmbeddingWorker } from './workers/embedding-worker';
import { config } from './config';
import { logger } from './utils/logger';

async function main() {
  logger.info('TenPennyNovels Embeddings Worker starting');

  try {
    // 1. Start Python embedding service (model loading ~60s)
    logger.info('Starting Python embedding service');
    const pythonService = new PythonEmbeddingService();
    await pythonService.start();
    logger.info('Python embedding service ready');

    // 2. Connect to MongoDB
    logger.info('Connecting to MongoDB');
    await mongoose.connect(config.database.mongodbUri);
    logger.info('Connected to MongoDB');

    // 3. Connect to Redis
    logger.info('Connecting to Redis');
    const redisSubscriber = createClient({ url: config.database.redisUrl });
    await redisSubscriber.connect();
    logger.info('Connected to Redis');

    // 4. Start embedding worker (Bull queue)
    logger.info('Starting embedding worker');
    const worker = new EmbeddingWorker(redisSubscriber, pythonService);
    await worker.start();
    logger.info('Embedding worker started');

    // 5. Start HTTP server (sync endpoint)
    logger.info('Starting HTTP server');
    const httpServer = new EmbeddingsHttpServer(pythonService, worker);
    await httpServer.start();
    logger.info('HTTP server listening', { port: config.http.port });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info('Shutting down gracefully', { signal });

      // Stop in reverse order
      await worker.stop();
      await httpServer.stop();
      await pythonService.stop();
      await redisSubscriber.disconnect();
      await mongoose.disconnect();

      logger.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    logger.error('Fatal startup error', error as Error);
    process.exit(1);
  }
}

main();
```

## Bull Queue Configuration

**File:** `services/embeddings-worker/src/workers/embedding-worker.ts`

### Queue Setup

```typescript
import Bull from 'bull';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';

export class EmbeddingWorker {
  private queue: Bull.Queue;
  private qdrant: QdrantClient;
  private elasticsearch: ElasticsearchClient;
  private pythonService: PythonEmbeddingService;
  private redis: any; // Redis cache client

  constructor(redisSubscriber: any, pythonService: PythonEmbeddingService) {
    this.pythonService = pythonService;

    // ✅ Qdrant client (vector database)
    this.qdrant = new QdrantClient({ url: config.services.qdrant.url });

    // ✅ ElasticSearch client (full-text search)
    this.elasticsearch = new ElasticsearchClient({ node: config.services.elasticsearch.url });

    // ✅ Bull queue with retry and backoff
    this.queue = new Bull('embeddings', {
      redis: config.database.redisUrl,
      defaultJobOptions: {
        attempts: config.queue.maxAttempts,      // 3 attempts
        backoff: {
          type: 'exponential',
          delay: config.queue.backoffDelay       // 5000ms → 25s → 125s
        },
        removeOnComplete: config.queue.keepCompleted, // Keep 100 completed jobs
        removeOnFail: false                      // DON'T auto-remove (use DLQ)
      }
    });

    // ✅ Process jobs with concurrency
    this.queue.process(config.queue.concurrency, async (job) => {
      return this.processEmbedding(job.data);
    });

    // ✅ Event listeners
    this.queue.on('completed', (job, result) => {
      logger.info('Job completed', { jobId: job.id, result });
    });

    // ✅ Failed job → Dead Letter Queue
    this.queue.on('failed', async (job, err) => {
      logger.error('Job failed', { jobId: job.id, attempts: job.attemptsMade, error: err.message });

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

        // Safe to remove from Bull queue
        await job.remove();
      }
    });
  }
}
```

### Queue Configuration Values

```typescript
// config/index.ts
export const config = {
  queue: {
    concurrency: 5,         // Process 5 jobs in parallel
    maxAttempts: 3,         // Retry up to 3 times
    backoffDelay: 5000,     // 5s → 25s → 125s (exponential)
    keepCompleted: 100      // Keep last 100 completed jobs for debugging
  }
};
```

### Why These Values?

- **Concurrency 5:** Python model is CPU-bound (~1.5s per embedding). 5 concurrent jobs balance throughput vs CPU saturation.
- **MaxAttempts 3:** Transient errors (network issues) usually resolve in 2-3 retries. Permanent errors (bad data) won't improve.
- **Exponential backoff:** Gives external services (Qdrant, ElasticSearch) time to recover from temporary overload.

## Python Embedding Service

**File:** `services/embeddings-worker/src/services/PythonEmbeddingService.ts`

### Subprocess Management

```typescript
import { spawn, ChildProcess } from 'child_process';
import { logger } from '../utils/logger';

export class PythonEmbeddingService {
  private process: ChildProcess | null = null;
  private isReady: boolean = false;

  /**
   * Start Python subprocess (sentence-transformers model)
   * Model loading takes ~60s on first start
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info('Spawning Python embedding service');

      this.process = spawn('python3', ['embedding_service.py'], {
        cwd: process.cwd(),
        env: { ...process.env }
      });

      this.process.stdout?.on('data', (data) => {
        const message = data.toString().trim();
        logger.info(`[Python] ${message}`);

        if (message.includes('Model loaded successfully')) {
          this.isReady = true;
          resolve();
        }
      });

      this.process.stderr?.on('data', (data) => {
        logger.error(`[Python] ${data.toString().trim()}`);
      });

      this.process.on('error', (error) => {
        logger.error('Python process error', { error });
        reject(error);
      });

      this.process.on('exit', (code) => {
        logger.warn('Python process exited', { code });
        this.isReady = false;
      });

      // Timeout if model doesn't load in 120s
      setTimeout(() => {
        if (!this.isReady) {
          reject(new Error('Python service startup timeout'));
        }
      }, 120000);
    });
  }

  /**
   * Generate embedding (HTTP call to Python subprocess)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isReady) {
      throw new Error('Python service not ready');
    }

    try {
      const response = await fetch('http://localhost:5002/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error(`Python service error: ${response.status}`);
      }

      const data = await response.json();
      return data.embedding;
    } catch (error) {
      logger.error('Embedding generation error', { error, text: text.substring(0, 100) });
      throw error;
    }
  }

  /**
   * Stop Python subprocess
   */
  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.isReady = false;
      logger.info('Python service stopped');
    }
  }
}
```

### Python Service (Flask)

```python
# embedding_service.py
from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer

app = Flask(__name__)

# Load model (paraphrase-multilingual-MiniLM-L12-v2, 384 dimensions)
print("Loading model...")
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
print("Model loaded successfully")

@app.route('/embed', methods=['POST'])
def embed():
    data = request.json
    text = data.get('text', '')

    if not text:
        return jsonify({'error': 'Text is required'}), 400

    # Generate embedding
    embedding = model.encode(text).tolist()

    return jsonify({'embedding': embedding})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002)
```

## Qdrant Integration (Vector Storage)

### Collection Setup

```typescript
async ensureCollections(): Promise<void> {
  logger.info('Checking Qdrant collections');

  const collections = await this.qdrant.getCollections();

  // ✅ document_chunks collection (most important)
  const hasDocumentChunks = collections.collections.some(c => c.name === 'document_chunks');
  if (!hasDocumentChunks) {
    logger.info('Creating Qdrant collection: document_chunks');
    await this.qdrant.createCollection('document_chunks', {
      vectors: {
        size: 384,           // paraphrase-multilingual-MiniLM-L12-v2
        distance: 'Cosine'   // Cosine similarity
      }
    });
  }

  // ✅ documents collection (L1/L2 full documents)
  const hasDocuments = collections.collections.some(c => c.name === 'documents');
  if (!hasDocuments) {
    logger.info('Creating Qdrant collection: documents');
    await this.qdrant.createCollection('documents', {
      vectors: {
        size: 384,
        distance: 'Cosine'
      }
    });
  }

  // ✅ forum_posts collection
  const hasForumPosts = collections.collections.some(c => c.name === 'forum_posts');
  if (!hasForumPosts) {
    logger.info('Creating Qdrant collection: forum_posts');
    await this.qdrant.createCollection('forum_posts', {
      vectors: {
        size: 384,
        distance: 'Cosine'
      }
    });
  }

  // ✅ chat_messages collection
  const hasChatMessages = collections.collections.some(c => c.name === 'chat_messages');
  if (!hasChatMessages) {
    logger.info('Creating Qdrant collection: chat_messages');
    await this.qdrant.createCollection('chat_messages', {
      vectors: {
        size: 384,
        distance: 'Cosine'
      }
    });
  }
}
```

### Point ID Format (CRITICAL)

**Memory reference:** 2026-02-23 - Fixed UUID format for Qdrant point IDs (NOT MongoDB ObjectId).

Qdrant requires UUID format for point IDs. MongoDB ObjectId is 24 hex chars, UUID is 32 hex chars with dashes.

```typescript
/**
 * Convert MongoDB ObjectId to UUID format
 * CRITICAL: Qdrant requires UUID, NOT ObjectId
 */
private objectIdToUUID(objectId: string): string {
  // Convert MongoDB ObjectId (24 hex chars) to UUID format (32 hex chars with dashes)
  // Format: 8-4-4-4-12 hex digits
  const hex = objectId.padEnd(32, '0'); // Pad to 32 chars
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}
```

### Upsert Pattern

```typescript
async handleDocumentEmbedding(event: DocumentEmbeddingEvent): Promise<void> {
  const { documentId, title, content } = event;

  // Generate embedding
  const embedding = await this.pythonService.generateEmbedding(content);

  // ✅ Upsert to Qdrant (UUID point ID)
  await this.qdrant.upsert('documents', {
    wait: true,
    points: [{
      id: this.objectIdToUUID(documentId),  // ✅ UUID format
      vector: embedding,
      payload: {
        documentId,                          // ✅ Original ObjectId in payload
        documentType: 'documento',           // ✅ Type for filtering
        title,
        content: content.substring(0, 500),  // Truncate for payload
        updatedAt: Date.now()
      }
    }]
  });

  logger.info('Document embedding stored', { documentId });
}
```

### Semantic Search Pattern

```typescript
async semanticSearch(query: string, limit: number = 10, type?: string): Promise<any[]> {
  // Generate query embedding
  const queryEmbedding = await this.pythonService.generateEmbedding(query);

  // Build filter (type-based)
  const filter = type ? {
    must: [{ key: 'documentType', match: { value: type } }]
  } : undefined;

  // ✅ Search Qdrant
  const results = await this.qdrant.search('documents', {
    vector: queryEmbedding,
    limit,
    filter,
    with_payload: true
  });

  return results.map(result => ({
    documentId: result.payload.documentId,  // ✅ Extract documentId from payload (NOT result.id)
    title: result.payload.title,
    score: result.score,
    type: result.payload.documentType
  }));
}
```

### CRITICAL: documentId from Payload

**Memory reference:** 2026-02-23 - Fixed semantic search UUID bug.

```typescript
// ✅ CORRECT - Extract documentId from payload
const documentId = result.payload.documentId;

// ❌ WRONG - result.id is UUID, not MongoDB ObjectId
const documentId = result.id; // ❌ UUID format, can't query MongoDB
```

## Redis Cache Pattern

**Pattern:** MD5 hash-based caching with 1h TTL.

```typescript
import crypto from 'crypto';

/**
 * Generate embedding with cache
 */
async generateEmbeddingCached(text: string): Promise<number[]> {
  // Generate cache key (MD5 hash of text)
  const hash = crypto.createHash('md5').update(text).digest('hex');
  const cacheKey = `embedding:${hash}`;

  // Check cache
  const cached = await this.redis.get(cacheKey);
  if (cached) {
    logger.debug('Cache hit', { hash });
    return JSON.parse(cached);
  }

  // Generate embedding
  logger.debug('Cache miss, generating embedding', { hash });
  const embedding = await this.pythonService.generateEmbedding(text);

  // Store in cache (1h TTL)
  await this.redis.setex(cacheKey, 3600, JSON.stringify(embedding));

  return embedding;
}
```

### Performance Impact

- **First time:** ~1.5s (Python model inference)
- **Cached:** ~50ms (Redis lookup)
- **Cache hit rate:** ~80% for repeated queries (e.g., semantic search on same documents)

## Dead Letter Queue (DLQ)

**Pattern:** Failed jobs (after 3 retries) go to DLQ for manual inspection.

```typescript
// services/DLQService.ts
import { redis } from '../config/redis';

export class DLQService {
  private static DLQ_KEY = 'dlq:embeddings';

  /**
   * Add failed job to Dead Letter Queue
   */
  static async addFailedJob(
    jobId: string,
    eventType: string,
    eventData: any,
    errorMessage: string,
    attempts: number,
    retryable: boolean
  ): Promise<void> {
    const dlqEntry = {
      jobId,
      eventType,
      eventData,
      errorMessage,
      attempts,
      retryable,
      timestamp: Date.now()
    };

    await redis.lpush(this.DLQ_KEY, JSON.stringify(dlqEntry));
    logger.warn('Job moved to DLQ', { jobId, eventType, errorMessage });
  }

  /**
   * Get all DLQ entries
   */
  static async getAllEntries(): Promise<any[]> {
    const entries = await redis.lrange(this.DLQ_KEY, 0, -1);
    return entries.map(entry => JSON.parse(entry));
  }

  /**
   * Retry DLQ entry
   */
  static async retryEntry(jobId: string, queue: Bull.Queue): Promise<void> {
    const entries = await this.getAllEntries();
    const entry = entries.find(e => e.jobId === jobId);

    if (!entry) {
      throw new Error(`DLQ entry ${jobId} not found`);
    }

    if (!entry.retryable) {
      throw new Error(`Job ${jobId} is not retryable (permanent error)`);
    }

    // Re-add to Bull queue
    await queue.add(entry.eventType, entry.eventData);

    // Remove from DLQ
    await redis.lrem(this.DLQ_KEY, 1, JSON.stringify(entry));

    logger.info('DLQ entry retried', { jobId });
  }
}
```

### Permanent vs Retryable Errors

```typescript
/**
 * Check if error is permanent (won't improve with retry)
 */
private isPermanentError(err: Error): boolean {
  const message = err.message.toLowerCase();

  // Validation errors (bad data)
  if (message.includes('validation') || message.includes('invalid')) {
    return true;
  }

  // Model errors (bad input)
  if (message.includes('model error') || message.includes('encoding failed')) {
    return true;
  }

  // Network/timeout errors are retryable
  return false;
}
```

## HTTP Endpoint (Sync Embedding)

**File:** `services/embeddings-worker/src/http/EmbeddingsHttpServer.ts`

```typescript
import express from 'express';
import { PythonEmbeddingService } from '../services/PythonEmbeddingService';

export class EmbeddingsHttpServer {
  private app: express.Application;
  private server: any;
  private pythonService: PythonEmbeddingService;

  constructor(pythonService: PythonEmbeddingService, worker: EmbeddingWorker) {
    this.app = express();
    this.pythonService = pythonService;

    this.app.use(express.json({ limit: '10mb' }));

    // Health check endpoint
    this.app.get('/health', async (_req, res) => {
      const pythonReady = this.pythonService.isReady();
      const queueStats = await worker.getStats();

      res.json({
        success: true,
        data: {
          status: pythonReady ? 'healthy' : 'unhealthy',
          python: pythonReady ? 'ready' : 'not ready',
          queue: queueStats,
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        }
      });
    });

    // Sync embedding endpoint
    this.app.post('/embed', async (req, res) => {
      try {
        const { text } = req.body;

        if (!text) {
          return res.status(400).json({
            success: false,
            error: 'Text is required',
            code: 'MISSING_TEXT'
          });
        }

        const embedding = await this.pythonService.generateEmbedding(text);

        res.json({
          success: true,
          data: { embedding, dimensions: embedding.length }
        });
      } catch (error) {
        logger.error('Embedding generation error', { error });
        res.status(500).json({
          success: false,
          error: 'Embedding generation failed',
          code: 'EMBEDDING_ERROR'
        });
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(config.http.port, config.http.host, () => {
        logger.info('HTTP server started', { port: config.http.port });
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('HTTP server stopped');
        resolve();
      });
    });
  }
}
```

## ElasticSearch Integration (Full-Text Search)

Used alongside Qdrant for hybrid search (semantic + keyword).

```typescript
// Upsert to ElasticSearch
await this.elasticsearch.index({
  index: `${config.services.elasticsearch.indexPrefix}_document_chunks`,
  id: documentId,
  body: {
    documentId,
    title,
    content,
    documentType: 'documento',
    updatedAt: Date.now()
  }
});

// Full-text search
const results = await this.elasticsearch.search({
  index: `${config.services.elasticsearch.indexPrefix}_document_chunks`,
  body: {
    query: {
      multi_match: {
        query: searchQuery,
        fields: ['title^2', 'content'], // Boost title 2x
        fuzziness: 'AUTO'
      }
    },
    size: limit
  }
});
```

## Docker Image Update Pattern

**Memory reference:** 2026-02-23 - Docker stop + up pattern (not restart).

When updating embeddings-worker Docker image, use `stop + up` (not `restart`):

```bash
# ❌ WRONG - Doesn't pick up new image
docker-compose restart embeddings-worker

# ✅ CORRECT - Recreates container from new image
docker-compose stop embeddings-worker
docker-compose up -d embeddings-worker
```

### Why?

`docker-compose restart` reuses existing container (doesn't pull new image). `stop + up` recreates container from latest image.

## Performance Benchmarks

### Embedding Generation
- **First time (no cache):** ~1.5s
- **Cached:** ~50ms
- **Model:** paraphrase-multilingual-MiniLM-L12-v2 (384 dimensions)

### Semantic Search
- **Total:** ~500ms
  - Embedding generation: ~50ms (cached) or ~1.5s (uncached)
  - Qdrant ANN search: ~100ms
  - MongoDB document fetch: ~50ms
- **Type filter:** Works correctly (`?type=ambientazione`)

### Queue Throughput
- **Concurrency:** 5 jobs in parallel
- **Throughput:** ~3-4 embeddings/second (uncached)
- **Throughput:** ~100 embeddings/second (cached)

## Event Types

### Document Embedding Event

```typescript
interface DocumentEmbeddingEvent {
  documentId: string;
  title: string;
  content: string;
  documentType: 'documento' | 'ambientazione' | 'regolamento';
}
```

### Document Chunk Embedding Event

```typescript
interface DocumentChunkEmbeddingEvent {
  documentId: string;
  chunkId: string;
  title: string;
  content: string;
  chunkIndex: number;
}
```

### Chat Embedding Event

```typescript
interface ChatEmbeddingEvent {
  messageId: string;
  content: string;
  characterId: string;
  locationId: string;
}
```

### Forum Post Embedding Event

```typescript
interface ForumPostEmbeddingEvent {
  postId: string;
  title: string;
  content: string;
  authorId: string;
}
```

### Delete Embedding Event

```typescript
interface DeleteEmbeddingEvent {
  targetId: string;
  targetType: 'document' | 'chat' | 'forum_post';
}
```

## Cross-References

- **Logger patterns:** See shared-backend.md → Winston Logger
- **Redis pub/sub:** See unified-backend.md → Redis Pub/Sub Pattern
- **Bull queue:** Official docs - https://github.com/OptimalBits/bull
- **Qdrant:** Official docs - https://qdrant.tech/documentation/

## Incidents & Lessons Learned

### Incident: Bull Queue Job Types (2026-02-23)
**Problem:** Bull queue processor had type parameter causing runtime errors.

**Solution:** Removed type parameter, used generic processor `queue.process(concurrency, async (job) => ...)`.

**Pattern:** Bull v3 doesn't support typed job processors. Use generic processor and validate job.data manually.

### Incident: ObjectId → UUID Conversion (2026-02-23)
**Problem:** Qdrant rejected MongoDB ObjectId format (24 hex chars) for point IDs.

**Root Cause:** Qdrant expects UUID format (32 hex chars with dashes: 8-4-4-4-12).

**Solution:** Created `objectIdToUUID()` helper to convert MongoDB ObjectId to UUID format.

**Pattern:** Always convert MongoDB ObjectId to UUID before storing in Qdrant. Keep original ObjectId in payload for MongoDB queries.

### Incident: Semantic Search UUID Bug (2026-02-23)
**Problem:** Semantic search returned UUID as documentId, causing MongoDB queries to fail.

**Root Cause:** Used `result.id` (UUID) instead of `result.payload.documentId` (ObjectId).

**Solution:** Extract documentId from payload: `result.payload.documentId`.

**Pattern:** Qdrant point IDs are UUIDs (for internal use). Use payload fields for external references (MongoDB ObjectId, etc.).

### Incident: Type Filter Hardcoded (2026-02-23)
**Problem:** Type filter used hardcoded `type: 'document'` instead of payload field `documentType`.

**Root Cause:** Payload field was `documentType`, but filter checked `type`.

**Solution:** Fixed filter to use correct payload field:

```typescript
// ✅ CORRECT
const filter = type ? {
  must: [{ key: 'documentType', match: { value: type } }]
} : undefined;

// ❌ WRONG (field doesn't exist)
const filter = { must: [{ key: 'type', match: { value: 'document' } }] };
```

**Pattern:** Verify payload field names match Qdrant filter keys. Use dynamic filters, not hardcoded values.

### Incident: Docker Image Not Updating (2026-02-23)
**Problem:** `docker-compose restart` didn't pick up new image after build.

**Root Cause:** `restart` reuses existing container, doesn't pull new image.

**Solution:** Use `stop + up` pattern:

```bash
docker-compose stop embeddings-worker
docker-compose up -d embeddings-worker
```

**Pattern:** After building new Docker image, always use `stop + up` (not `restart`) to ensure container is recreated from latest image.

---

**Next:** See shared-backend.md for common patterns, unified-backend.md for Redis pub/sub, api-gateway.md for proxy patterns.
