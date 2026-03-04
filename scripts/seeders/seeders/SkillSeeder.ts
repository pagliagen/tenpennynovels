import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { getConnection } from '../utils/connection.js';

export class SkillSeeder {
  name = 'skills';
  description = 'Populates database with Call of Cthulhu base skills from CSV';

  async seed(force: boolean = false): Promise<void> {
    const { client, db } = await getConnection();

    try {
      const skillsCollection = db.collection('skills');

      // Check if skills already exist
      const existingCount = await skillsCollection.countDocuments();

      if (existingCount > 0 && !force) {
        console.log(`   🎯 ${existingCount} skills already exist, skipping seeding`);
        console.log('   💡 Use --force to re-seed');
        return;
      }

      if (force && existingCount > 0) {
        console.log(`   🗑️  Truncating ${existingCount} existing skills...`);
        await skillsCollection.deleteMany({});
        console.log('   ✅ Skills truncated');
      }

      // Read CSV data - using new format with placeholder and academic skill support
      const csvPath = path.join(__dirname, '../data/skills.csv');

      if (!fs.existsSync(csvPath)) {
        throw new Error(`CSV file not found at: ${csvPath}`);
      }

      console.log('   📄 Reading skills from CSV...');
      const skillsData = await this.readCsvData(csvPath);
      console.log(`   📊 Parsed ${skillsData.length} skills from CSV`);

      // Process and create skills with flexible baseValue system
      const skills = skillsData.map((csvSkill) => ({
        name: csvSkill.name,
        baseValue: this.parseBaseValue(csvSkill.baseValue), // New flexible parsing
        category: csvSkill.category,
        description: csvSkill.description,
        visible: true, // Code-based visibility
        defaultSkill: true, // All skills are default skills
        sortOrder: 0, // Will be assigned after sorting
        // NEW: Placeholder support (for "Lingua" skill)
        isPlaceholder: csvSkill.isPlaceholder === 'true',
        placeholderType: csvSkill.placeholderType || undefined,
        predefinedValues: [], // Empty array - to be configured manually later
        // NEW: Academic skills restriction (skills with 00 base value)
        canRollWithoutPoints: csvSkill.canRollWithoutPoints === 'true',
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Sort skills alphabetically by name
      skills.sort((a, b) => a.name.localeCompare(b.name, 'it'));

      // Assign sortOrder based on alphabetical position
      skills.forEach((skill, index) => {
        skill.sortOrder = index + 1;
      });

      console.log('   📝 Skills sorted alphabetically');

      // Insert skills
      await skillsCollection.insertMany(skills);
      console.log(`   ✓ Inserted ${skills.length} skills`);

      console.log('   🔧 Skills seeding completed successfully!');

    } catch (error) {
      console.error('   ❌ SkillSeeder error:', error);
      throw error;
    } finally {
      await client.close();
    }
  }

  private parseBaseValue(baseValueStr: string): string {
    if (!baseValueStr || baseValueStr.trim() === '') {
      return '15'; // Default value
    }

    const baseValue = baseValueStr.trim();
    console.log(`   🧮 Parsing baseValue: "${baseValue}"`);

    // Check for new flexible format
    if (baseValue.startsWith('VALUE:')) {
      const numericValue = baseValue.replace('VALUE:', '');
      const parsed = parseInt(numericValue);
      if (isNaN(parsed)) {
        throw new Error(`Invalid VALUE format: "${baseValue}". Expected "VALUE:XX" where XX is a number.`);
      }
      console.log(`   ✅ Fixed value: ${parsed}`);
      return parsed; // Return as number
    }
    
    if (baseValue.startsWith('FORMULA:')) {
      const characteristic = baseValue.replace('FORMULA:', '');
      const validCharacteristics = ['STR', 'DEX', 'INT', 'CON', 'APP', 'POW', 'SIZ', 'EDU'];
      
      if (!validCharacteristics.includes(characteristic)) {
        throw new Error(`Invalid FORMULA characteristic: "${characteristic}". Valid: ${validCharacteristics.join(', ')}`);
      }
      
      console.log(`   ✅ Formula value: ${characteristic}`);
      return baseValue; // Store the full formula string
    }
    
    // Backward compatibility: numeric values
    const parsed = parseInt(baseValue);
    if (isNaN(parsed)) {
      throw new Error(`Invalid baseValue format: "${baseValue}". Expected number, "VALUE:XX", or "FORMULA:CHAR"`);
    }
    
    console.log(`   ✅ Numeric value: ${parsed}`);
    return parsed; // Return as number for backward compatibility
  }

  private async readCsvData(csvPath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const skills: any[] = [];
      
      fs.createReadStream(csvPath)
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
          if (row.name && row.description) {
            skills.push(row);
          }
        })
        .on('end', () => resolve(skills))
        .on('error', reject);
    });
  } 
}