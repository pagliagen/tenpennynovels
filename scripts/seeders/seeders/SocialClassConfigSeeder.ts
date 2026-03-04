import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { getConnection } from '../utils/connection.js';

export class SocialClassConfigSeeder {
  name = 'social-class-configs';
  description = 'Populates database with social class configurations for FINANZA skill system';

  async seed(force: boolean = false): Promise<void> {
    const { client, db } = await getConnection();

    try {
      const socialClassConfigsCollection = db.collection('socialclassconfigs');

      // Check if configs already exist
      const existingCount = await socialClassConfigsCollection.countDocuments();

      if (existingCount > 0 && !force) {
        console.log(`   🏛️  ${existingCount} social class configs already exist, skipping seeding`);
        console.log('   💡 Use --force to re-seed');
        return;
      }

      if (force && existingCount > 0) {
        console.log(`   🗑️  Truncating ${existingCount} existing social class configs...`);
        await socialClassConfigsCollection.deleteMany({});
        console.log('   ✅ Social class configs truncated');
      }

      // Read CSV data
      const csvPath = path.join(__dirname, '../data/social-class-configs.csv');

      if (!fs.existsSync(csvPath)) {
        throw new Error(`CSV file not found at: ${csvPath}`);
      }

      console.log('   📄 Reading social class configs from CSV...');
      const configsData = await this.readCsvData(csvPath);
      console.log(`   📊 Parsed ${configsData.length} social class configs from CSV`);

      // Process and create configs
      const configs = configsData.map((csvConfig) => ({
        name: csvConfig.name, // English name for internal logic
        label: csvConfig.label, // Italian label for UI display
        minFinanceSkill: parseInt(csvConfig.minFinanceSkill),
        maxFinanceSkill: parseInt(csvConfig.maxFinanceSkill),
        weeklyCredit: parseFloat(csvConfig.weeklyCredit),
        initialWealth: {
          minCash: parseFloat(csvConfig.minCash),
          maxCash: parseFloat(csvConfig.maxCash),
          hasPrivateApartment: csvConfig.hasPrivateApartment === 'true',
          apartmentType: csvConfig.apartmentType || undefined,
          bonusItems: this.parseBonusItems(csvConfig.bonusItems)
        },
        displayOrder: parseInt(csvConfig.displayOrder),
        description: csvConfig.description,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Insert configs
      await socialClassConfigsCollection.insertMany(configs);
      console.log(`   ✓ Inserted ${configs.length} social class configs`);

      console.log('   🏛️  Social class configs seeding completed successfully!');

    } catch (error) {
      console.error('   ❌ SocialClassConfigSeeder error:', error);
      throw error;
    } finally {
      await client.close();
    }
  }

  private async readCsvData(csvPath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const configs: any[] = [];
      
      fs.createReadStream(csvPath)
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
          if (row.name && row.label && row.minFinanceSkill) {
            configs.push(row);
          }
        })
        .on('end', () => resolve(configs))
        .on('error', reject);
    });
  }

  private parseBonusItems(bonusItemsStr: string): string[] {
    if (!bonusItemsStr || bonusItemsStr === '[]') {
      return [];
    }
    
    try {
      // Parse JSON-like array from CSV
      return JSON.parse(bonusItemsStr);
    } catch {
      // If JSON parsing fails, assume comma-separated values
      return bonusItemsStr.split(',').map(item => item.trim()).filter(item => item.length > 0);
    }
  }
}