/**
 * Migration: Remove unique constraint from CharacterSession index
 *
 * WHY:
 * - Current: { characterId: 1, isActive: 1 } with unique: true (1 character = 1 active session)
 * - Problem: Prevents multi-tab support (Tab B invalidates Tab A session)
 * - Solution: Remove unique constraint (1 character = multiple active sessions)
 *
 * NEW FLOW:
 * - Each tab has its own sessionId (UUID in Redis)
 * - MongoDB CharacterSession is kept for audit log only
 * - Active session management in Redis (SessionStore)
 *
 * SAFETY:
 * - This migration is IDEMPOTENT (safe to run multiple times)
 * - Checks if old index exists before dropping
 * - Creates new index only if needed
 *
 * HOW TO RUN:
 * ```bash
 * cd services/unified-backend
 * npx ts-node scripts/migrations/001-remove-character-session-unique-constraint.ts
 * ```
 *
 * @since 2026-03-21
 */

import mongoose from 'mongoose';
import { appConfig } from '../../src/config/runtime';

const OLD_INDEX_NAME = 'characterId_1_isActive_1';
const NEW_INDEX_SPEC = { characterId: 1, isActive: 1 };

async function migrate() {
  try {
    console.log('🔧 Starting CharacterSession index migration...\n');

    // 1. Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    const mongoUri = appConfig.db.mongoUrl || process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGODB_URI not configured');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB:', mongoUri.replace(/\/\/.*@/, '//<credentials>@'), '\n');

    // 2. Get CharacterSession collection
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection not established');
    }

    const collection = db.collection('character_sessions');

    // 3. List existing indexes
    console.log('📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach((index) => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(UNIQUE)' : '');
    });
    console.log('');

    // 4. Check if old index exists
    const oldIndexExists = indexes.some(index => index.name === OLD_INDEX_NAME && index.unique === true);

    if (oldIndexExists) {
      console.log(`⚠️  Found old UNIQUE index: ${OLD_INDEX_NAME}`);
      console.log('🗑️  Dropping old index...');

      await collection.dropIndex(OLD_INDEX_NAME);
      console.log(`✅ Dropped old index: ${OLD_INDEX_NAME}\n`);
    } else {
      console.log(`ℹ️  Old UNIQUE index not found (already migrated or never existed)\n`);
    }

    // 5. Check if new index exists
    const newIndexExists = indexes.some(
      index =>
        JSON.stringify(index.key) === JSON.stringify(NEW_INDEX_SPEC) &&
        !index.unique
    );

    if (!newIndexExists) {
      console.log('🔨 Creating new NON-UNIQUE index...');
      console.log(`   Index spec: ${JSON.stringify(NEW_INDEX_SPEC)}`);

      await collection.createIndex(NEW_INDEX_SPEC, { name: OLD_INDEX_NAME });
      console.log(`✅ Created new index: ${OLD_INDEX_NAME} (NON-UNIQUE)\n`);
    } else {
      console.log(`ℹ️  New NON-UNIQUE index already exists\n`);
    }

    // 6. Verify final state
    console.log('🔍 Verifying migration result:');
    const finalIndexes = await collection.indexes();
    const targetIndex = finalIndexes.find(
      index => JSON.stringify(index.key) === JSON.stringify(NEW_INDEX_SPEC)
    );

    if (targetIndex) {
      console.log(`✅ Index ${targetIndex.name}: ${JSON.stringify(targetIndex.key)}`);
      console.log(`   Unique: ${targetIndex.unique ? 'YES ❌' : 'NO ✅'}`);
      console.log(`   Partial: ${targetIndex.partialFilterExpression ? 'YES' : 'NO'}`);
    } else {
      throw new Error('Target index not found after migration');
    }

    // 7. Count active sessions (validation)
    console.log('\n📊 Active sessions stats:');
    const activeSessions = await collection.countDocuments({ isActive: true });
    const totalSessions = await collection.countDocuments({});
    console.log(`   Active sessions: ${activeSessions}`);
    console.log(`   Total sessions: ${totalSessions}`);

    // Check for duplicate active sessions (expected after multi-tab support)
    const duplicateCharacters = await collection.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$characterId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    if (duplicateCharacters.length > 0) {
      console.log(`\n⚠️  Characters with multiple active sessions: ${duplicateCharacters.length}`);
      console.log('   This is EXPECTED with multi-tab support ✅');
      duplicateCharacters.slice(0, 5).forEach(doc => {
        console.log(`   - Character ${doc._id}: ${doc.count} active sessions`);
      });
    } else {
      console.log('\n✅ No duplicate active sessions (yet)');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('📝 Summary:');
    console.log('   - Old UNIQUE constraint removed');
    console.log('   - New NON-UNIQUE index created');
    console.log('   - Multi-tab support enabled ✅');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    // Cleanup
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\n🎉 Migration script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });
