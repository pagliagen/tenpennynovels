/**
 * Document Seeder - Complete Rewrite (Option B: Direct Database)
 *
 * NEW APPROACH:
 * 1. Reads document content/description from separate files ({slug}.content, {slug}.description)
 * 2. Reads remaining fields from documents.csv
 * 3. Inserts documents to MongoDB (two-phase: root → children)
 * 4. Generates chunks DIRECTLY using chunk-parser (no backend API dependency)
 * 5. Optionally waits for embeddings to complete
 * 6. Supports both local (Docker) and production (direct MongoDB) environments
 *
 * Usage:
 *   npm run seed:documents              # Normal mode
 *   npm run seed:documents -- --force   # Clear + reseed + force chunks
 *   npm run seed:documents -- --no-wait # Skip waiting for embeddings
 *   npm run seed:documents -- --no-chunks # Skip chunk generation entirely
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ObjectId } from 'mongodb';
import { parse } from 'csv-parse/sync';
import { getConnection } from '../utils/connection.js';
import { waitForChunkEmbeddings } from '../utils/wait-for-embeddings.js';
import { parseChunks, ParsedChunk } from '../utils/chunk-parser.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Embeddings Service URL (from env or default)
const EMBEDDINGS_SERVICE_URL = process.env.EMBEDDINGS_SERVICE_URL || 'http://127.0.0.1:5001';

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

class DocumentSeeder {
  private dataDir = path.join(__dirname, '../data/documents');
  private csvPath = path.join(__dirname, '../data/documents.csv');

  async seed(options: { forceChunks?: boolean; waitForEmbeddings?: boolean } = {}) {
    const { forceChunks = true, waitForEmbeddings = true } = options;
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

        if (forceChunks) {
          await this.generateChunks(db, newId, row.slug, row.type);
          if (waitForEmbeddings) {
            await waitForChunkEmbeddings(db, newId, 30000);
          }
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
          if (waitForEmbeddings) {
            await waitForChunkEmbeddings(db, newId, 30000);
          }
        }
      }

      console.log(`   ✅ Created ${childDocs.length} child documents\n`);

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
   * Generate embedding for a text using embeddings-service
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      console.log(`   [Embedding] Calling ${EMBEDDINGS_SERVICE_URL}/embed...`);
      const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        console.warn(`   ⚠️  Embeddings service returned ${response.status}`);
        return null;
      }

      const data = await response.json();
      console.log(`   [Embedding] ✓ Generated (${data.embedding?.length || 0} dims)`);
      return data.embedding || null;
    } catch (error: any) {
      console.error(`   ❌ Failed to generate embedding: ${error.message}`);
      console.error(`   Service URL: ${EMBEDDINGS_SERVICE_URL}`);
      return null;
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
          // Embeddings (will be populated by embeddings-worker)
          contentEmbedding: undefined,
          embeddingModel: undefined,
          embeddingGeneratedAt: undefined,
          // Audit trail
          createdAt: now,
          createdBy: auditInfo,
          updatedAt: now,
          updatedBy: auditInfo
        };

        const result = await chunksCollection.insertOne(chunkData);
        h2SlugToId.set(chunk.slug, result.insertedId as ObjectId);
        chunksCreated++;

        // Generate embedding for this chunk
        const embedding = await this.generateEmbedding(chunk.content);
        if (embedding) {
          await chunksCollection.updateOne(
            { _id: result.insertedId },
            {
              $set: {
                contentEmbedding: embedding,
                embeddingModel: 'paraphrase-multilingual-MiniLM-L12-v2',
                embeddingGeneratedAt: new Date()
              }
            }
          );
        }
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
          // Embeddings (will be populated by embeddings-worker)
          contentEmbedding: undefined,
          embeddingModel: undefined,
          embeddingGeneratedAt: undefined,
          // Audit trail
          createdAt: now,
          createdBy: auditInfo,
          updatedAt: now,
          updatedBy: auditInfo
        };

        const result = await chunksCollection.insertOne(chunkData);
        chunksCreated++;

        // Generate embedding for this chunk
        const embedding = await this.generateEmbedding(chunk.content);
        if (embedding) {
          await chunksCollection.updateOne(
            { _id: result.insertedId },
            {
              $set: {
                contentEmbedding: embedding,
                embeddingModel: 'paraphrase-multilingual-MiniLM-L12-v2',
                embeddingGeneratedAt: new Date()
              }
            }
          );
        }
      }

      console.log(`   ✓ Generated ${chunksCreated} chunks for ${slug} (v${newVersion}, deactivated ${chunksDeactivated})`);

    } catch (error: any) {
      console.error(`   ❌ Failed to generate chunks for ${slug}:`, error.message);
      console.warn(`   ⚠️  Continuing without chunks for ${slug}...`);
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const seeder = new DocumentSeeder();
  const options = {
    forceChunks: !process.argv.includes('--no-chunks'),
    waitForEmbeddings: !process.argv.includes('--no-wait')
  };
  seeder.seed(options).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default DocumentSeeder;
