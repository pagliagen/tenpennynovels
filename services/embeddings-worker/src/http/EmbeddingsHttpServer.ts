/**
 * HTTP Server for unified-backend sync calls
 * Exposes endpoints compatible with embeddings-service Flask API
 */

import express, { Request, Response, NextFunction } from 'express';
import { PythonEmbeddingService } from '../services/PythonEmbeddingService';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Client as ElasticsearchClient } from '@elastic/elasticsearch';
import { config, DocumentType } from '../config';
import { logger } from '../utils/logger';
import { validateTextLength, validateSearchParams } from '../utils/validation';
import { checkOllamaHealth } from '../services/qa/OllamaChat';
import { askWithContext } from '../services/qa/RAGPipeline';
import { extractKeywords } from '../services/qa/AnswerEvaluator';
import { extractInsight } from '../services/qa/DocumentInsightExtractor';

export class EmbeddingsHttpServer {
  private app: express.Application;
  private server: any;
  private qdrant: QdrantClient;
  private elasticsearch: ElasticsearchClient;

  constructor(
    private pythonService: PythonEmbeddingService,
    private worker: any = null, // EmbeddingWorker for health stats
    private port: number = config.http.port,
    private host: string = config.http.host // see config/index.ts for the bind-host rationale
  ) {
    this.app = express();
    this.qdrant = new QdrantClient({ url: config.services.qdrant.url });
    this.elasticsearch = new ElasticsearchClient({ node: config.services.elasticsearch.url });
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // JSON body parser with size limit
    this.app.use(express.json({ limit: '1mb' }));

    // Request logging
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      const start = Date.now();
      _res.on('finish', () => {
        const duration = Date.now() - start;
        logger.debug(`${req.method} ${req.path} ${_res.statusCode} ${duration}ms`);
      });
      next();
    });

    // Error handling middleware
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error(`Unhandled error: ${err.message}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    });
  }

  private setupRoutes(): void {
    /**
     * Health check endpoint
     * Returns 503 if Python subprocess not ready
     */
    this.app.get('/health', async (_req: Request, res: Response) => {
      // Ollama is reported alongside but does NOT gate the overall status/code:
      // search/embeddings must stay reported healthy even if the RAG (/ask) path is down.
      const ollama = await checkOllamaHealth();

      if (this.pythonService.ready) {
        res.json({
          status: 'healthy',
          service: 'embeddings-worker',
          model: 'paraphrase-multilingual-MiniLM-L12-v2',
          loaded: true,
          ollama
        });
      } else {
        res.status(503).json({
          status: 'unhealthy',
          service: 'embeddings-worker',
          loaded: false,
          reason: 'Python subprocess not ready',
          ollama
        });
      }
    });

    /**
     * Hybrid search endpoint (keyword + semantic)
     * POST /search
     * Body: { query: string, type?: string, source?: string, limit?: number, minScore?: number }
     * Response: { success: boolean, results: Array<...>, error?: string }
     */
    this.app.post('/search', async (req: Request, res: Response) => {
      try {
        const { query, type, source, limit, minScore, filters } = req.body;

        // SECURITY: Validate query parameter
        if (!query || typeof query !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Missing or invalid query parameter'
          });
        }

        // SECURITY: Validate text length (DoS prevention)
        try {
          validateTextLength(query, 'query');
        } catch (err: any) {
          return res.status(400).json({
            success: false,
            error: err.message
          });
        }

        // SECURITY: Validate search params (limit, minScore, type)
        let validatedParams: { limit: number; minScore: number; type?: DocumentType };
        try {
          validatedParams = validateSearchParams({ limit, minScore, type });
        } catch (err: any) {
          return res.status(400).json({
            success: false,
            error: err.message
          });
        }

        // SECURITY: Validate source
        if (source && !['forum', 'documents', 'chat'].includes(source)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid source: must be "forum", "documents", or "chat"'
          });
        }

        // Generate embedding
        const embedding = await this.pythonService.generateEmbedding(query);

        // Execute search
        if (source === 'forum') {
          const keywordResults = await this.forumKeywordSearch(query, filters, validatedParams.limit * 2);
          const semanticResults = await this.forumVectorSearch(embedding, filters, validatedParams.limit * 2, validatedParams.minScore);
          const merged = this.mergeForumWithRRF(keywordResults, semanticResults, validatedParams.limit);

          return res.json({
            success: true,
            results: merged,
            totalResults: merged.length
          });
        }

        if (source === 'chat') {
          const keywordResults = await this.chatKeywordSearch(query, filters, validatedParams.limit * 2);
          const semanticResults = await this.chatVectorSearch(embedding, filters, validatedParams.limit * 2, validatedParams.minScore);
          const merged = this.mergeChatWithRRF(keywordResults, semanticResults, validatedParams.limit);

          return res.json({
            success: true,
            results: merged,
            totalResults: merged.length
          });
        }

        const keywordResults = await this.keywordSearch(query, validatedParams.type, validatedParams.limit * 2);
        const semanticResults = await this.vectorSearch(embedding, validatedParams.type, validatedParams.limit * 2, validatedParams.minScore);
        const merged = this.mergeWithRRF(keywordResults, semanticResults, validatedParams.limit);

        res.json({
          success: true,
          results: merged,
          totalResults: merged.length
        });

      } catch (error: any) {
        logger.error('Error in /search endpoint', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    /**
     * RAG answer generation (Bibliotecario)
     * POST /ask
     * Body: { question: string, context: Array<{heading, content, source?}>, options?: {maxTokens?, locale?} }
     */
    this.app.post('/ask', async (req: Request, res: Response) => {
      try {
        const { question, context, options } = req.body;

        if (!question || typeof question !== 'string') {
          return res.status(400).json({ success: false, error: 'Missing or invalid question parameter' });
        }
        if (!Array.isArray(context)) {
          return res.status(400).json({ success: false, error: 'Missing or invalid context parameter' });
        }

        const result = await askWithContext(
          question,
          context,
          options?.locale || 'it',
          options?.maxTokens || config.qa.maxAnswerTokens
        );

        res.json({ success: true, ...result });
      } catch (error: any) {
        logger.error('Error in /ask endpoint', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    });

    /**
     * Suggest follow-up search keywords from a question/answer pair
     * POST /extract-keywords
     * Body: { question: string, answer: string }
     */
    this.app.post('/extract-keywords', async (req: Request, res: Response) => {
      try {
        const { question, answer } = req.body;

        if (!question || typeof question !== 'string' || !answer || typeof answer !== 'string') {
          return res.status(400).json({ success: false, error: 'Missing or invalid question/answer parameter' });
        }

        const result = await extractKeywords({ question, answer });
        res.json({ success: true, ...result });
      } catch (error: any) {
        logger.error('Error in /extract-keywords endpoint', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    });

    /**
     * Extract a new insight from a candidate document, if any
     * POST /extract-insight
     * Body: { question: string, existingAnswer: string, documentContent: string, documentTitle: string }
     */
    this.app.post('/extract-insight', async (req: Request, res: Response) => {
      try {
        const { question, existingAnswer, documentContent, documentTitle } = req.body;

        if (!question || !existingAnswer || !documentContent || !documentTitle) {
          return res.status(400).json({ success: false, error: 'Missing required parameters' });
        }

        const result = await extractInsight({ question, existingAnswer, documentContent, documentTitle });
        res.json({ success: true, ...result });
      } catch (error: any) {
        logger.error('Error in /extract-insight endpoint', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    });
  }

  private async keywordSearch(query: string, type?: string, limit: number = 20) {
    try {
      const mustClauses: any[] = [{
        bool: {
          should: [
            { match: { heading: { query, boost: 2 } } },
            { match: { content: query } }
          ]
        }
      }];

      if (type) mustClauses.push({ term: { documentType: type } });

      const response = await this.elasticsearch.search({
        index: `${config.services.elasticsearch.indexPrefix}_document_chunks`,
        body: {
          query: { bool: { must: mustClauses, filter: [{ term: { isActive: true } }] } },
          size: limit
        }
      });

      return response.hits.hits.map((hit: any, i: number) => {
        // Runtime validation for Elasticsearch payload
        if (!hit._source || typeof hit._source.chunkId !== 'string') {
          logger.warn('Invalid Elasticsearch result: missing chunkId', { hitId: hit._id });
          return null;
        }

        return {
          chunkId: hit._source.chunkId,
          documentId: hit._source.documentId ?? '',
          slug: hit._source.slug ?? '',
          heading: hit._source.heading ?? '',
          type: hit._source.documentType ?? '',
          parentSlug: hit._source.parentSlug,
          rank: i + 1
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null);
    } catch (error: any) {
      logger.error(`Keyword search error: ${error.message}`);
      return [];
    }
  }

  private async vectorSearch(embedding: number[], type?: string, limit: number = 20, minScore: number = 0.4) {
    try {
      if (!embedding) return [];

      const filter: any = { must: [{ key: 'isActive', match: { value: true } }] };
      if (type) filter.must.push({ key: 'documentType', match: { value: type } });

      const results = await this.qdrant.search('document_chunks', {
        vector: embedding,
        limit,
        score_threshold: minScore,
        filter
      });

      return results.map((r, i) => {
        // Runtime validation for Qdrant payload
        if (!r.payload || typeof r.payload.chunkId !== 'string') {
          logger.warn('Invalid Qdrant result: missing chunkId', { pointId: r.id });
          return null;
        }

        return {
          chunkId: r.payload.chunkId,
          documentId: r.payload.documentId ?? '',
          slug: r.payload.slug ?? '',
          heading: r.payload.heading ?? '',
          type: r.payload.documentType ?? '',
          parentSlug: r.payload.parentSlug,
          rank: i + 1
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null);
    } catch (error: any) {
      logger.error(`Vector search error: ${error.message}`);
      return [];
    }
  }

  private async forumKeywordSearch(query: string, filters: any = {}, limit: number = 20) {
    try {
      const mustClauses: any[] = [];
      const filterClauses: any[] = [];

      // Text search
      mustClauses.push({
        bool: {
          should: [
            { match: { content: query } },
            { match: { authorCharacterName: { query, boost: 1.5 } } }
          ]
        }
      });

      // Apply filters
      if (filters.topicSlug) {
        filterClauses.push({ term: { topicSlug: filters.topicSlug } });
      }
      if (filters.discussionSlug) {
        filterClauses.push({ term: { discussionSlug: filters.discussionSlug } });
      }
      if (filters.authorCharacterId) {
        filterClauses.push({ term: { authorCharacterId: filters.authorCharacterId } });
      }

      const response = await this.elasticsearch.search({
        index: `${config.services.elasticsearch.indexPrefix}_forum_posts`,
        body: {
          query: {
            bool: {
              must: mustClauses,
              filter: filterClauses
            }
          },
          size: limit
        }
      });

      return response.hits.hits.map((hit: any, i: number) => {
        // Runtime validation for forum post Elasticsearch payload
        if (!hit._source || typeof hit._source.postId !== 'string') {
          logger.warn('Invalid Elasticsearch forum post result', { hitId: hit._id });
          return null;
        }

        return {
          postId: hit._source.postId,
          topicSlug: hit._source.topicSlug ?? '',
          discussionSlug: hit._source.discussionSlug ?? '',
          authorCharacterId: hit._source.authorCharacterId ?? '',
          authorCharacterName: hit._source.authorCharacterName ?? '',
          rank: i + 1
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null);
    } catch (error: any) {
      logger.error(`Forum keyword search error: ${error.message}`);
      return [];
    }
  }

  private async forumVectorSearch(embedding: number[], filters: any = {}, limit: number = 20, minScore: number = 0.4) {
    try {
      if (!embedding) return [];

      // Build Qdrant filter
      const mustClauses: any[] = [];
      if (filters.topicSlug) {
        mustClauses.push({ key: 'topicSlug', match: { value: filters.topicSlug } });
      }
      if (filters.discussionSlug) {
        mustClauses.push({ key: 'discussionSlug', match: { value: filters.discussionSlug } });
      }
      if (filters.authorCharacterId) {
        mustClauses.push({ key: 'authorCharacterId', match: { value: filters.authorCharacterId } });
      }

      const searchParams: any = {
        vector: embedding,
        limit,
        score_threshold: minScore
      };

      if (mustClauses.length > 0) {
        searchParams.filter = { must: mustClauses };
      }

      const results = await this.qdrant.search('forum_posts', searchParams);

      return results.map((r, i) => {
        // Runtime validation for forum post Qdrant payload
        if (!r.payload || typeof r.payload.postId !== 'string') {
          logger.warn('Invalid Qdrant forum post result', { pointId: r.id });
          return null;
        }

        return {
          postId: r.payload.postId,
          topicSlug: r.payload.topicSlug ?? '',
          discussionSlug: r.payload.discussionSlug ?? '',
          authorCharacterId: r.payload.authorCharacterId ?? '',
          authorCharacterName: r.payload.authorCharacterName ?? '',
          rank: i + 1
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null);
    } catch (error: any) {
      logger.error(`Forum vector search error: ${error.message}`);
      return [];
    }
  }

  private async chatKeywordSearch(query: string, filters: any = {}, limit: number = 20) {
    try {
      const mustClauses: any[] = [];
      const filterClauses: any[] = [];

      // Text search
      mustClauses.push({
        bool: {
          should: [
            { match: { content: query } },
            { match: { characterName: { query, boost: 1.5 } } }
          ]
        }
      });

      // Apply filters
      if (filters.locationId) {
        filterClauses.push({ term: { locationId: filters.locationId } });
      }
      if (filters.characterId) {
        filterClauses.push({ term: { characterId: filters.characterId } });
      }
      if (filters.dateStart || filters.dateEnd) {
        const rangeFilter: any = {};
        if (filters.dateStart) rangeFilter.gte = filters.dateStart;
        if (filters.dateEnd) rangeFilter.lte = filters.dateEnd;
        filterClauses.push({ range: { timestamp: rangeFilter } });
      }

      const response = await this.elasticsearch.search({
        index: `${config.services.elasticsearch.indexPrefix}_chat_messages`,
        body: {
          query: {
            bool: {
              must: mustClauses,
              filter: filterClauses
            }
          },
          sort: [{ timestamp: 'desc' }],
          size: limit
        }
      });

      return response.hits.hits.map((hit: any, i: number) => {
        if (!hit._source || typeof hit._source.chatId !== 'string') {
          logger.warn('Invalid Elasticsearch chat result', { hitId: hit._id });
          return null;
        }

        return {
          chatId: hit._source.chatId,
          locationId: hit._source.locationId ?? '',
          characterId: hit._source.characterId ?? '',
          characterName: hit._source.characterName ?? '',
          content: hit._source.content ?? '',
          timestamp: hit._source.timestamp ?? new Date(),
          rank: i + 1
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null);
    } catch (error: any) {
      logger.error(`Chat keyword search error: ${error.message}`);
      return [];
    }
  }

  private async chatVectorSearch(embedding: number[], filters: any = {}, limit: number = 20, minScore: number = 0.4) {
    try {
      if (!embedding) return [];

      // Build Qdrant filter
      const mustClauses: any[] = [];
      if (filters.locationId) {
        mustClauses.push({ key: 'locationId', match: { value: filters.locationId } });
      }
      if (filters.characterId) {
        mustClauses.push({ key: 'characterId', match: { value: filters.characterId } });
      }

      const searchParams: any = {
        vector: embedding,
        limit,
        score_threshold: minScore
      };

      if (mustClauses.length > 0) {
        searchParams.filter = { must: mustClauses };
      }

      const results = await this.qdrant.search('chat_messages', searchParams);

      return results.map((r, i) => {
        if (!r.payload || typeof r.payload.chatId !== 'string') {
          logger.warn('Invalid Qdrant chat result', { pointId: r.id });
          return null;
        }

        return {
          chatId: r.payload.chatId,
          locationId: r.payload.locationId ?? '',
          characterId: r.payload.characterId ?? '',
          characterName: r.payload.characterName ?? '',
          rank: i + 1
        };
      }).filter((item): item is NonNullable<typeof item> => item !== null);
    } catch (error: any) {
      logger.error(`Chat vector search error: ${error.message}`);
      return [];
    }
  }

  private mergeChatWithRRF(keywordResults: any[], semanticResults: any[], limit: number) {
    const k = 60;
    const scoreMap = new Map<string, { data: any; score: number }>();

    for (const r of keywordResults) {
      scoreMap.set(r.chatId, { data: r, score: 1 / (k + r.rank) });
    }

    for (const r of semanticResults) {
      const rrfScore = 1 / (k + r.rank);
      const existing = scoreMap.get(r.chatId);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(r.chatId, { data: r, score: rrfScore });
      }
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        chatId: item.data.chatId,
        locationId: item.data.locationId,
        characterId: item.data.characterId,
        characterName: item.data.characterName,
        content: item.data.content,
        timestamp: item.data.timestamp,
        score: item.score
      }));
  }

  private mergeForumWithRRF(keywordResults: any[], semanticResults: any[], limit: number) {
    const k = 60;
    const scoreMap = new Map<string, { data: any; score: number }>();

    for (const r of keywordResults) {
      scoreMap.set(r.postId, { data: r, score: 1 / (k + r.rank) });
    }

    for (const r of semanticResults) {
      const rrfScore = 1 / (k + r.rank);
      const existing = scoreMap.get(r.postId);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(r.postId, { data: r, score: rrfScore });
      }
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        postId: item.data.postId,
        topicSlug: item.data.topicSlug,
        discussionSlug: item.data.discussionSlug,
        authorCharacterId: item.data.authorCharacterId,
        authorCharacterName: item.data.authorCharacterName,
        score: item.score
      }));
  }

  private mergeWithRRF(keywordResults: any[], semanticResults: any[], limit: number) {
    const k = 60;
    const scoreMap = new Map<string, { data: any; score: number }>();

    for (const r of keywordResults) {
      scoreMap.set(r.chunkId, { data: r, score: 1 / (k + r.rank) });
    }

    for (const r of semanticResults) {
      const rrfScore = 1 / (k + r.rank);
      const existing = scoreMap.get(r.chunkId);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(r.chunkId, { data: r, score: rrfScore });
      }
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        chunkId: item.data.chunkId,
        documentId: item.data.documentId,
        slug: item.data.slug,
        heading: item.data.heading,
        score: item.score,
        type: item.data.type,
        parentSlug: item.data.parentSlug
      }));
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, this.host, () => {
        logger.info(`HTTP server listening on ${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          logger.info('HTTP server stopped');
          resolve();
        });
      });
    }
  }
}
