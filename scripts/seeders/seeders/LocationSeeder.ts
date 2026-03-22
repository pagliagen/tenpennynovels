/**
 * Location Seeder - Standalone Script
 *
 * Reads locations from CSV, builds hierarchy (root → district → location),
 * seeds MongoDB.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { getConnection } from '../utils/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = join(__dirname, '../data/locations.csv');

interface LocationRow {
  name: string;
  description: string;
  parentLocationName: string;
  tags: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[']/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function shouldHaveShop(name: string): boolean {
  return ['London', 'Commercial Street', 'Borough Market', 'Bond Street', 'Covent Garden'].includes(name);
}

function isPrivateLocation(name: string): boolean {
  return [
    "Gentleman's Club", 'Kensington Palace', 'Bank of England',
    'Guildhall', 'Royal Courts of Justice', 'Scotland Yard',
    'Scotland Yard Archives', 'Parliament Square Courtyard'
  ].includes(name);
}

async function seedLocations() {
  console.log('📍 Location Seeder\n');
  const { client, db } = await getConnection();

  try {
    const locationsCol = db.collection('locations');
    const force = process.argv.includes('--force');

    const existingCount = await locationsCol.countDocuments();
    if (existingCount > 0 && !force) {
      console.log(`   ℹ️  ${existingCount} locations already exist, skipping`);
      console.log('   💡 Use --force to re-seed\n');
      return;
    }

    if (existingCount > 0) {
      console.log(`   🗑️  Clearing ${existingCount} existing locations...`);
      await locationsCol.deleteMany({});
    }

    console.log('   📄 Reading locations from CSV...');
    const fileContent = readFileSync(CSV_PATH, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
      trim: true,
      relax_quotes: true,
    }) as LocationRow[];

    console.log(`   📊 Parsed ${records.length} locations from CSV\n`);

    const systemUserId = '000000000000000000000000';
    const createdLocations = new Map<string, any>();

    const rootLocations = records.filter(r => !r.parentLocationName);
    const districtLocations = records.filter(r =>
      r.parentLocationName && rootLocations.some(root => root.name === r.parentLocationName)
    );
    const subLocations = records.filter(r =>
      r.parentLocationName &&
      !rootLocations.some(root => root.name === r.parentLocationName) &&
      !districtLocations.some(d => d.name === r.parentLocationName)
    );
    const deepLocations = records.filter(r =>
      r.parentLocationName &&
      !rootLocations.some(root => root.name === r.parentLocationName) &&
      !districtLocations.some(d => d.name === r.parentLocationName) &&
      subLocations.some(s => s.name === r.parentLocationName)
    );

    const subLocationsFiltered = records.filter(r =>
      r.parentLocationName &&
      !rootLocations.some(root => root.name === r.parentLocationName) &&
      districtLocations.some(d => d.name === r.parentLocationName)
    );

    const deeperLocations = records.filter(r =>
      r.parentLocationName &&
      !rootLocations.some(root => root.name === r.parentLocationName) &&
      !districtLocations.some(d => d.name === r.parentLocationName) &&
      !subLocationsFiltered.some(s => s.name === r.parentLocationName) &&
      subLocationsFiltered.some(s => s.name !== r.name)
    );

    async function createBatch(batch: LocationRow[], level: 'root' | 'district' | 'location', label: string) {
      console.log(`   🏗️  Creating ${batch.length} ${label}...`);
      let sortOrder = 0;

      for (const row of batch) {
        const parentDoc = row.parentLocationName ? createdLocations.get(row.parentLocationName) : null;

        if (row.parentLocationName && !parentDoc) {
          console.warn(`   ⚠️  Parent "${row.parentLocationName}" not found for "${row.name}", skipping`);
          continue;
        }

        const tags = row.tags
          ? row.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
          : [];

        const doc = {
          name: row.name,
          slug: slugify(row.name),
          description: row.description,
          district: level === 'root' ? row.name : (parentDoc?.district || parentDoc?.name || ''),
          parentLocation: parentDoc?._id || undefined,
          locationLevel: level,
          tags,
          sortOrder: sortOrder++,
          settings: {
            visible: true,
            chat: true,
            shop: shouldHaveShop(row.name),
            private: isPrivateLocation(row.name)
          },
          access: isPrivateLocation(row.name) ? { characterAccess: [], corporationAccess: [] } : undefined,
          bot_enabled: false,
          occupants: [],
          npcs: [],
          statistics: {
            totalVisits: 0,
            uniqueVisitors: 0,
            averageStayTime: 0,
            messagesExchanged: 0,
            peakHours: []
          },
          createdBy: systemUserId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await locationsCol.insertOne(doc);
        createdLocations.set(row.name, { ...doc, _id: result.insertedId });
      }
    }

    await createBatch(rootLocations, 'root', 'root locations');
    await createBatch(districtLocations, 'district', 'districts');

    const allSubLocations = records.filter(r =>
      r.parentLocationName &&
      !rootLocations.some(root => root.name === r.parentLocationName) &&
      !createdLocations.has(r.name)
    );

    let remaining = allSubLocations;
    let pass = 0;
    while (remaining.length > 0 && pass < 5) {
      pass++;
      const canCreate = remaining.filter(r => createdLocations.has(r.parentLocationName));
      const cannotCreate = remaining.filter(r => !createdLocations.has(r.parentLocationName));

      if (canCreate.length === 0) {
        console.warn(`   ⚠️  ${cannotCreate.length} locations have missing parents, skipping`);
        for (const r of cannotCreate) {
          console.warn(`      - "${r.name}" → parent "${r.parentLocationName}" not found`);
        }
        break;
      }

      await createBatch(canCreate, 'location', `locations (pass ${pass})`);
      remaining = cannotCreate;
    }

    console.log(`\n   ✅ Created ${createdLocations.size} locations total\n`);

    // Stats
    const stats = await locationsCol.aggregate([
      { $group: { _id: '$locationLevel', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();

    console.log('📊 Stats by level:');
    stats.forEach(s => console.log(`   ${s._id}: ${s.count}`));
    console.log('');

  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Done');
  }
}

seedLocations();
