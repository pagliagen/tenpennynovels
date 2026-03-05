/**
 * Document Seeder - Complete Rewrite (Option B: Direct Database)
 *
 * NEW APPROACH:
 * 1. Reads document content/description from separate files ({slug}.content, {slug}.description)
 * 2. Reads remaining fields from documents.csv
 * 3. Inserts documents to MongoDB (two-phase: root → children)
 * 4. Generates chunks DIRECTLY using chunk-parser (no backend API dependency)
 * 5. Publishes Redis events for async embeddings (processed by embeddings-worker)
 * 6. Supports both local (Docker) and production (direct MongoDB) environments
 *
 * Usage:
 *   npm run seed:documents              # Normal mode
 *   npm run seed:documents -- --force   # Clear + reseed + force chunks
 *   npm run seed:documents -- --no-chunks # Skip chunk generation entirely
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ObjectId } from 'mongodb';
import { parse } from 'csv-parse/sync';
import { getConnection } from '../utils/connection.js';
import Redis from 'ioredis';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface DocumentCSVRow {
  _id: string;
  slug: string;
  title: string;
  type: 'ambientazione' | 'approfondimenti' | 'regolamento';
  parentId?: string;
  order: string;
  tags: string;
  isVisible: string;
  isDraft: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

interface RouteCSVRow {
  slug: string;
  parentPath?: string;
  type: 'ambientazione' | 'approfondimenti' | 'regolamento';
  kind: 'document' | 'category' | 'redirect';
  rootDocumentSlug?: string;
  redirectTo?: string;
  title?: string;
  description?: string;
  isPublic: string;
  enabled: string;
  displayCategory?: string;
}

class DocumentSeeder {
  private dataDir = path.join(__dirname, '../data/documents');
  private csvPath = path.join(__dirname, '../data/documents.csv');
  private redis: Redis;

  constructor() {
    // Initialize Redis for event publishing
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      maxRetriesPerRequest: null
    });
  }

  async seed() {
    const { client, db } = await getConnection();

    try {
      const documentsCollection = db.collection('documents');
      const chunksCollection = db.collection('documentchunks');  // FIX: Match backend collection name (no underscore)
      const routesCollection = db.collection('routes');

      console.log('🌱 Document Seeder (New Approach)\n');

      // Read CSV
      const csvRows: DocumentCSVRow[] = await this.readCSV();
      console.log(`📄 Read ${csvRows.length} rows from CSV\n`);

      // Clear existing data (if --force flag)
      if (process.argv.includes('--force')) {
        console.log('🗑️  --force flag detected, clearing existing data...');
        await documentsCollection.deleteMany({});
        await chunksCollection.deleteMany({});
        await routesCollection.deleteMany({});
        console.log('   ✓ Cleared documents, chunks, and routes\n');
      }

      // PHASE 1: Insert root documents (parentId = null or empty)
      const rootDocs = csvRows.filter(row => !row.parentId || row.parentId === '');
      console.log(`📝 Phase 1: Inserting ${rootDocs.length} root documents...`);

      const rootIdMap = new Map<string, ObjectId>(); // oldId → newId

      for (const row of rootDocs) {
        const newId = await this.insertDocument(db, row, null, rootIdMap);
        rootIdMap.set(row._id, newId);
        console.log(`   ✓ ${row.slug}`);
      }

      console.log(`   ✅ Created ${rootDocs.length} root documents\n`);

      // PHASE 2: Insert child documents (parentId != null)
      const childDocs = csvRows.filter(row => row.parentId && row.parentId !== '');
      console.log(`📝 Phase 2: Inserting ${childDocs.length} child documents...`);

      for (const row of childDocs) {
        const parentId = rootIdMap.get(row.parentId);
        if (!parentId) {
          console.warn(`   ⚠️  Parent ${row.parentId} not found for ${row.slug}, skipping`);
          continue;
        }

        const newId = await this.insertDocument(db, row, parentId, rootIdMap);
        rootIdMap.set(row._id, newId);
        console.log(`   ✓ ${row.slug} (child of ${row.parentId})`);
      }

      console.log(`   ✅ Created ${childDocs.length} child documents\n`);

      // PHASE 3: Insert routes (after all documents exist)
      console.log(`📝 Phase 3: Inserting routes...`);
      await this.seedRoutes(db, rootIdMap);
      console.log(`   ✅ Routes seeded\n`);

      // PHASE 4: Publish embedding events (triggers automatic chunking + embeddings)
      console.log(`📝 Phase 4: Publishing embedding events...`);
      await this.publishEmbeddingEvents(db);
      console.log(`   ✅ Embedding events published\n`);

      // Stats
      const stats = {
        total: await documentsCollection.countDocuments({}),
        root: await documentsCollection.countDocuments({ parentId: null }),
        children: await documentsCollection.countDocuments({ parentId: { $ne: null } }),
        drafts: await documentsCollection.countDocuments({ isDraft: true }),
        chunks: await chunksCollection.countDocuments({ isActive: true }),
      };

      console.log('📊 Stats:');
      console.log(`   Total documents: ${stats.total}`);
      console.log(`   Root documents: ${stats.root}`);
      console.log(`   Children: ${stats.children}`);
      console.log(`   Drafts: ${stats.drafts}`);
      console.log(`   Active chunks: ${stats.chunks}\n`);

      console.log('✅ Document seeding complete');

    } catch (error) {
      console.error('❌ Seeding failed:', error);
      throw error;
    } finally {
      await client.close();
      await this.redis.quit();
      console.log('👋 Done');
    }
  }

  private async readCSV(): Promise<DocumentCSVRow[]> {
    try {
      const fileContent = await fs.readFile(this.csvPath, 'utf8');
      const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      return records as DocumentCSVRow[];
    } catch (error) {
      console.error(`Failed to read CSV from ${this.csvPath}:`, error);
      throw error;
    }
  }

  private async insertDocument(
    db: any,
    row: DocumentCSVRow,
    parentId: ObjectId | null,
    _idMap: Map<string, ObjectId>
  ): Promise<ObjectId> {
    const contentPath = path.join(this.dataDir, `${row.slug}.content`);
    const descriptionPath = path.join(this.dataDir, `${row.slug}.description`);

    let contentDelta: any;
    let description: string;

    try {
      const contentRaw = await fs.readFile(contentPath, 'utf8');
      contentDelta = JSON.parse(contentRaw);
    } catch (error) {
      console.warn(`   ⚠️  Failed to read content for ${row.slug}, using empty object`);
      contentDelta = {};
    }

    try {
      description = await fs.readFile(descriptionPath, 'utf8');
    } catch (error) {
      console.warn(`   ⚠️  Failed to read description for ${row.slug}, using empty string`);
      description = '';
    }

    // Generate HTML content from contentDelta using same logic as Document model pre-save hook
    let content = '';
    try {
      const { generateHtml } = await import('../../../services/unified-backend/src/modules/admin/services/HtmlGenerator.js');
      content = generateHtml(contentDelta, { injectHeadingIds: true });
    } catch (error) {
      console.warn(`   ⚠️  Failed to generate HTML for ${row.slug}, using empty string`);
      content = '';
    }

    const doc = {
      slug: row.slug,
      title: row.title,
      description,
      contentDelta,
      content, // Generated HTML
      type: row.type,
      parentId,
      order: parseInt(row.order.toString(), 10),
      tags: row.tags ? row.tags.split('|').filter(Boolean) : [],
      visible: row.isVisible === 'true',
      isDraft: row.isDraft === 'true',
      createdAt: new Date(row.createdAt),
      lastUpdated: new Date(row.updatedAt)
    };

    const result = await db.collection('documents').insertOne(doc);
    return result.insertedId;
  }

  /**
   * Publish embedding event to Redis for async processing
   * Falls back to skipping if Redis unavailable
   */
  /**
   * Seed routes from routes.csv (Phase 3)
   * Two-phase insertion: root routes → child routes
   */
  private async seedRoutes(db: any, documentSlugMap: Map<string, ObjectId>): Promise<void> {
    const routesCol = db.collection('routes');
    const csvPath = path.join(__dirname, '../data/routes.csv');

    // Read routes CSV
    let routeRows: RouteCSVRow[];
    try {
      const fileContent = await fs.readFile(csvPath, 'utf8');
      routeRows = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    } catch (error) {
      console.warn(`   ⚠️  routes.csv not found, skipping route seeding`);
      return;
    }

    console.log(`   Read ${routeRows.length} routes from CSV`);

    // Build document slug → _id map
    const documentsCol = db.collection('documents');
    const allDocs = await documentsCol.find({}).toArray();
    const docSlugToId = new Map<string, ObjectId>();
    for (const doc of allDocs) {
      docSlugToId.set(doc.slug, doc._id);
    }
    console.log(`   Mapped ${docSlugToId.size} document slugs`);

    // TWO-PHASE INSERTION: root routes → child routes
    const rootRoutes = routeRows.filter(row => !row.parentPath || row.parentPath === '');
    const routePathToId = new Map<string, ObjectId>(); // Track inserted route path → _id

    // Phase 3a: Root routes
    console.log(`   Phase 3a: Inserting ${rootRoutes.length} root routes...`);
    for (const row of rootRoutes) {
      const routeId = await this.insertRoute(db, row, null, docSlugToId);
      const fullPath = row.slug; // Root route path = slug
      routePathToId.set(fullPath, routeId);
      console.log(`   ✓ ${fullPath} (${row.kind})`);
    }

    // Phase 3b: Child routes
    const childRoutes = routeRows.filter(row => row.parentPath && row.parentPath !== '');
    console.log(`   Phase 3b: Inserting ${childRoutes.length} child routes...`);
    for (const row of childRoutes) {
      const parentId = routePathToId.get(row.parentPath!);
      if (!parentId) {
        console.warn(`   ⚠️  Parent route "${row.parentPath}" not found for ${row.slug}, skipping`);
        continue;
      }

      const routeId = await this.insertRoute(db, row, parentId, docSlugToId);
      const fullPath = `${row.parentPath}/${row.slug}`; // Calculate full path
      routePathToId.set(fullPath, routeId);
      console.log(`   ✓ ${fullPath} (${row.kind})`);
    }

    // Stats
    const routeStats = {
      total: await routesCol.countDocuments({}),
      document: await routesCol.countDocuments({ kind: 'document' }),
      category: await routesCol.countDocuments({ kind: 'category' }),
      redirect: await routesCol.countDocuments({ kind: 'redirect' })
    };

    console.log(`   Routes: ${routeStats.total} total (${routeStats.document} document, ${routeStats.category} category, ${routeStats.redirect} redirect)`);
  }

  /**
   * Insert single route with validation
   */
  private async insertRoute(
    db: any,
    row: RouteCSVRow,
    parentId: ObjectId | null,
    docSlugToId: Map<string, ObjectId>
  ): Promise<ObjectId> {
    const routesCol = db.collection('routes');

    // Resolve rootDocumentSlug → ObjectId
    let rootDocumentId: ObjectId | undefined;
    if (row.rootDocumentSlug && row.rootDocumentSlug !== '') {
      rootDocumentId = docSlugToId.get(row.rootDocumentSlug);
      if (!rootDocumentId) {
        throw new Error(`Document "${row.rootDocumentSlug}" not found for route "${row.slug}"`);
      }
    }

    // Validation: kind=document requires rootDocumentId
    if (row.kind === 'document' && !rootDocumentId) {
      throw new Error(`Route kind=document requires rootDocumentSlug (route: ${row.slug})`);
    }

    // Calculate full path
    let fullPath: string;
    if (parentId) {
      // Lookup parent to get its path
      const parent = await routesCol.findOne({ _id: parentId });
      if (!parent) {
        throw new Error(`Parent route not found for ${row.slug}`);
      }
      fullPath = `${parent.path}/${row.slug}`;
    } else {
      fullPath = row.slug;
    }

    const routeData = {
      _id: new ObjectId(),
      parentId,
      slug: row.slug,
      path: fullPath,
      type: row.type,
      kind: row.kind,
      rootDocumentId,
      redirectTo: row.redirectTo || undefined,
      title: row.title || undefined,
      description: row.description || undefined,
      displayCategory: row.displayCategory || undefined,
      isPublic: row.isPublic === 'true',
      enabled: row.enabled !== 'false', // Default true
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await routesCol.insertOne(routeData);
    return routeData._id;
  }

  /**
   * Publish embedding events for all documents (Phase 4)
   * Triggers automatic chunking + embedding generation in embeddings-worker
   */
  private async publishEmbeddingEvents(db: any): Promise<void> {
    const documentsCol = db.collection('documents');
    const allDocs = await documentsCol.find({}).toArray();

    console.log(`   Publishing events for ${allDocs.length} documents...`);

    let published = 0;
    for (const doc of allDocs) {
      try {
        const event = {
          eventId: crypto.randomUUID(),
          timestamp: new Date(),
          documentId: doc._id.toString(),
          title: doc.title,
          content: doc.content || '',
          contentDelta: doc.contentDelta, // Include for chunking
          type: doc.type
        };

        await this.redis.publish('embedding:document:created', JSON.stringify(event));
        published++;

        if (published % 10 === 0) {
          console.log(`   Published ${published}/${allDocs.length} events...`);
        }
      } catch (error) {
        console.error(`   ⚠️  Failed to publish event for ${doc.slug}:`, error);
      }
    }

    console.log(`   Published ${published} embedding events successfully`);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const seeder = new DocumentSeeder();
  seeder.seed().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default DocumentSeeder;
