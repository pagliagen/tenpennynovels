#!/usr/bin/env tsx
/**
 * Embeddings Worker Service (Unified)
 *
 * - HTTP server on port 5001 (for unified-backend sync calls)
 * - Python subprocess for sentence-transformers
 * - Bull queue for async embedding processing
 * - Dead Letter Queue for failed jobs
 */

// CRITICAL: Load .env BEFORE any imports
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env'
});

import { createClient } from 'redis';
import mongoose from 'mongoose';
import { PythonEmbeddingService } from './services/PythonEmbeddingService';
import { EmbeddingsHttpServer } from './http/EmbeddingsHttpServer';
import { EmbeddingWorker } from './workers/embedding-worker';
import { OllamaChat } from './services/qa/OllamaChat';
import { config } from './config';
import { logger } from './utils/logger';

// Import models to register them with Mongoose
import './models/Document';
import './models/Location';
import './models/Chat';

async function main() {
  logger.info('TenPennyNovels Embeddings Worker starting');
  logger.info('Environment', {
    nodeEnv: config.env.isProduction ? 'production' : 'development',
    httpPort: config.http.port,
    httpHost: config.http.host
  });

  try {
    // 1. Start Python embedding service (model loading can take 60s)
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

    redisSubscriber.on('error', (err: Error) => {
      logger.error('Redis Subscriber error', err);
    });

    redisSubscriber.on('reconnecting', () => {
      logger.info('Redis reconnecting');
    });

    await redisSubscriber.connect();
    logger.info('Connected to Redis');

    // 4. Start embedding worker (uses same Python service)
    logger.info('Starting embedding worker');
    const worker = new EmbeddingWorker(redisSubscriber, pythonService);
    await worker.start();
    logger.info('Embedding worker started');

    // 5. Start HTTP server (for unified-backend sync calls) - pass worker for health stats
    logger.info('Starting HTTP server');
    const httpServer = new EmbeddingsHttpServer(pythonService, worker);
    await httpServer.start();
    logger.info('HTTP server listening', { port: config.http.port, host: config.http.host });

    // Warm up the RAG model so it stays resident in Ollama (non-blocking: /ask
    // still works without this, just with a cold-start delay on the first call)
    new OllamaChat().warmup()
      .then(() => logger.info('Ollama model warmed up and locked in memory', { model: config.services.ollama.model }))
      .catch((err: Error) => logger.warn('Ollama warmup failed (will load on first request)', { error: err.message }));

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

    logger.info('Embeddings service running', {
      httpUrl: `http://${config.http.host}:${config.http.port}`
    });

  } catch (error) {
    logger.error('Fatal startup error', error as Error);
    process.exit(1);
  }
}

main();
