#!/usr/bin/env tsx
/**
 * Embeddings Worker Service
 *
 * Subscribes to Redis events and generates embeddings asynchronously
 * for Documents and LocationActions
 */

// CRITICAL: Load .env BEFORE any imports
require('dotenv').config();

import { createClient } from 'redis';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { EmbeddingWorker } from './workers/embedding-worker';

// Import models to register them with Mongoose
import './models/Document';
import './models/Location';
import './models/LocationAction';

// Load environment variables
dotenv.config({ override: true });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tenpennynovels';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function main() {
  console.log('🌱 TenpennyNovels Embeddings Worker');
  console.log('===================================\n');

  try {
    // Connect to MongoDB
    console.log('📊 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Connect to Redis
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

    // Start worker
    const worker = new EmbeddingWorker(redisSubscriber);
    await worker.start();

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Received SIGINT, shutting down gracefully...');
      await worker.stop();
      await redisSubscriber.disconnect();
      await mongoose.disconnect();
      console.log('✅ Shutdown complete');
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n\n🛑 Received SIGTERM, shutting down gracefully...');
      await worker.stop();
      await redisSubscriber.disconnect();
      await mongoose.disconnect();
      console.log('✅ Shutdown complete');
      process.exit(0);
    });

    console.log('✨ Worker is running. Press Ctrl+C to stop.\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
