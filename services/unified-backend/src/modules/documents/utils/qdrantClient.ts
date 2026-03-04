/**
 * Qdrant Vector Database Client
 *
 * Provides connection to Qdrant for semantic search with embeddings
 */

import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';

// Initialize Qdrant client
export const qdrant = new QdrantClient({ url: QDRANT_URL });
