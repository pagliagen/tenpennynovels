/**
 * Item Seeder - Standalone Script
 *
 * Reads items from CSV, seeds MongoDB.
 * NO dependencies on unified-backend.
 */

import { getConnection } from '../utils/connection.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = join(__dirname, '../data/items.csv');

interface ItemRow {
  name: string;
  description: string;
  category: string;
  subcategory: string;
  basePrice: string;
  prerequisites: string;
  isConsumable: string;
  consumptionType: string;
  consumesItems: string;
  providesSkillBonus: string;
  rarity: string;
}

async function seedItems() {
  console.log('🛍️  Item Seeder\n');
  const { client, db } = await getConnection();

  try {

    const itemsCol = db.collection('items');

    console.log('🗑️  Clearing items...');
    await itemsCol.deleteMany({});

    console.log('📄 Reading items from CSV...');
    const fileContent = readFileSync(CSV_PATH, 'utf-8');

    // Parse CSV with ; separator
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
      trim: true,
      relax_quotes: true,
      relax_column_count: true, // Allow inconsistent column count
      comment: '#', // Skip lines starting with #
    }) as ItemRow[];

    console.log(`   Found ${records.length} items\n`);

    let created = 0;
    const categories: Record<string, number> = {};

    for (const row of records) {
      // Parse prerequisites
      const prerequisites: any = {};
      if (row.prerequisites) {
        const parts = row.prerequisites.split(':');
        if (parts[0] === 'requiredOccupations') {
          prerequisites.requiredOccupations = parts.slice(1).join(':').split(',');
        } else if (parts[0] === 'requiredSkills') {
          prerequisites.requiredSkills = [{
            skillName: parts[1],
            minLevel: parseInt(parts[2], 10),
          }];
        }
      }

      // Parse consumable fields
      const isConsumable = row.isConsumable === 'true';
      const consumesItems = row.consumesItems ? row.consumesItems.split(',').map(s => s.trim()) : [];
      const providesSkillBonus = row.providesSkillBonus ? row.providesSkillBonus.split(',').map(s => s.trim()) : [];

      await itemsCol.insertOne({
        name: row.name,
        description: row.description,
        category: row.category,
        subcategory: row.subcategory || null,
        basePrice: parseFloat(row.basePrice),
        prerequisites: Object.keys(prerequisites).length > 0 ? prerequisites : undefined,
        isConsumable,
        consumptionType: row.consumptionType || null,
        consumesItems: consumesItems.length > 0 ? consumesItems : undefined,
        providesSkillBonus: providesSkillBonus.length > 0 ? providesSkillBonus : undefined,
        rarity: row.rarity || 'common',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      created++;

      // Track categories
      categories[row.category] = (categories[row.category] || 0) + 1;

      if (created % 50 === 0) {
        console.log(`   💾 Processed ${created} items...`);
      }
    }

    console.log(`\n✨ Created ${created} items\n`);

    console.log('📊 Stats by category:');
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });
    console.log('');

    // Rarity distribution
    const rarities = await itemsCol.aggregate([
      { $group: { _id: '$rarity', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    console.log('📊 Stats by rarity:');
    rarities.forEach(r => {
      console.log(`   ${r._id}: ${r.count}`);
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

seedItems();
