/**
 * Migration: Add characterType field to Character model
 * Sets default 'pg_principale' for all existing characters
 *
 * Date: 2026-03-16
 */

import { getConnection } from '../seeders/utils/connection.js';

async function main() {
  console.log('🔧 Adding characterType field to Character model\n');

  const { client, db } = await getConnection();

  try {
    const collection = db.collection('characters');

    // Set default characterType = 'pg_principale' for existing characters
    const result = await collection.updateMany(
      { characterType: { $exists: false } },
      { $set: { characterType: 'pg_principale' } }
    );

    console.log(`✅ Updated ${result.modifiedCount} characters with default type 'pg_principale'`);

    // Create indexes
    await collection.createIndex({ userId: 1, characterType: 1 });
    console.log('✅ Created compound index: userId_1_characterType_1');

    await collection.createIndex({ referentCharacterId: 1 });
    console.log('✅ Created index: referentCharacterId_1');

    console.log('\n[DONE] Migration completed successfully');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[ERROR] Migration failed:', err);
  process.exit(1);
});
