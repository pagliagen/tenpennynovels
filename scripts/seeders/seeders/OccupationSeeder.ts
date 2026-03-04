import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { getConnection } from '../utils/connection.js';

export class OccupationSeeder {
  name = 'occupations';
  description = 'Seed Victorian London occupations from CSV';

  async seed(force: boolean = false): Promise<void> {
    const { client, db } = await getConnection();

    try {
      const occupationsCollection = db.collection('occupations');

      // Check if occupations already exist
      const existingCount = await occupationsCollection.countDocuments();

      if (existingCount > 0 && !force) {
        console.log(`   💼 ${existingCount} occupations already exist, skipping seeding`);
        console.log('   💡 Use --force to re-seed');
        return;
      }

      if (force && existingCount > 0) {
        console.log(`   🗑️  Truncating ${existingCount} existing occupations...`);

        // Drop indexes before seeding
        try {
          await occupationsCollection.dropIndexes();
          console.log('   📋 Dropped existing indexes');
        } catch (indexError) {
          console.log('   ⚠️  No indexes to drop or drop failed (this is usually fine)');
        }

        await occupationsCollection.deleteMany({});
        console.log('   ✅ Occupations truncated');
      }

      // Read CSV data
      const csvPath = path.join(__dirname, '../data/occupations.csv');

      if (!fs.existsSync(csvPath)) {
        throw new Error(`CSV file not found at: ${csvPath}`);
      }

      console.log('   📄 Reading occupations from CSV...');
      const occupationsData = await this.readCsvData(csvPath);
      console.log(`   📊 Parsed ${occupationsData.length} occupations from CSV`);

      console.log(`   🏗️  Creating occupations...`);

      const createdOccupations = [];

      for (const csvOccupation of occupationsData) {
        try {
          // Process CSV data with validation
          const occupationData = this.processOccupationData(csvOccupation);

          const result = await occupationsCollection.insertOne(occupationData);
          const savedOccupation = { ...occupationData, _id: result.insertedId };
          createdOccupations.push(savedOccupation);

          console.log(`   💼 Created: ${savedOccupation.name} (${savedOccupation.category})`);

        } catch (error: any) {
          console.error(`   ❌ Error creating occupation ${csvOccupation.name}:`, error.message);
          throw error; // Fail the entire seeding process on any error
        }
      }

      console.log(`   ✅ Successfully created ${createdOccupations.length} occupations`);

    } catch (error) {
      console.error('   ❌ OccupationSeeder error:', error);
      throw error;
    } finally {
      await client.close();
    }
  }

  private async readCsvData(csvPath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const occupations: any[] = [];

      fs.createReadStream(csvPath)
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
          if (row.name && row.description) {
            occupations.push(row);
          }
        })
        .on('end', () => resolve(occupations))
        .on('error', reject);
    });
  }

  private processOccupationData(csvOccupation: any): any {
    console.log(`\n🏢 Processing occupation: ${csvOccupation.name}`);

    const systemUserId = '000000000000000000000000'; // System user ID

    // Parse required skills (format: "Skill1|Skill2|Skill3")
    const requiredSkills = csvOccupation.requiredSkills
      ? csvOccupation.requiredSkills.split('|').map((skillName: string) => ({
          skillName: skillName.trim(),
          isFixed: false,
          alternatives: []
        }))
      : [];

    // Parse bonus skills (format: "SkillName:Value|SkillName:Value")
    const bonusSkills = csvOccupation.bonusSkills
      ? csvOccupation.bonusSkills.split('|').map((bonusStr: string) => {
          const [skillName, valueStr] = bonusStr.split(':');
          return {
            skillName: skillName.trim(),
            bonusValue: parseInt(valueStr) || 10
          };
        })
      : [];

    return {
      name: csvOccupation.name,
      description: csvOccupation.description,
      category: csvOccupation.category,

      // Display information
      contacts: csvOccupation.contacts || 'Nessuno',
      earnings: csvOccupation.earnings || 'Variabile',

      // Skills system
      requiredSkills,
      bonusSkills,

      // Occupation settings
      allowedGenders: this.getAllowedGenders(),
      socialClass: this.getAllowedSocialClasses(),
      dailySalary: this.getDailySalary(csvOccupation.category),
      socialRespectability: this.getSocialRespectability(csvOccupation.category),
      typicalEmployers: [],
      isActive: true,
      createdBy: systemUserId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private getAllowedGenders(): ('male' | 'female')[] {
    // Most Victorian occupations allow both genders (historical accuracy varies)
    return ['male', 'female'];
  }

  private getAllowedSocialClasses(): ('working' | 'middle' | 'upper')[] {
    // Most occupations are accessible across classes
    return ['working', 'middle', 'upper'];
  }

  private getDailySalary(category: string): number {
    // Victorian daily wages in pence (1 shilling = 12 pence, 1 pound = 240 pence)
    const salaries: { [key: string]: number } = {
      'medical': 180,        // £0.75/day (high professional)
      'legal': 200,          // £0.83/day (high professional)
      'clergy': 60,          // £0.25/day (modest living)
      'military': 30,        // £0.125/day (soldier's pay)
      'education': 90,       // £0.375/day (teacher)
      'domestic_service': 20, // £0.08/day (low)
      'trades': 50,          // £0.21/day (skilled worker)
      'commerce': 80,        // £0.33/day (clerk/shopkeeper)
      'entertainment': 40,   // £0.17/day (variable)
      'criminal': 15,        // £0.06/day (unstable)
      'nobility': 500,       // £2.08/day (wealthy)
      'professional': 150,   // £0.625/day (middle professional)
      'industrial': 35,      // £0.15/day (factory worker)
      'transportation': 40,  // £0.17/day (driver/sailor)
      'agricultural': 25     // £0.10/day (farm worker)
    };

    return salaries[category] || 50;
  }

  private getSocialRespectability(category: string): number {
    // Social respectability on a 1-10 scale
    const respectability: { [key: string]: number } = {
      'medical': 9,
      'legal': 9,
      'clergy': 8,
      'military': 7,
      'education': 7,
      'domestic_service': 4,
      'trades': 5,
      'commerce': 6,
      'entertainment': 5,
      'criminal': 1,
      'nobility': 10,
      'professional': 8,
      'industrial': 4,
      'transportation': 5,
      'agricultural': 4
    };

    return respectability[category] || 5;
  }
}
