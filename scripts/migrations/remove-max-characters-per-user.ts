/**
 * Migration: Remove max_characters_per_user Configuration
 *
 * Deletes the max_characters_per_user configuration record from system_configurations.
 * This field is no longer used as the multi-character system has been redesigned.
 *
 * Date: 2026-03-16
 */

import { getConnection } from '../seeders/utils/connection.js';

async function main() {
  console.log('🗑️  Removing max_characters_per_user configuration\n');

  const { client, db } = await getConnection();

  try {
    const collection = db.collection('system_configurations');

    const result = await collection.deleteOne({
      configKey: 'max_characters_per_user'
    });

    if (result.deletedCount > 0) {
      console.log('✅ Deleted max_characters_per_user configuration');
    } else {
      console.log('ℹ️  Configuration not found (already removed or never seeded)');
    }

    console.log('\n[DONE] Migration completed successfully');
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[ERROR] Migration failed:', err);
  process.exit(1);
});
