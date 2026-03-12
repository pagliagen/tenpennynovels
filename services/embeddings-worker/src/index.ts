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
require('dotenv').config();

import { createClient } from 'redis';
import mongoose from 'mongoose';
import { PythonEmbeddingService } from './services/PythonEmbeddingService';
import { EmbeddingsHttpServer } from './http/EmbeddingsHttpServer';
import { EmbeddingWorker } from './workers/embedding-worker';

// Import models to register them with Mongoose
import './models/Document';
import './models/Location';
import './models/Chat';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tenpennynovels';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '5001', 10);
const PYTHON_PATH = process.env.PYTHON_PATH || 'python3';

async function main() {
  console.log('🌱 TenPennyNovels Embeddings Worker (Unified)');
  console.log('============================================\n');

  try {
    // 1. Start Python embedding service (model loading can take 60s)
    console.log('🐍 Starting Python embedding service...');
    const pythonService = new PythonEmbeddingService(PYTHON_PATH);
    await pythonService.start();
    console.log('✅ Python embedding service ready\n');

    // 2. Connect to MongoDB
    console.log('📊 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // 3. Connect to Redis
    console.log('🔌 Connecting to Redis...');
    const redisSubscriber = createClient({ url: REDIS_URL });

    redisSubscriber.on('error', (err: Error) => {
      console.error('Redis Subscriber Error:', err);
    });

    redisSubscriber.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });

    await redisSubscriber.connect();
    console.log('✅ Connected to Redis\n');

    // 4. Start HTTP server (for unified-backend sync calls)
    console.log('🌐 Starting HTTP server...');
    const httpServer = new EmbeddingsHttpServer(pythonService, HTTP_PORT);
    await httpServer.start();
    console.log('✅ HTTP server listening on port', HTTP_PORT, '\n');

    // 5. Start embedding worker (uses same Python service)
    console.log('⚙️  Starting embedding worker...');
    const worker = new EmbeddingWorker(redisSubscriber, pythonService);
    await worker.start();
    console.log('✅ Embedding worker started\n');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n\n🛑 Received ${signal}, shutting down gracefully...`);

      // Stop in reverse order
      await worker.stop();
      await httpServer.stop();
      await pythonService.stop();
      await redisSubscriber.disconnect();
      await mongoose.disconnect();

      console.log('✅ Shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    console.log('✨ Unified embeddings service running');
    console.log(`   HTTP: http://127.0.0.1:${HTTP_PORT}`);
    console.log(`   Press Ctrl+C to stop\n`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
