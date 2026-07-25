/**
 * Occupation Seeder - Standalone Script
 *
 * Reads occupations from CSV, seeds MongoDB.
 * Looks up skill ObjectIds from the skills collection for requiredSkillSlots/bonusSkills.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { ObjectId } from 'mongodb';
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
  filename: string;
  // "prompt" esiste in occupations.csv (prompt AI per local-tools/imagegen) ma
  // NON va a DB: volutamente non incluso in questa interfaccia/mapping.
}

async function seedOccupations() {
  console.log('💼 Occupation Seeder\n');
  const { client, db } = await getConnection();

  try {
    const occupationsCol = db.collection('occupations');
    const skillsCol = db.collection('skills');
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

    // Build skill name -> ObjectId map (case-insensitive keys)
    console.log('   🔗 Loading skill IDs from database...');
    const allSkills = await skillsCol.find({}, { projection: { name: 1 } }).toArray();
    const skillMap = new Map<string, ObjectId>();
    for (const s of allSkills) {
      skillMap.set(s.name.toLowerCase(), s._id);
    }
    console.log(`   📎 Found ${skillMap.size} skills for reference\n`);

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
    let missingSkills: string[] = [];
    const categories: Record<string, number> = {};

    for (const row of records) {
      if (!row.name || !row.description) continue;

      // Build requiredSkillSlots: each CSV skill name becomes a slot with one option (ObjectId)
      const requiredSkillSlots: Array<{ options: ObjectId[] }> = [];
      if (row.requiredSkills) {
        for (const skillName of row.requiredSkills.split('|').map(s => s.trim())) {
          const skillId = skillMap.get(skillName.toLowerCase());
          if (skillId) {
            requiredSkillSlots.push({ options: [skillId] });
          } else {
            missingSkills.push(`${row.name} -> ${skillName}`);
          }
        }
      }

      // Build bonusSkills: each CSV entry "skillName:value" becomes { skillId: ObjectId, bonusValue }
      const bonusSkills: Array<{ skillId: ObjectId; bonusValue: number }> = [];
      if (row.bonusSkills) {
        for (const entry of row.bonusSkills.split('|').map(s => s.trim())) {
          const [skillName, valueStr] = entry.split(':');
          const skillId = skillMap.get(skillName.trim().toLowerCase());
          if (skillId) {
            bonusSkills.push({ skillId, bonusValue: parseInt(valueStr) || 10 });
          } else {
            missingSkills.push(`${row.name} -> ${skillName.trim()} (bonus)`);
          }
        }
      }

      await occupationsCol.insertOne({
        name: row.name,
        description: row.description,
        category: row.category,
        contacts: row.contacts || 'Nessuno',
        earnings: row.earnings || 'Variabile',
        requiredSkillSlots,
        bonusSkills,
        // getOccupationImage() in apps/game consuma questo campo come path
        // diretto (fallback su DEFAULT_OCCUPATION_IMAGE se null) — va quindi
        // memorizzato già come path completo, non come filename nudo.
        image: row.filename ? `/artifacts/occupations/${row.filename}` : null,
        isActive: true,
        createdBy: new ObjectId(systemUserId),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      created++;
      categories[row.category] = (categories[row.category] || 0) + 1;
    }

    console.log(`   ✅ Created ${created} occupations\n`);

    if (missingSkills.length > 0) {
      console.log(`   ⚠️  ${missingSkills.length} skill references not found in DB:`);
      missingSkills.forEach(m => console.log(`      - ${m}`));
      console.log('');
    }

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
