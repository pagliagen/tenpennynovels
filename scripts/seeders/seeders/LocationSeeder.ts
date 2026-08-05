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
  filename: string;
  // "prompt" esiste in locations.csv (prompt AI per local-tools/imagegen) ma NON
  // va a DB: volutamente non incluso in questa interfaccia/mapping.
}

// Positions di default per ogni location: nessun dato per-location in CSV,
// image lasciata vuota (nessun asset associato ancora).
const DEFAULT_POSITIONS = [
  {
    name: 'Ingresso',
    description: "Punto d'ingresso alla location: qui i personaggi arrivano provenendo dall'esterno."
  },
  {
    name: 'Uscita',
    description: "Punto d'uscita dalla location: da qui i personaggi possono allontanarsi verso altre zone."
  }
];

// Marker sulla mappa di Londra (percentuale 0-100), impostati manualmente in passato
// via il tool management "Posiziona Mappa". mapPosition NON è in CSV: vive solo nel
// documento Location, quindi un --force (deleteMany + reinsert) lo perdeva silenziosamente.
// Persistiamo qui i valori noti così un reseed non li cancella più.
const MAP_POSITIONS: Record<string, { x: number; y: number }> = {
  'River Wards': { x: 74.67, y: 63.77 },
  'Central London': { x: 51.59, y: 39.59 },
  'East End': { x: 82.91, y: 39.41 },
  'West End': { x: 21.52, y: 49.1 },
  'Suburbs': { x: 85.5, y: 81.25 },
  'Country Side': { x: 85.34, y: 88.49 },
  'Southwark': { x: 64, y: 65 },
  'Wapping': { x: 73.01, y: 58.21 },
  'Bermondsey': { x: 69.16, y: 69.94 },
  'Rotherhithe': { x: 81.12, y: 68.97 },
  'Westminster': { x: 46, y: 35 },
  'The City': { x: 58, y: 35 },
  'Covent Garden': { x: 46, y: 45 },
  'Bloomsbury': { x: 58, y: 45 },
  'Whitechapel': { x: 77, y: 45 },
  'Spitalfields': { x: 89, y: 45 },
  'Bethnal Green': { x: 81.38, y: 51.19 },
  'Stepney': { x: 90.34, y: 51.02 },
  'Mayfair': { x: 28.87, y: 44.73 },
  'Marylebone': { x: 28.81, y: 53.88 },
  'Paddington': { x: 13.61, y: 54.89 },
  'Hyde Park': { x: 16.27, y: 44.26 },
  'Kensington': { x: 41.14, y: 79.97 },
  'Chelsea': { x: 49.32, y: 86.85 },
  'Hammersmith': { x: 49.6, y: 80.03 },
  'Islington': { x: 61.09, y: 83.03 },
  'Hampstead': { x: 41.14, y: 83.61 },
  'Richmond': { x: 59.01, y: 87.91 },
  'Greenwich': { x: 52.09, y: 84.15 },
  'Epping Forest': { x: 46.63, y: 87.14 }
};

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
    'Guildhall', 'Royal Courts of Justice', 'Scotland Yard'
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

    // A row is 'quartiere' if something else in the CSV has it as parent (it groups sub-locations),
    // 'location' if it's a leaf (chattable, no children). Depth-agnostic on purpose: River
    // Wards/Central London/East End/West End have a quartiere tier between district and location;
    // Suburbs/Country Side don't — their district's direct children are already leaves, and this
    // rule tags them 'location' automatically without hardcoding district names.
    const namesWithChildren = new Set(records.map(r => r.parentLocationName).filter(Boolean));

    type LocationLevel = 'root' | 'district' | 'quartiere' | 'location';

    async function createBatch(batch: LocationRow[], level: LocationLevel | 'auto', label: string) {
      console.log(`   🏗️  Creating ${batch.length} ${label}...`);
      let sortOrder = 0;

      for (const row of batch) {
        const parentDoc = row.parentLocationName ? createdLocations.get(row.parentLocationName) : null;

        if (row.parentLocationName && !parentDoc) {
          console.warn(`   ⚠️  Parent "${row.parentLocationName}" not found for "${row.name}", skipping`);
          continue;
        }

        const resolvedLevel: LocationLevel =
          level === 'auto' ? (namesWithChildren.has(row.name) ? 'quartiere' : 'location') : level;

        const doc = {
          name: row.name,
          slug: slugify(row.name),
          description: row.description,
          image: row.filename || null,
          district: resolvedLevel === 'root' ? row.name : (parentDoc?.district || parentDoc?.name || ''),
          parentLocation: parentDoc?._id || undefined,
          locationLevel: resolvedLevel,
          positions: DEFAULT_POSITIONS,
          mapPosition: MAP_POSITIONS[row.name],
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

      await createBatch(canCreate, 'auto', `locations (pass ${pass})`);
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
