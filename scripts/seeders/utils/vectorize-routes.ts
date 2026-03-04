/**
 * Vectorize Routes - Seed Qdrant with route embeddings
 *
 * Creates vector embeddings for all enabled routes and stores them in Qdrant.
 * Used for typo-tolerant routing with semantic search fallback.
 *
 * Flow:
 * 1. Fetch all enabled routes from MongoDB
 * 2. Generate embeddings for each route (path + title)
 * 3. Store in Qdrant collection "routes_vectors"
 * 4. Used by DocumentController for 302 fallback on 404
 */

import { MongoClient, ObjectId } from 'mongodb';
import { QdrantClient } from '@qdrant/js-client-rest';
import { randomUUID } from 'crypto';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/tenpennynovels?authSource=admin';
const DB_NAME = 'tenpennynovels';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const EMBEDDINGS_SERVICE_URL = process.env.EMBEDDINGS_SERVICE_URL || 'http://localhost:5001';
const COLLECTION_NAME = 'routes_vectors';

interface Route {
  _id: ObjectId;
  path: string;
  type: 'ambientazione' | 'regolamento';
  kind: 'document' | 'category' | 'redirect';
  title: string;
  description?: string;
  enabled: boolean;
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

async function vectorizeRoutes() {
  console.log('🔍 Vectorizing Routes for Semantic Search Fallback\n');

  const mongoClient = new MongoClient(MONGODB_URI);
  const qdrant = new QdrantClient({ url: QDRANT_URL });

  try {
    // ========== STEP 1: Connect to MongoDB ==========
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const routesCol = db.collection<Route>('routes');
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

    // ========== STEP 3: Fetch all enabled routes ==========
    console.log('📄 Fetching routes...');
    const routes = await routesCol.find({ enabled: true }).toArray();
    console.log(`   Found ${routes.length} enabled routes\n`);

    // ========== STEP 4: Generate embeddings and insert ==========
    console.log('🔢 Generating embeddings and inserting into Qdrant...\n');

    let processed = 0;
    const points: any[] = [];

    for (const route of routes) {
      // Create searchable text: path + title + description
      const searchText = [
        route.path.replace(/\//g, ' '),  // "approfondimenti/medicina" → "approfondimenti medicina"
        route.title,
        route.description || ''
      ].filter(Boolean).join(' ');

      console.log(`   [${processed + 1}/${routes.length}] ${route.type}/${route.path}`);

      // Generate embedding
      const embedding = await generateEmbedding(searchText);

      // Prepare point (use UUID for Qdrant, store MongoDB _id in payload)
      points.push({
        id: randomUUID(),  // Qdrant requires UUID or unsigned int
        vector: embedding,
        payload: {
          routeId: route._id.toString(),
          type: route.type,
          path: route.path,
          kind: route.kind,
          title: route.title,
          description: route.description || '',
          searchText  // Store for debugging
        }
      });

      processed++;

      // Batch insert every 10 points
      if (points.length >= 10) {
        await qdrant.upsert(COLLECTION_NAME, { points });
        points.length = 0;  // Clear array
      }
    }

    // Insert remaining points
    if (points.length > 0) {
      await qdrant.upsert(COLLECTION_NAME, { points });
    }

    console.log(`\n✨ Vectorization complete!`);
    console.log(`   Total routes vectorized: ${processed}`);
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

vectorizeRoutes();
