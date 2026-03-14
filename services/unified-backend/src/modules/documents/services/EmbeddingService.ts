/**
 * EmbeddingService
 *
 * Proxy verso embeddings-worker per generazione embedding e ricerca semantica.
 * Tutte le operazioni vettoriali (Qdrant, Elasticsearch) sono gestite da embeddings-worker.
 */

import { logger } from '@shared/utils/logger';
import { appConfig } from '@config/runtime';

const EMBEDDINGS_SERVICE_URL = appConfig.services.embeddingsUrl;

export class EmbeddingService {
  /**
   * Generate embedding for given text via embeddings-worker
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
    type?: 'ambientazione' | 'regolamento',
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
