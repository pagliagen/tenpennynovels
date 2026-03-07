/**
 * Document Seeder
 *
 * 1. Seeds DocumentSubtypes from subtypes.csv
 * 2. Reads document content/description from separate files ({slug}.content, {slug}.description)
 * 3. Reads remaining fields from documents.csv (includes subtypeSlug and isPublic columns)
 * 4. Inserts documents to MongoDB (two-phase: root → children)
 * 5. Publishes Redis events for async embeddings
 *
 * Usage:
 *   npm run seed:documents              # Normal mode
 *   npm run seed:documents -- --force   # Clear + reseed
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

interface SubtypeCSVRow {
  slug: string;
  title: string;
  type: 'ambientazione' | 'regolamento';
  order: string;
}

interface DocumentCSVRow {
  _id: string;
  slug: string;
  title: string;
  type: 'ambientazione' | 'regolamento';
  subtypeSlug: string;
  parentId?: string;
  order: string;
  tags: string;
  isVisible: string;
  isDraft: string;
  isPublic: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

class DocumentSeeder {
  private dataDir = path.join(__dirname, '../data/documents');
  private csvPath = path.join(__dirname, '../data/documents.csv');
  private subtypesCsvPath = path.join(__dirname, '../data/subtypes.csv');
  private redis: Redis;

  constructor() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    this.redis = new Redis({ host: redisHost, port: redisPort, maxRetriesPerRequest: null });
  }

  async seed() {
    const { client, db } = await getConnection();

    try {
      const subtypesCollection = db.collection('documentsubtypes');
      const documentsCollection = db.collection('documents');
      const chunksCollection = db.collection('documentchunks');

      console.log('🌱 Document Seeder\n');

      // Clear existing data (if --force flag)
      if (process.argv.includes('--force')) {
        console.log('🗑️  --force flag detected, clearing existing data...');
        await subtypesCollection.deleteMany({});
        await documentsCollection.deleteMany({});
        await chunksCollection.deleteMany({});
        console.log('   ✓ Cleared subtypes, documents, and chunks\n');
      }

      // PHASE 0: Seed subtypes
      console.log('📝 Phase 0: Seeding subtypes...');
      const subtypeSlugToId = await this.seedSubtypes(db);
      console.log(`   ✅ Created ${subtypeSlugToId.size} subtypes\n`);

      // Read CSV
      const csvRows: DocumentCSVRow[] = await this.readCSV();
      console.log(`📄 Read ${csvRows.length} rows from CSV\n`);

      // PHASE 1: Insert root documents (parentId = null or empty)
      const rootDocs = csvRows.filter(row => !row.parentId || row.parentId === '');
      console.log(`📝 Phase 1: Inserting ${rootDocs.length} root documents...`);

      const rootIdMap = new Map<string, ObjectId>();

      for (const row of rootDocs) {
        const subtypeId = subtypeSlugToId.get(row.subtypeSlug);
        if (!subtypeId) {
          console.warn(`   ⚠️  Subtype "${row.subtypeSlug}" not found for ${row.slug}, skipping`);
          continue;
        }

        const newId = await this.insertDocument(db, row, null, subtypeId);
        rootIdMap.set(row._id, newId);
        console.log(`   ✓ ${row.slug} (${row.type}/${row.subtypeSlug})`);
      }

      console.log(`   ✅ Created ${rootDocs.length} root documents\n`);

      // PHASE 2: Insert child documents (parentId != null)
      const childDocs = csvRows.filter(row => row.parentId && row.parentId !== '');
      console.log(`📝 Phase 2: Inserting ${childDocs.length} child documents...`);

      for (const row of childDocs) {
        const parentId = rootIdMap.get(row.parentId!);
        if (!parentId) {
          console.warn(`   ⚠️  Parent ${row.parentId} not found for ${row.slug}, skipping`);
          continue;
        }

        const subtypeId = subtypeSlugToId.get(row.subtypeSlug);
        if (!subtypeId) {
          console.warn(`   ⚠️  Subtype "${row.subtypeSlug}" not found for ${row.slug}, skipping`);
          continue;
        }

        const newId = await this.insertDocument(db, row, parentId, subtypeId);
        rootIdMap.set(row._id, newId);
        console.log(`   ✓ ${row.slug} (child of ${row.parentId})`);
      }

      console.log(`   ✅ Created ${childDocs.length} child documents\n`);

      // PHASE 3: Publish embedding events
      console.log(`📝 Phase 3: Publishing embedding events...`);
      await this.publishEmbeddingEvents(db);
      console.log(`   ✅ Embedding events published\n`);

      // Stats
      const stats = {
        subtypes: await subtypesCollection.countDocuments({}),
        total: await documentsCollection.countDocuments({}),
        root: await documentsCollection.countDocuments({ parentId: null }),
        children: await documentsCollection.countDocuments({ parentId: { $ne: null } }),
        drafts: await documentsCollection.countDocuments({ isDraft: true }),
        chunks: await chunksCollection.countDocuments({ isActive: true }),
      };

      console.log('📊 Stats:');
      console.log(`   Subtypes: ${stats.subtypes}`);
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

  private async seedSubtypes(db: any): Promise<Map<string, ObjectId>> {
    const collection = db.collection('documentsubtypes');
    const slugToId = new Map<string, ObjectId>();

    let rows: SubtypeCSVRow[];
    try {
      const fileContent = await fs.readFile(this.subtypesCsvPath, 'utf8');
      rows = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });
    } catch (error) {
      console.warn('   ⚠️  subtypes.csv not found, skipping');
      return slugToId;
    }

    for (const row of rows) {
      const id = new ObjectId();
      await collection.insertOne({
        _id: id,
        slug: row.slug,
        title: row.title,
        type: row.type,
        order: parseInt(row.order, 10),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      slugToId.set(row.slug, id);
      console.log(`   ✓ ${row.type}/${row.slug}`);
    }

    return slugToId;
  }

  private async readCSV(): Promise<DocumentCSVRow[]> {
    const fileContent = await fs.readFile(this.csvPath, 'utf8');
    return parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });
  }

  private async insertDocument(
    db: any,
    row: DocumentCSVRow,
    parentId: ObjectId | null,
    subtypeId: ObjectId
  ): Promise<ObjectId> {
    const contentPath = path.join(this.dataDir, `${row.slug}.content`);
    const descriptionPath = path.join(this.dataDir, `${row.slug}.description`);

    let contentDelta: any;
    let description: string;

    try {
      const contentRaw = await fs.readFile(contentPath, 'utf8');
      contentDelta = JSON.parse(contentRaw);
    } catch {
      console.warn(`   ⚠️  Failed to read content for ${row.slug}, using empty object`);
      contentDelta = {};
    }

    try {
      description = await fs.readFile(descriptionPath, 'utf8');
    } catch {
      console.warn(`   ⚠️  Failed to read description for ${row.slug}, using empty string`);
      description = '';
    }

    let content = '';
    try {
      const { generateHtml } = await import('../../../services/unified-backend/src/modules/admin/services/HtmlGenerator.js');
      content = generateHtml(contentDelta, { injectHeadingIds: true });
    } catch {
      content = '';
    }

    // Lookup subtype slug for path calculation
    const subtype = await db.collection('documentsubtypes').findOne({ _id: subtypeId });
    const calculatedPath = subtype ? `${subtype.slug}/${row.slug}` : row.slug;

    const doc = {
      slug: row.slug,
      title: row.title,
      description,
      contentDelta,
      content,
      type: row.type,
      subtypeId,
      path: calculatedPath,
      isPublic: row.isPublic === 'true',
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

  private async publishEmbeddingEvents(db: any): Promise<void> {
    const allDocs = await db.collection('documents').find({}).toArray();

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
          contentDelta: doc.contentDelta,
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const seeder = new DocumentSeeder();
  seeder.seed().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default DocumentSeeder;
