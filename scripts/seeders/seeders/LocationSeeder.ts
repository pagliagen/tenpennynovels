import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import slugify from 'slugify';
import { getConnection } from '../utils/connection.js';

export class LocationSeeder {
  name = 'locations';
  description = 'Seed initial London locations from CSV data';

  async seed(force: boolean = false): Promise<void> {
    const { client, db } = await getConnection();

    try {
      const locationsCollection = db.collection('locations');

      // Check if locations already exist
      const existingCount = await locationsCollection.countDocuments();

      if (existingCount > 0 && !force) {
        console.log(`   📍 ${existingCount} locations already exist, skipping seeding`);
        console.log('   💡 Use --force to re-seed');
        return;
      }

      if (force && existingCount > 0) {
        console.log(`   🗑️  Truncating ${existingCount} existing locations...`);
        await locationsCollection.deleteMany({});
        console.log('   ✅ Locations truncated');
      }

      // Read CSV data
      const csvPath = path.join(__dirname, '../data/locations.csv');

      if (!fs.existsSync(csvPath)) {
        throw new Error(`CSV file not found at: ${csvPath}`);
      }

      console.log('   📄 Reading locations from CSV...');
      const locations = await this.readCsvData(csvPath);
      console.log(`   📊 Parsed ${locations.length} locations from CSV`);

      // Create locations in hierarchical order
      const createdLocations = await this.createLocationsHierarchically(locations, locationsCollection);

      console.log(`   ✅ Successfully created ${createdLocations.size} locations`);

    } catch (error) {
      console.error('   ❌ LocationSeeder error:', error);
      throw error;
    } finally {
      await client.close();
    }
  }

  private async readCsvData(csvPath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const locations: any[] = [];
      
      fs.createReadStream(csvPath)
        .pipe(csv({ separator: ';' }))
        .on('data', (row) => {
          if (row.name && row.description) {
            locations.push(row);
          }
        })
        .on('end', () => resolve(locations))
        .on('error', reject);
    });
  }

  private async createLocationsHierarchically(locations: any[], collection: any): Promise<Map<string, any>> {
    const createdLocations = new Map<string, any>();
    const systemUserId = '000000000000000000000000'; // System user ID

    // Sort locations by hierarchy level
    const rootLocations = locations.filter(loc => !loc.parentLocationName);
    const districtLocations = locations.filter(loc =>
      loc.parentLocationName && rootLocations.some(root => root.name === loc.parentLocationName)
    );
    const subLocations = locations.filter(loc =>
      loc.parentLocationName && !rootLocations.some(root => root.name === loc.parentLocationName)
    );

    console.log(`   🏗️  Creating ${rootLocations.length} root locations...`);
    // Create root locations first
    for (const csvLocation of rootLocations) {
      const locationDoc = await this.createLocation(csvLocation, null, 'root', systemUserId, collection);
      createdLocations.set(csvLocation.name, locationDoc);
    }

    console.log(`   🏙️  Creating ${districtLocations.length} district locations...`);
    // Create district locations
    for (const csvLocation of districtLocations) {
      const parentLocation = createdLocations.get(csvLocation.parentLocationName);
      if (!parentLocation) {
        console.warn(`   ⚠️  Parent location not found for district: ${csvLocation.name}`);
        continue;
      }

      const locationDoc = await this.createLocation(csvLocation, parentLocation, 'district', systemUserId, collection);
      createdLocations.set(csvLocation.name, locationDoc);
    }

    console.log(`   🏢 Creating ${subLocations.length} sub-locations...`);
    // Create sub-locations
    for (const csvLocation of subLocations) {
      const parentLocation = createdLocations.get(csvLocation.parentLocationName);
      if (!parentLocation) {
        console.warn(`   ⚠️  Parent location not found for location: ${csvLocation.name}`);
        continue;
      }

      const locationDoc = await this.createLocation(csvLocation, parentLocation, 'location', systemUserId, collection);
      createdLocations.set(csvLocation.name, locationDoc);
    }

    return createdLocations;
  }

  private async createLocation(
    csvData: any,
    parentLocation: any | null,
    level: 'root' | 'district' | 'location',
    createdBy: string,
    collection: any
  ): Promise<any> {
    // Parse tags from CSV (comma-separated string to array)
    const tags = csvData.tags
      ? csvData.tags.split(',').map((tag: string) => tag.trim().toLowerCase()).filter((tag: string) => tag.length > 0)
      : [];

    const locationDoc = {
      name: csvData.name,
      description: csvData.description,
      district: level === 'root' ? csvData.name : (parentLocation?.district || parentLocation?.name),
      parentLocation: parentLocation?._id,
      locationLevel: level,
      slug: slugify(csvData.name, { lower: true, strict: true }), // Generate slug for location
      tags, // Add tags from CSV
      settings: {
        visible: true, // All locations are visible by default
        chat: true,    // All locations have chat enabled by default
        shop: this.shouldHaveShop(csvData.name), // Determine shop based on location name
        private: this.isPrivateLocation(csvData.name) // Determine privacy based on location name
      },
      access: this.isPrivateLocation(csvData.name) ? {
        characterAccess: [],
        corporationAccess: []
      } : undefined,
      occupants: [],
      npcs: [],
      statistics: {
        totalVisits: 0,
        uniqueVisitors: 0,
        averageStayTime: 0,
        messagesExchanged: 0,
        peakHours: []
      },
      createdBy,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await collection.insertOne(locationDoc);
    return { ...locationDoc, _id: result.insertedId };
  } 

  private shouldHaveShop(locationName: string): boolean {
    // Locations that should have shops
    const shopLocations = [
      'London', 'Commercial Street'
    ];
    
    return shopLocations.includes(locationName);
  }

  private isPrivateLocation(locationName: string): boolean {
    // Locations that should be private
    const privateLocations = [
      'Gentleman\'s Club', 'Kensington Palace', 'Bank of England',
      'Guildhall', 'Royal Courts of Justice', 'University College London',
      'Somerset House', 'Scotland Yard'
    ];
    
    return privateLocations.includes(locationName);
  }
}