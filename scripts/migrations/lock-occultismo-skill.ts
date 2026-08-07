/**
 * Migration: Lock "Occultismo" Skill for Players
 *
 * Imposta lockedForPlayer=true sulla skill Occultismo esistente, così i giocatori
 * non possono più spenderci px sopra (regola CoC: il Mythos cresce solo in gioco,
 * assegnato dal master). Idempotente: se il flag è già impostato non fa nulla.
 *
 * Date: 2026-08-07
 */

import { getConnection } from '../seeders/utils/connection.js';

async function main() {
  console.log('🔒 Locking "Occultismo" skill for players\n');

  const { client, db } = await getConnection();

  try {
    const collection = db.collection('skills');

    const result = await collection.updateOne(
      { name: 'Occultismo' },
      { $set: { lockedForPlayer: true, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      console.log('ℹ️  Skill "Occultismo" non trovata (mai seedata su questo ambiente)');
    } else if (result.modifiedCount > 0) {
      console.log('✅ Skill "Occultismo" bloccata per i giocatori');
    } else {
      console.log('ℹ️  Skill "Occultismo" già bloccata, nessuna modifica necessaria');
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
