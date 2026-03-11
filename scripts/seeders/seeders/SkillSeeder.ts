/**
 * Skill Seeder - Standalone Script
 *
 * Reads skills from CSV, seeds MongoDB.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { getConnection } from '../utils/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = join(__dirname, '../data/skills.csv');

interface SkillRow {
  name: string;
  baseValue: string;
  category: string;
  description: string;
  isPlaceholder: string;
  placeholderType: string;
  canRollWithoutPoints: string;
}

function parseBaseValue(baseValueStr: string): string | number {
  if (!baseValueStr || baseValueStr.trim() === '') return 15;

  const val = baseValueStr.trim();

  if (val.startsWith('VALUE:')) {
    const num = parseInt(val.replace('VALUE:', ''));
    if (isNaN(num)) throw new Error(`Invalid VALUE format: "${val}"`);
    return num;
  }

  if (val.startsWith('FORMULA:')) {
    const characteristic = val.replace('FORMULA:', '');
    const valid = ['STR', 'DEX', 'INT', 'CON', 'APP', 'POW', 'SIZ', 'EDU'];
    if (!valid.includes(characteristic)) {
      throw new Error(`Invalid FORMULA characteristic: "${characteristic}"`);
    }
    return val;
  }

  const parsed = parseInt(val);
  if (isNaN(parsed)) throw new Error(`Invalid baseValue: "${val}"`);
  return parsed;
}

async function seedSkills() {
  console.log('🎯 Skill Seeder\n');
  const { client, db } = await getConnection();

  try {
    const skillsCol = db.collection('skills');
    const force = process.argv.includes('--force');

    const existingCount = await skillsCol.countDocuments();
    if (existingCount > 0 && !force) {
      console.log(`   ℹ️  ${existingCount} skills already exist, skipping`);
      console.log('   💡 Use --force to re-seed\n');
      return;
    }

    if (existingCount > 0) {
      console.log(`   🗑️  Clearing ${existingCount} existing skills...`);
      await skillsCol.deleteMany({});
    }

    console.log('   📄 Reading skills from CSV...');
    const fileContent = readFileSync(CSV_PATH, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
      trim: true,
      relax_quotes: true,
    }) as SkillRow[];

    console.log(`   📊 Parsed ${records.length} skills from CSV\n`);

    const skills = records
      .filter(r => r.name && r.description)
      .map(r => ({
        name: r.name,
        baseValue: parseBaseValue(r.baseValue),
        category: r.category,
        description: r.description,
        visible: true,
        defaultSkill: true,
        isPlaceholder: r.isPlaceholder === 'true',
        placeholderType: r.placeholderType || undefined,
        predefinedValues: [],
        canRollWithoutPoints: r.canRollWithoutPoints === 'true',
        createdAt: new Date(),
        updatedAt: new Date()
      }));

    skills.sort((a, b) => a.name.localeCompare(b.name, 'it'));

    await skillsCol.insertMany(skills);
    console.log(`   ✅ Created ${skills.length} skills\n`);

    const categories: Record<string, number> = {};
    skills.forEach(s => { categories[s.category] = (categories[s.category] || 0) + 1; });
    console.log('📊 Stats by category:');
    Object.entries(categories).forEach(([cat, count]) => console.log(`   ${cat}: ${count}`));
    console.log('');

  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Done');
  }
}

seedSkills();
