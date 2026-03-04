/**
 * EmbeddingService
 *
 * Service for embeddings generation and vector search operations.
 * Handles semantic search with Qdrant and typo-tolerant routing.
 */

import { logger } from '@shared/utils/logger';
import { qdrant } from '../utils/qdrantClient';

const EMBEDDINGS_SERVICE_URL = process.env.EMBEDDINGS_SERVICE_URL || 'http://127.0.0.1:5001';
const ROUTES_COLLECTION = 'routes_vectors';
const DOCUMENTS_COLLECTION = 'documents_vectors';

export class EmbeddingService {
  /**
   * Generate embedding for given text
   *
   * @param text - Text to embed
   * @param timeout - Request timeout in milliseconds (default 5000)
   * @returns Embedding vector or null if failed
   */
  static async generateEmbedding(text: string, timeout: number = 5000): Promise<number[] | null> {
    try {
      const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(timeout)
      });

      if (!response.ok) {
        logger.error(`Embeddings service error: ${response.status}`);
        return null;
      }

      const data = await response.json() as { success: boolean; embedding?: number[] };

      if (!data.success || !data.embedding) {
        logger.error('Failed to generate embedding');
        return null;
      }

      return data.embedding;

    } catch (error: any) {
      logger.error(`Error generating embedding: ${error.message}`);
      return null;
    }
  }

  /**
   * Find similar route using vector search (typo-tolerant routing)
   *
   * Used as fallback when route not found - searches for semantically similar routes
   * and suggests redirect if match is good enough.
   *
   * @param type - Route type to filter by
   * @param searchPath - The path that was not found (e.g., "folgore")
   * @param minSimilarity - Minimum similarity threshold (default 0.55)
   * @returns Similar route info or null if no good match
   */
  static async findSimilarRoute(
    type: 'ambientazione' | 'approfondimenti' | 'regolamento',
    searchPath: string,
    minSimilarity: number = 0.55
  ): Promise<{ type: string; path: string; similarity: number } | null> {
    try {
      // Generate embedding for search path
      const embedding = await this.generateEmbedding(searchPath);

      if (!embedding) {
        return null;
      }

      // Vector search in Qdrant with type and kind filters
      const searchResults = await qdrant.search(ROUTES_COLLECTION, {
        vector: embedding,
        limit: 1,
        score_threshold: minSimilarity,
        filter: {
          must: [
            { key: 'type', match: { value: type } },
            { key: 'kind', match: { value: 'document' } }
          ]
        }
      });

      if (searchResults.length === 0) {
        return null;
      }

      const match = searchResults[0];

      return {
        type: match.payload?.type as string,
        path: match.payload?.path as string,
        similarity: match.score
      };

    } catch (error: any) {
      logger.error(`Error in findSimilarRoute: ${error.message}`);
      return null;
    }
  }

  /**
   * Semantic search for documents
   *
   * @param query - Search query text
   * @param type - Document type filter (optional)
   * @param limit - Max results to return (default 10)
   * @param minScore - Minimum similarity score threshold (default 0.4)
   * @returns Array of matching documents with scores
   */
  static async semanticSearch(
    query: string,
    type?: 'ambientazione' | 'approfondimenti' | 'regolamento',
    limit: number = 10,
    minScore: number = 0.4
  ): Promise<Array<{ documentId: string; title: string; score: number; type: string; path: string }>> {
    try {
      // Generate embedding for query
      const embedding = await this.generateEmbedding(query);

      if (!embedding) {
        return [];
      }

      // Build filter
      const filter: any = {};
      if (type) {
        filter.must = [{ key: 'documentType', match: { value: type } }];
      }

      // Vector search in Qdrant
      const searchResults = await qdrant.search(DOCUMENTS_COLLECTION, {
        vector: embedding,
        limit,
        score_threshold: minScore,
        filter: Object.keys(filter).length > 0 ? filter : undefined
      });

      // Map results
      return searchResults.map(result => ({
        documentId: result.payload?.documentId as string,
        title: result.payload?.title as string,
        score: result.score,
        type: result.payload?.documentType as string,
        path: result.payload?.path as string
      }));

    } catch (error: any) {
      logger.error(`Error in semanticSearch: ${error.message}`);
      return [];
    }
  }
}
