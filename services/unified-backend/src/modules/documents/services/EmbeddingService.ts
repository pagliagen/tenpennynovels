/**
 * EmbeddingService
 *
 * Proxy verso embeddings-worker per generazione embedding e ricerca semantica.
 * Tutte le operazioni vettoriali (Qdrant, Elasticsearch) sono gestite da embeddings-worker.
 */

import { logger } from '@shared/utils/logger';
import { appConfig } from '@config/runtime';

const EMBEDDINGS_SERVICE_URL = appConfig.services.embeddingsUrl;

interface QAContextChunk {
  heading: string;
  content: string;
  source?: { documentId?: string; slug?: string; fullPath?: string; title?: string; subtypeTitle?: string };
}

interface QAResponse {
  success: boolean;
  answer?: string;
  sources?: Array<{ heading: string; slug?: string; fullPath?: string; title?: string; used: boolean }>;
  metadata?: { model: string; tokensUsed: number };
  error?: string;
}

interface QAExtractKeywordsResponse {
  success: boolean;
  keywords: string[];
}

interface QAExtractInsightResponse {
  success: boolean;
  hasNewInfo: boolean;
  insight: string;
}

export class EmbeddingService {
  // Ollama availability is cached briefly: /ask, extractKeywords and extractInsight
  // are all called within a single search request and would otherwise each trigger
  // their own live ping to embeddings-worker's /health (and thus to Ollama).
  private static aiHealthy: boolean | null = null;
  private static aiHealthCheckedAt = 0;
  private static readonly AI_HEALTH_TTL_MS = 60_000;

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
   * @param source - Source type: 'documents', 'forum', 'chat' (optional)
   * @param filters - Additional filters (e.g., topicSlug, locationId, characterId, dateStart, dateEnd)
   * @returns Array of matching results with hybrid scores
   */
  static async semanticSearch(
    query: string,
    type?: 'ambientazione' | 'regolamento',
    limit: number = 10,
    minScore: number = 0.4,
    source?: 'documents' | 'forum' | 'chat',
    filters?: Record<string, any>
  ): Promise<any[]> {
    try {
      const requestBody: any = { query, type, limit, minScore };
      if (source) requestBody.source = source;
      if (filters) requestBody.filters = filters;

      logger.info(`[EmbeddingService] Calling embeddings-worker: ${EMBEDDINGS_SERVICE_URL}/search`);
      logger.info(`[EmbeddingService] Request payload: ${JSON.stringify(requestBody)}`);

      const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
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

  /**
   * Whether the RAG (Bibliotecario) path is available, i.e. embeddings-worker
   * is reachable AND Ollama is up. Cached for AI_HEALTH_TTL_MS to avoid a live
   * Ollama probe on every question.
   */
  static async isAiAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this.aiHealthy !== null && now - this.aiHealthCheckedAt < this.AI_HEALTH_TTL_MS) {
      return this.aiHealthy;
    }

    try {
      const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/health`, {
        signal: AbortSignal.timeout(3000)
      });
      const data = await response.json() as { ollama?: boolean };
      this.aiHealthy = data.ollama === true;
    } catch {
      this.aiHealthy = false;
    }

    this.aiHealthCheckedAt = now;
    return this.aiHealthy;
  }

  /**
   * Risposta AI del Bibliotecario legata al servizio AI, non gestito dal
   * server al momento. Config keeper_qa_enabled (sezione ai_features),
   * default OFF: la ricerca documenti resta sempre attiva, solo questa
   * generazione di risposte si disattiva.
   */
  static async isKeeperQaEnabled(): Promise<boolean> {
    try {
      const { ConfigurationService } = await import('@shared/services/ConfigurationService');
      const { redis } = await import('@config/runtime/redis');
      const configService = new ConfigurationService(redis.getClient(), logger);
      const enabled = await configService.getConfig('keeper_qa_enabled');
      return !!enabled;
    } catch (error: unknown) {
      logger.warn('[EmbeddingService] Failed to check keeper_qa_enabled, defaulting to disabled', { error });
      return false;
    }
  }

  /**
   * AI-powered Q&A answer generation ("Bibliotecario") via embeddings-worker /ask
   */
  static async askQuestion(payload: {
    question: string;
    context: QAContextChunk[];
    options?: { maxTokens?: number; locale?: string };
  }): Promise<QAResponse | null> {
    try {
      const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        logger.error(`[EmbeddingService] /ask error: ${response.status}`);
        return null;
      }

      return await response.json() as QAResponse;
    } catch (error: any) {
      logger.error(`Error in askQuestion: ${error.message}`);
      return null;
    }
  }

  /**
   * Suggests follow-up search keywords from a question/answer pair, via embeddings-worker /extract-keywords
   */
  static async extractKeywords(payload: { question: string; answer: string }): Promise<QAExtractKeywordsResponse | null> {
    try {
      const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/extract-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        logger.error(`[EmbeddingService] /extract-keywords error: ${response.status}`);
        return null;
      }

      return await response.json() as QAExtractKeywordsResponse;
    } catch (error: any) {
      logger.error(`Error in extractKeywords: ${error.message}`);
      return null;
    }
  }

  /**
   * Extracts a new insight from a candidate document, if any, via embeddings-worker /extract-insight
   */
  static async extractInsight(payload: {
    question: string;
    existingAnswer: string;
    documentContent: string;
    documentTitle: string;
  }): Promise<QAExtractInsightResponse | null> {
    try {
      const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/extract-insight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        logger.error(`[EmbeddingService] /extract-insight error: ${response.status}`);
        return null;
      }

      return await response.json() as QAExtractInsightResponse;
    } catch (error: any) {
      logger.error(`Error in extractInsight: ${error.message}`);
      return null;
    }
  }
}
