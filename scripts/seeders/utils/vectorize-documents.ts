/**
 * Vectorize Documents - Seed Qdrant with document embeddings
 *
 * Creates vector embeddings for all documents content and stores them in Qdrant.
 * Used for semantic search functionality.
 *
 * Flow:
 * 1. Fetch all documents from MongoDB
 * 2. Generate embeddings for each document (title + content)
 * 3. Store in Qdrant collection "documents"
 * 4. Used by DocumentController for semantic search
 */

import { MongoClient, ObjectId } from 'mongodb';
import { QdrantClient } from '@qdrant/js-client-rest';
import { randomUUID } from 'crypto';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin';
const DB_NAME = 'tenpennynovels';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const EMBEDDINGS_SERVICE_URL = process.env.EMBEDDINGS_SERVICE_URL || 'http://localhost:5001';
const COLLECTION_NAME = 'documents';

interface Document {
  _id: ObjectId;
  slug: string;
  title: string;
  content: string;
  description?: string;
  parentId?: ObjectId | null;
  tags?: string[];
  isDraft?: boolean;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Embeddings service error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.success || !data.embedding) {
    throw new Error('Failed to generate embedding');
  }

  return data.embedding;
}

async function vectorizeDocuments() {
  console.log('🔍 Vectorizing Documents for Semantic Search\n');

  const mongoClient = new MongoClient(MONGODB_URI);
  const qdrant = new QdrantClient({ url: QDRANT_URL });

  try {
    // ========== STEP 1: Connect to MongoDB ==========
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const documentsCol = db.collection<Document>('documents');
    console.log('✅ Connected to MongoDB\n');

    // ========== STEP 2: Create Qdrant collection ==========
    console.log('📦 Setting up Qdrant collection...');

    const collections = await qdrant.getCollections();
    const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (collectionExists) {
      console.log(`   Deleting existing collection "${COLLECTION_NAME}"...`);
      await qdrant.deleteCollection(COLLECTION_NAME);
    }

    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 384,  // paraphrase-multilingual-MiniLM-L12-v2
        distance: 'Cosine'
      }
    });
    console.log(`   ✅ Collection "${COLLECTION_NAME}" created\n`);

    // ========== STEP 3: Fetch all documents ==========
    console.log('📄 Fetching documents...');
    const documents = await documentsCol.find({}).toArray();
    console.log(`   Found ${documents.length} documents\n`);

    // ========== STEP 4: Generate embeddings and insert ==========
    console.log('🔢 Generating embeddings and inserting into Qdrant...\n');

    let processed = 0;
    const points: any[] = [];

    for (const doc of documents) {
      // Skip placeholder documents (too short content = not useful for semantic search)
      const MIN_CONTENT_LENGTH = 200;
      if (doc.content.length < MIN_CONTENT_LENGTH) {
        console.log(`   [${processed + 1}/${documents.length}] ${doc.slug} (skipped - placeholder)`);
        processed++;
        continue;
      }

      // Create searchable text: title + content (first 2000 chars to avoid token limits)
      const searchText = [
        doc.title,
        doc.description || '',
        doc.content.substring(0, 2000).replace(/[#*`\[\]]/g, '') // Remove markdown chars
      ].filter(Boolean).join(' ');

      console.log(`   [${processed + 1}/${documents.length}] ${doc.slug}`);

      // Generate embedding
      const embedding = await generateEmbedding(searchText);

      // Prepare point (use UUID for Qdrant, store MongoDB _id in payload)
      points.push({
        id: randomUUID(),
        vector: embedding,
        payload: {
          documentId: doc._id.toString(),
          slug: doc.slug,
          title: doc.title,
          description: doc.description || '',
          parentId: doc.parentId?.toString() || null,
          tags: doc.tags || [],
          isDraft: doc.isDraft || false,
          searchText: searchText.substring(0, 500) // Store preview for debugging
        }
      });

      processed++;

      // Batch insert every 10 points
      if (points.length >= 10) {
        await qdrant.upsert(COLLECTION_NAME, { points });
        points.length = 0;
      }
    }

    // Insert remaining points
    if (points.length > 0) {
      await qdrant.upsert(COLLECTION_NAME, { points });
    }

    console.log(`\n✨ Vectorization complete!`);
    console.log(`   Total documents vectorized: ${processed}`);
    console.log(`   Collection: ${COLLECTION_NAME}`);
    console.log(`   Vector size: 384 (multilingual)`);
    console.log(`   Distance metric: Cosine\n`);

  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  } finally {
    await mongoClient.close();
    console.log('👋 Done');
  }
}

vectorizeDocuments();
