/**
 * Service Seeder - Standalone Script
 *
 * Reads continuative services from CSV, seeds MongoDB.
 * NO dependencies on unified-backend.
 */

import { getConnection } from '../utils/connection.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = join(__dirname, '../data/services.csv');

interface ServiceRow {
  name: string;
  description: string;
  category: string;
  monthlyCost: string;
  socialClassesEligible: string;
}

async function seedServices() {
  console.log('🛎️  Service Seeder\n');
  const { client, db } = await getConnection();

  try {

    const servicesCol = db.collection('services');

    console.log('🗑️  Clearing services...');
    await servicesCol.deleteMany({});

    console.log('📄 Reading services from CSV...');
    const fileContent = readFileSync(CSV_PATH, 'utf-8');

    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
      comment: '#',
    }) as ServiceRow[];

    console.log(`   Found ${records.length} services\n`);

    let created = 0;
    const categories: Record<string, number> = {};

    for (const row of records) {
      const socialClassesEligible = row.socialClassesEligible
        ? row.socialClassesEligible.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      await servicesCol.insertOne({
        name: row.name,
        description: row.description,
        category: row.category,
        monthlyCost: parseInt(row.monthlyCost, 10),
        socialClassesEligible,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      created++;
      categories[row.category] = (categories[row.category] || 0) + 1;
    }

    console.log(`\n✨ Created ${created} services\n`);

    console.log('📊 Stats by category:');
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Done');
  }
}

seedServices();
