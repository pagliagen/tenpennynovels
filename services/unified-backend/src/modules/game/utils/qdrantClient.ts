/**
 * Qdrant Vector Database Client
 *
 * Provides connection to Qdrant for semantic search with embeddings
 */

import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

// Initialize Qdrant client
export const qdrant = new QdrantClient({ url: QDRANT_URL });

/**
 * Collection names
 */
export const COLLECTIONS = {
  DOCUMENTS: 'documents',
  LOCATION_ACTIONS: 'location_actions'
} as const;

/**
 * Initialize Qdrant collections
 * Creates collections if they don't exist
 */
export async function initQdrantCollections(): Promise<void> {
  try {
    console.log('🔍 Initializing Qdrant collections...');

    // Get existing collections
    const { collections } = await qdrant.getCollections();
    const existingNames = collections.map(c => c.name);

    // ========== DOCUMENTS COLLECTION ==========
    if (!existingNames.includes(COLLECTIONS.DOCUMENTS)) {
      await qdrant.createCollection(COLLECTIONS.DOCUMENTS, {
        vectors: {
          size: 384,  // paraphrase-multilingual-MiniLM-L12-v2
          distance: 'Cosine'
        }
      });
      console.log(`✅ Qdrant collection "${COLLECTIONS.DOCUMENTS}" created`);
    } else {
      console.log(`✅ Qdrant collection "${COLLECTIONS.DOCUMENTS}" already exists`);
    }

    // ========== LOCATION ACTIONS COLLECTION ==========
    if (!existingNames.includes(COLLECTIONS.LOCATION_ACTIONS)) {
      await qdrant.createCollection(COLLECTIONS.LOCATION_ACTIONS, {
        vectors: {
          size: 384,  // paraphrase-multilingual-MiniLM-L12-v2
          distance: 'Cosine'
        }
      });
      console.log(`✅ Qdrant collection "${COLLECTIONS.LOCATION_ACTIONS}" created`);
    } else {
      console.log(`✅ Qdrant collection "${COLLECTIONS.LOCATION_ACTIONS}" already exists`);
    }

    console.log('✅ Qdrant collections initialized successfully');

  } catch (error: any) {
    console.error('❌ Qdrant initialization failed:', error.message);
    console.error('   Make sure Qdrant is running on', QDRANT_URL);
    // Don't throw - allow app to start even if Qdrant is down
  }
}

/**
 * Health check for Qdrant connection
 */
export async function checkQdrantHealth(): Promise<boolean> {
  try {
    const { collections } = await qdrant.getCollections();
    return true;
  } catch (error) {
    console.error('Qdrant health check failed:', error);
    return false;
  }
}
