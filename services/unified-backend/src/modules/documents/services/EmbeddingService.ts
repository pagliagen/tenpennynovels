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
   * Hybrid search (keyword + semantic) via embeddings-worker
   *
   * Delegates search to embeddings-worker /search endpoint which combines
   * ElasticSearch keyword search with Qdrant semantic search using RRF.
   *
   * @param query - Search query text
   * @param type - Document type filter (optional)
   * @param limit - Max results to return (default 10)
   * @param minScore - Minimum similarity score threshold (default 0.4)
   * @returns Array of matching document chunks with hybrid scores
   */
  static async semanticSearch(
    query: string,
    type?: 'ambientazione' | 'approfondimenti' | 'regolamento',
    limit: number = 10,
    minScore: number = 0.4
  ): Promise<Array<{ chunkId: string; documentId: string; slug: string; heading: string; score: number; type: string; parentSlug?: string }>> {
    try {
      logger.info(`[EmbeddingService] Calling embeddings-worker: ${EMBEDDINGS_SERVICE_URL}/search`);
      logger.info(`[EmbeddingService] Request payload: ${JSON.stringify({ query, type, limit, minScore })}`);

      const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, type, limit, minScore }),
        signal: AbortSignal.timeout(10000)
      });

      logger.info(`[EmbeddingService] Response status: ${response.status}`);

      if (!response.ok) {
        logger.error(`Search service error: ${response.status}`);
        return [];
      }

      const data = await response.json() as { success: boolean; results?: any[] };
      logger.info(`[EmbeddingService] Response data: ${JSON.stringify({ success: data.success, resultsCount: data.results?.length || 0 })}`);

      if (!data.success || !data.results) {
        logger.warn(`[EmbeddingService] Invalid response: success=${data.success}, results=${!!data.results}`);
        return [];
      }

      return data.results;

    } catch (error: any) {
      logger.error(`Error in semanticSearch: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
      return [];
    }
  }
}
