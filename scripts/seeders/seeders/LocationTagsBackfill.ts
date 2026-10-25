/**
 * Location Tags Backfill - Standalone Script
 *
 * Applica la colonna `tags` di data/locations.csv alle location GIÀ nel DB, per nome.
 * Serve perché LocationSeeder salta se esistono location e con --force le cancella
 * (con loro occupanti, accessi e posizioni sulla mappa). Idempotente: si può rilanciare.
 *
 *   npm run seed:dev:location-tags              # applica
 *   npm run seed:dev:location-tags -- --dry-run # mostra cosa cambierebbe
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { getConnection } from '../utils/connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, '../data/locations.csv');

interface Row {
  name: string;
  tags?: string;
}

const parseTags = (raw: string | undefined): string[] =>
  (raw ?? '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);

async function backfill() {
  console.log('🏷️  Location Tags Backfill\n');
  const dryRun = process.argv.includes('--dry-run');
  const { client, db } = await getConnection();

  try {
    const rows = parse(readFileSync(CSV_PATH, 'utf-8'), {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
      trim: true,
      relax_quotes: true,
    }) as Row[];

    const locations = db.collection('locations');
    let changed = 0;
    let unchanged = 0;
    const missing: string[] = [];

    for (const row of rows) {
      const tags = parseTags(row.tags);
      const existing = await locations.findOne({ name: row.name }, { projection: { tags: 1 } });
      if (!existing) {
        missing.push(row.name);
        continue;
      }
      const current: string[] = Array.isArray(existing.tags) ? existing.tags : [];
      if (current.length === tags.length && current.every((t, i) => t === tags[i])) {
        unchanged++;
        continue;
      }
      if (!dryRun) await locations.updateOne({ _id: existing._id }, { $set: { tags } });
      changed++;
      console.log(`   ${dryRun ? '(dry) ' : ''}${row.name}: [${current.join(', ')}] → [${tags.join(', ')}]`);
    }

    console.log(`\n✨ ${changed} ${dryRun ? 'da aggiornare' : 'aggiornate'}, ${unchanged} già a posto`);
    if (missing.length > 0) console.log(`⚠️  Non trovate nel DB (${missing.length}): ${missing.join(', ')}`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Done');
  }
}

backfill();
