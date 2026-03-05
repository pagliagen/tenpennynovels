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
import { parseChunks, ParsedChunk } from '../utils/chunk-parser.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { redisSeeder } from '../utils/redis-connection.js';
import { EmbeddingSeederPublisher } from '../utils/embedding-publisher.js';

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
  private embeddingPublisher?: EmbeddingSeederPublisher;

  async seed(options: { forceChunks?: boolean } = {}) {
    const { forceChunks = true } = options;
    const { client, db } = await getConnection();

    // Connect Redis for embedding events
    try {
      await redisSeeder.connect();
      const publisher = redisSeeder.getPublisher();
      this.embeddingPublisher = new EmbeddingSeederPublisher(publisher);
      console.log('✅ Redis connection established for embeddings\n');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      console.warn('⚠️  Proceeding without async embeddings\n');
      this.embeddingPublisher = undefined;
    }

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

        if (forceChunks) {
          await this.generateChunks(db, newId, row.slug, row.type);
        }
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

        if (forceChunks) {
          await this.generateChunks(db, newId, row.slug, row.type);
        }
      }

      console.log(`   ✅ Created ${childDocs.length} child documents\n`);

      // PHASE 3: Insert routes (after all documents exist)
      console.log(`📝 Phase 3: Inserting routes...`);
      await this.seedRoutes(db, rootIdMap);
      console.log(`   ✅ Routes seeded\n`);

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
      try {
        await redisSeeder.disconnect();
      } catch (error) {
        console.error('⚠️  Error disconnecting Redis:', error);
      }
      await client.close();
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

    const doc = {
      _id: new ObjectId(),
      slug: row.slug,
      title: row.title,
      description,
      contentDelta,
      type: row.type,
      parentId,
      order: parseInt(row.order.toString(), 10),
      tags: row.tags ? row.tags.split('|').filter(Boolean) : [],
      isVisible: row.isVisible === 'true',
      isDraft: row.isDraft === 'true',
      version: parseInt(row.version.toString(), 10),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };

    await db.collection('documents').insertOne(doc);

    return doc._id;
  }

  /**
   * Publish embedding event to Redis for async processing
   * Falls back to skipping if Redis unavailable
   */
  private async publishEmbeddingEvent(
    chunkId: string,
    documentId: ObjectId,
    chunk: ParsedChunk,
    documentType: string
  ): Promise<void> {
    try {
      if (!this.embeddingPublisher) {
        console.warn('   ⚠️  Redis publisher unavailable, skipping embedding');
        return;
      }

      await this.embeddingPublisher.publishDocumentChunkEvent(
        chunkId,
        documentId.toString(),
        chunk.slug,
        chunk.heading,
        chunk.content,
        documentType as 'ambientazione' | 'approfondimenti' | 'regolamento',
        chunk.order,
        chunk.headingLevel,
        chunk.parentSlug
      );
    } catch (error: any) {
      console.error(`   ❌ Failed to publish embedding event: ${error.message}`);
    }
  }

  /**
   * Generate chunks directly using chunk-parser (Option B)
   *
   * Flow:
   * 1. Fetch document from MongoDB to get contentDelta
   * 2. Parse contentDelta using chunk-parser
   * 3. Deactivate old chunks (soft delete)
   * 4. Calculate new version
   * 5. Insert new chunks (two-phase: H2 → H3)
   * 6. Generate embeddings by calling embeddings-service directly
   */
  private async generateChunks(db: any, documentId: ObjectId, slug: string, documentType: string): Promise<void> {
    try {
      const documentsCollection = db.collection('documents');
      const chunksCollection = db.collection('documentchunks');

      // STEP 1: Fetch document to get contentDelta
      const document = await documentsCollection.findOne({ _id: documentId });
      if (!document) {
        console.warn(`   ⚠️  Document ${slug} not found, skipping chunk generation`);
        return;
      }

      const contentDelta = document.contentDelta;
      if (!contentDelta || Object.keys(contentDelta).length === 0) {
        console.warn(`   ⚠️  Document ${slug} has empty contentDelta, skipping chunk generation`);
        return;
      }

      // STEP 2: Parse contentDelta → chunks
      let parsedChunks: ParsedChunk[];
      try {
        const delta = typeof contentDelta === 'string' ? JSON.parse(contentDelta) : contentDelta;
        parsedChunks = parseChunks(delta);

        if (parsedChunks.length === 0) {
          console.warn(`   ⚠️  No chunks parsed from ${slug}`);
          return;
        }
      } catch (parseError: any) {
        console.error(`   ❌ Failed to parse contentDelta for ${slug}:`, parseError.message);
        return;
      }

      // STEP 3: Deactivate old chunks (soft delete)
      const deactivateResult = await chunksCollection.updateMany(
        { documentId, isActive: true },
        { $set: { isActive: false } }
      );
      const chunksDeactivated = deactivateResult.modifiedCount;

      // STEP 4: Calculate new version
      const oldChunks = await chunksCollection
        .find({ documentId })
        .sort({ version: -1 })
        .limit(1)
        .toArray();
      const newVersion = (oldChunks[0]?.version || 0) + 1;

      // STEP 5: Create new chunks (TWO-PHASE: H2 first, then H3)
      let chunksCreated = 0;
      const now = new Date();
      const auditInfo = { userId: 'seeder', username: 'seeder' };

      // Split by heading level
      const h2Chunks = parsedChunks.filter(c => c.headingLevel === 2);
      const h3Chunks = parsedChunks.filter(c => c.headingLevel === 3);

      // Map to store H2 slug → _id for H3 parent references
      const h2SlugToId = new Map<string, ObjectId>();

      // PHASE 1: Insert H2 chunks first
      for (const chunk of h2Chunks) {
        const chunkData = {
          documentId,
          slug: chunk.slug,
          slugHistory: [chunk.slug],
          title: chunk.heading,
          headingLevel: 2,
          content: chunk.content,
          order: chunk.order,
          documentType,
          version: newVersion,
          isActive: true,
          parentChunkId: undefined,
          parentSlug: undefined,
          // Audit trail
          createdAt: now,
          createdBy: auditInfo,
          updatedAt: now,
          updatedBy: auditInfo
        };

        const result = await chunksCollection.insertOne(chunkData);
        h2SlugToId.set(chunk.slug, result.insertedId as ObjectId);
        chunksCreated++;

        // Publish embedding event to Redis for async processing
        await this.publishEmbeddingEvent(
          result.insertedId.toString(),
          documentId,
          chunk,
          documentType
        );
      }

      // PHASE 2: Insert H3 chunks with parent references
      for (const chunk of h3Chunks) {
        const parentChunkId = chunk.parentSlug ? h2SlugToId.get(chunk.parentSlug) : undefined;

        const chunkData = {
          documentId,
          slug: chunk.slug,
          slugHistory: [chunk.slug],
          title: chunk.heading,
          headingLevel: 3,
          content: chunk.content,
          order: chunk.order,
          documentType,
          version: newVersion,
          isActive: true,
          parentChunkId,
          parentSlug: chunk.parentSlug,
          // Audit trail
          createdAt: now,
          createdBy: auditInfo,
          updatedAt: now,
          updatedBy: auditInfo
        };

        const result = await chunksCollection.insertOne(chunkData);
        chunksCreated++;

        // Publish embedding event to Redis for async processing
        await this.publishEmbeddingEvent(
          result.insertedId.toString(),
          documentId,
          chunk,
          documentType
        );
      }

      console.log(`   ✓ Generated ${chunksCreated} chunks for ${slug} (v${newVersion}, deactivated ${chunksDeactivated})`);

    } catch (error: any) {
      console.error(`   ❌ Failed to generate chunks for ${slug}:`, error.message);
      console.warn(`   ⚠️  Continuing without chunks for ${slug}...`);
    }
  }

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
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const seeder = new DocumentSeeder();
  const options = {
    forceChunks: !process.argv.includes('--no-chunks')
  };
  seeder.seed(options).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default DocumentSeeder;
