/**
 * Occupation Seeder - Standalone Script
 *
 * Reads occupations from CSV, seeds MongoDB.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { getConnection } from '../utils/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CSV_PATH = join(__dirname, '../data/occupations.csv');

interface OccupationRow {
  name: string;
  description: string;
  category: string;
  contacts: string;
  earnings: string;
  requiredSkills: string;
  bonusSkills: string;
}

const DAILY_SALARIES: Record<string, number> = {
  medical: 180, legal: 200, clergy: 60, military: 30, education: 90,
  domestic_service: 20, trades: 50, commerce: 80, entertainment: 40,
  criminal: 15, nobility: 500, professional: 150, industrial: 35,
  transportation: 40, agricultural: 25
};

const SOCIAL_RESPECTABILITY: Record<string, number> = {
  medical: 9, legal: 9, clergy: 8, military: 7, education: 7,
  domestic_service: 4, trades: 5, commerce: 6, entertainment: 5,
  criminal: 1, nobility: 10, professional: 8, industrial: 4,
  transportation: 5, agricultural: 4
};

async function seedOccupations() {
  console.log('💼 Occupation Seeder\n');
  const { client, db } = await getConnection();

  try {
    const occupationsCol = db.collection('occupations');
    const force = process.argv.includes('--force');

    const existingCount = await occupationsCol.countDocuments();
    if (existingCount > 0 && !force) {
      console.log(`   ℹ️  ${existingCount} occupations already exist, skipping`);
      console.log('   💡 Use --force to re-seed\n');
      return;
    }

    if (existingCount > 0) {
      console.log(`   🗑️  Clearing ${existingCount} existing occupations...`);
      try { await occupationsCol.dropIndexes(); } catch { /* ok */ }
      await occupationsCol.deleteMany({});
    }

    console.log('   📄 Reading occupations from CSV...');
    const fileContent = readFileSync(CSV_PATH, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      delimiter: ';',
      trim: true,
      relax_quotes: true,
    }) as OccupationRow[];

    console.log(`   📊 Parsed ${records.length} occupations from CSV\n`);

    const systemUserId = '000000000000000000000000';
    let created = 0;
    const categories: Record<string, number> = {};

    for (const row of records) {
      if (!row.name || !row.description) continue;

      const requiredSkills = row.requiredSkills
        ? row.requiredSkills.split('|').map(s => ({
            skillName: s.trim(),
            isFixed: false,
            alternatives: []
          }))
        : [];

      const bonusSkills = row.bonusSkills
        ? row.bonusSkills.split('|').map(b => {
            const [skillName, valueStr] = b.split(':');
            return { skillName: skillName.trim(), bonusValue: parseInt(valueStr) || 10 };
          })
        : [];

      await occupationsCol.insertOne({
        name: row.name,
        description: row.description,
        category: row.category,
        contacts: row.contacts || 'Nessuno',
        earnings: row.earnings || 'Variabile',
        requiredSkills,
        bonusSkills,
        allowedGenders: ['male', 'female'],
        socialClass: ['working', 'middle', 'upper'],
        dailySalary: DAILY_SALARIES[row.category] || 50,
        socialRespectability: SOCIAL_RESPECTABILITY[row.category] || 5,
        typicalEmployers: [],
        isActive: true,
        createdBy: systemUserId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      created++;
      categories[row.category] = (categories[row.category] || 0) + 1;
    }

    console.log(`   ✅ Created ${created} occupations\n`);

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

seedOccupations();
