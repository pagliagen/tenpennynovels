#!/usr/bin/env tsx
/**
 * Re-publish embedding events for all documents
 * Use this when embeddings-worker was down during seeding
 */

import mongoose from 'mongoose';
import { createClient } from 'redis';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: join(__dirname, '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function main() {
  console.log('🔄 Re-publishing embedding events for all documents...\n');

  // Connect to MongoDB
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Connect to Redis
  const redis = createClient({ url: REDIS_URL });
  await redis.connect();
  console.log('✅ Connected to Redis\n');

  // Get all documents
  const db = mongoose.connection.db;
  const documentsCol = db.collection('documents');
  const allDocs = await documentsCol.find({}).toArray();

  console.log(`📄 Found ${allDocs.length} documents\n`);
  console.log('📝 Publishing events...');

  let published = 0;
  for (const doc of allDocs) {
    try {
      const event = {
        eventId: crypto.randomUUID(),
        timestamp: new Date(),
        documentId: doc._id.toString(),
        title: doc.title,
        content: doc.content || '',
        contentDelta: doc.contentDelta,
        type: doc.type
      };

      await redis.publish('embedding:document:created', JSON.stringify(event));
      published++;

      if (published % 10 === 0) {
        console.log(`   Published ${published}/${allDocs.length} events...`);
      }
    } catch (error) {
      console.error(`   ⚠️  Failed to publish event for ${doc.slug}:`, error);
    }
  }

  console.log(`\n✅ Published ${published} embedding events successfully\n`);

  // Wait a bit for events to be queued
  console.log('⏳ Waiting 5 seconds for events to be queued...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Cleanup
  await redis.quit();
  await mongoose.disconnect();

  console.log('✅ Done!');
  console.log('\n💡 Check worker logs: docker logs -f tenpennynovels-embeddings-worker');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
