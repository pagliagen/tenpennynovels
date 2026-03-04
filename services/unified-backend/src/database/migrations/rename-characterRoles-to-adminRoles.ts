/**
 * Migration: Rename characterRoles → adminRoles
 *
 * Context: Admin panel permissions refactor
 * - Clarifies that characterRoles are specifically for admin panel (vs gameplayRoles for game)
 * - Adds 'amministratore' to enum
 * - Sets default ['personaggio'] for all characters without adminRoles
 *
 * Run with: npx ts-node src/database/migrations/rename-characterRoles-to-adminRoles.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin';

async function migrate() {
  try {
    console.log('[Migration] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('[Migration] Connected successfully');

    const db = mongoose.connection.db!;
    const charactersCollection = db.collection('characters');

    // Count documents that need migration
    const needMigration = await charactersCollection.countDocuments({
      characterRoles: { $exists: true }
    });

    console.log(`[Migration] Found ${needMigration} characters with characterRoles field`);

    if (needMigration === 0) {
      console.log('[Migration] No documents to migrate. Exiting.');
      await mongoose.connection.close();
      return;
    }

    // Rename field: characterRoles → adminRoles
    const result = await charactersCollection.updateMany(
      { characterRoles: { $exists: true } },
      { $rename: { characterRoles: 'adminRoles' } }
    );

    console.log(`[Migration] Renamed field in ${result.modifiedCount} documents`);

    // Set default ['personaggio'] for characters without adminRoles
    const setDefaultResult = await charactersCollection.updateMany(
      {
        adminRoles: { $exists: false },
        isGestore: { $ne: true }  // Don't force default on gestore
      },
      { $set: { adminRoles: ['personaggio'] } }
    );

    console.log(`[Migration] Set default adminRoles for ${setDefaultResult.modifiedCount} characters`);

    // Verify migration
    const withAdminRoles = await charactersCollection.countDocuments({
      adminRoles: { $exists: true }
    });
    const withOldField = await charactersCollection.countDocuments({
      characterRoles: { $exists: true }
    });

    console.log('[Migration] Verification:');
    console.log(`  - Documents with adminRoles: ${withAdminRoles}`);
    console.log(`  - Documents with characterRoles (old): ${withOldField}`);

    if (withOldField > 0) {
      console.warn('[Migration] WARNING: Some documents still have characterRoles field!');
    } else {
      console.log('[Migration] ✅ Migration completed successfully!');
    }

    await mongoose.connection.close();
    console.log('[Migration] Connection closed');
  } catch (error) {
    console.error('[Migration] ERROR:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run migration
migrate();
