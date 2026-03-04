/**
 * Route Seeder - Standalone Script (NEW)
 *
 * Reads routes-config.json and creates Route records.
 * Must be run AFTER DocumentSeeder (needs document _id references).
 */

import { ObjectId } from 'mongodb';
import { getConnection } from '../utils/connection.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROUTES_CONFIG_PATH = join(__dirname, '../data/routes-config.json');

interface RouteConfig {
  path: string;
  type: 'ambientazione' | 'regolamento';
  kind: 'document' | 'category';
  rootDocumentSlug: string | null;
  title: string;
  description?: string;
  displayCategory?: string;  // NEW: Display grouping for frontend
  isPublic: boolean;
  enabled: boolean;
}

async function seedRoutes() {
  console.log('🌱 Route Seeder (NEW)\n');
  const { client, db } = await getConnection();

  try {

    const routesCol = db.collection('routes');
    const documentsCol = db.collection('documents');

    console.log('🗑️  Clearing routes...');
    await routesCol.deleteMany({});

    console.log('📄 Reading routes-config.json...');
    const configContent = readFileSync(ROUTES_CONFIG_PATH, 'utf-8');
    const routesConfig: RouteConfig[] = JSON.parse(configContent);
    console.log(`   Found ${routesConfig.length} route definitions\n`);

    // Build document slug → _id map
    console.log('🔗 Building document slug map...');
    const docMap = new Map<string, ObjectId>();
    const allDocs = await documentsCol.find({}).toArray();
    for (const doc of allDocs) {
      docMap.set(doc.slug, doc._id);
    }
    console.log(`   Mapped ${docMap.size} documents\n`);

    // Insert routes
    console.log('🛤️  Creating routes...');
    let created = 0;

    for (const routeConfig of routesConfig) {
      // Resolve rootDocumentSlug → ObjectId
      let rootDocumentId: ObjectId | null = null;
      if (routeConfig.rootDocumentSlug) {
        rootDocumentId = docMap.get(routeConfig.rootDocumentSlug) || null;
        if (!rootDocumentId) {
          console.error(`   ⚠️  Document "${routeConfig.rootDocumentSlug}" not found for route "${routeConfig.path}"`);
          continue;
        }
      }

      const routeKind = routeConfig.kind === 'category' ? '📁' : '📄';
      console.log(`   ${routeKind} ${routeConfig.path} → ${routeConfig.title}`);

      await routesCol.insertOne({
        path: routeConfig.path,
        type: routeConfig.type,
        kind: routeConfig.kind,
        rootDocumentId,
        rootDocumentSlug: routeConfig.rootDocumentSlug,  // FIX: Preserve slug
        title: routeConfig.title,
        description: routeConfig.description || '',
        displayCategory: routeConfig.displayCategory,  // NEW: Display grouping
        isPublic: routeConfig.isPublic,
        enabled: routeConfig.enabled !== false, // Default true
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      created++;
    }

    console.log(`\n✨ Created ${created} routes\n`);

    // Stats
    const stats = {
      total: await routesCol.countDocuments({}),
      document: await routesCol.countDocuments({ kind: 'document' }),
      category: await routesCol.countDocuments({ kind: 'category' }),
      public: await routesCol.countDocuments({ isPublic: true }),
      private: await routesCol.countDocuments({ isPublic: false }),
      enabled: await routesCol.countDocuments({ enabled: true }),
      disabled: await routesCol.countDocuments({ enabled: false }),
    };

    console.log('📊 Stats:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   Document routes: ${stats.document}`);
    console.log(`   Category routes: ${stats.category}`);
    console.log(`   Public: ${stats.public}`);
    console.log(`   Private: ${stats.private}`);
    console.log(`   Enabled: ${stats.enabled}`);
    console.log(`   Disabled: ${stats.disabled}\n`);

  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Done');
  }
}

seedRoutes();
