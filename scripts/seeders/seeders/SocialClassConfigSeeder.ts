/**
 * Social Class Config Seeder - Standalone Script
 *
 * Reads social class configurations from CSV, seeds MongoDB.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { getConnection } from '../utils/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = join(__dirname, '../data/social-class-configs.csv');

interface SocialClassRow {
  name: string;
  label: string;
  minFinanceSkill: string;
  maxFinanceSkill: string;
  weeklyCredit: string;
  minCash: string;
  maxCash: string;
  hasPrivateApartment: string;
  apartmentType: string;
  bonusItems: string;
  displayOrder: string;
  description: string;
}

function parseBonusItems(str: string): string[] {
  if (!str || str === '[]') return [];
  try {
    return JSON.parse(str);
  } catch {
    return str.split(',').map(s => s.trim()).filter(Boolean);
  }
}

async function seedSocialClassConfigs() {
  console.log('🏛️  Social Class Config Seeder\n');
  const { client, db } = await getConnection();

  try {
    const configsCol = db.collection('socialclassconfigs');
    const force = process.argv.includes('--force');

    const existingCount = await configsCol.countDocuments();
    if (existingCount > 0 && !force) {
      console.log(`   ℹ️  ${existingCount} social class configs already exist, skipping`);
      console.log('   💡 Use --force to re-seed\n');
      return;
    }

    if (existingCount > 0) {
      console.log(`   🗑️  Clearing ${existingCount} existing configs...`);
      await configsCol.deleteMany({});
    }

    console.log('   📄 Reading social class configs from CSV...');
    const fileContent = readFileSync(CSV_PATH, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
      trim: true,
      relax_quotes: true,
    }) as SocialClassRow[];

    console.log(`   📊 Parsed ${records.length} configs from CSV\n`);

    const configs = records
      .filter(r => r.name && r.label && r.minFinanceSkill)
      .map(r => ({
        name: r.name,
        label: r.label,
        minFinanceSkill: parseInt(r.minFinanceSkill),
        maxFinanceSkill: parseInt(r.maxFinanceSkill),
        weeklyCredit: parseFloat(r.weeklyCredit),
        initialWealth: {
          minCash: parseFloat(r.minCash),
          maxCash: parseFloat(r.maxCash),
          hasPrivateApartment: r.hasPrivateApartment === 'true',
          apartmentType: r.apartmentType || undefined,
          bonusItems: parseBonusItems(r.bonusItems)
        },
        displayOrder: parseInt(r.displayOrder),
        description: r.description,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

    await configsCol.insertMany(configs);
    console.log(`   ✅ Created ${configs.length} social class configs\n`);

    configs.forEach(c => console.log(`   ${c.name} (${c.label}): ${c.minFinanceSkill}-${c.maxFinanceSkill}`));
    console.log('');

  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Done');
  }
}

seedSocialClassConfigs();
