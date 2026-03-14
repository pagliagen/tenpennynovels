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

export class EmbeddingsHttpServer {
  private app: express.Application;
  private server: any;
  private qdrant: QdrantClient;
  private elasticsearch: ElasticsearchClient;

  constructor(
    private pythonService: PythonEmbeddingService,
    private worker: any = null, // EmbeddingWorker for health stats
    private port: number = config.http.port,
    private host: string = config.http.host // SECURITY: 127.0.0.1 in prod
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
    this.app.get('/health', (_req: Request, res: Response) => {
      if (this.pythonService.ready) {
        res.json({
          status: 'healthy',
          service: 'embeddings-worker',
          model: 'paraphrase-multilingual-MiniLM-L12-v2',
          loaded: true
        });
      } else {
        res.status(503).json({
          status: 'unhealthy',
          service: 'embeddings-worker',
          loaded: false,
          reason: 'Python subprocess not ready'
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
        const { query, type, source, limit, minScore } = req.body;

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
        if (source && !['forum', 'documents'].includes(source)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid source: must be "forum" or "documents"'
          });
        }

        // Generate embedding
        const embedding = await this.pythonService.generateEmbedding(query);

        // Execute search
        if (source === 'forum') {
          const keywordResults = await this.forumKeywordSearch(query, validatedParams.limit * 2);
          const semanticResults = await this.forumVectorSearch(embedding, validatedParams.limit * 2, validatedParams.minScore);
          const merged = this.mergeForumWithRRF(keywordResults, semanticResults, validatedParams.limit);

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

  private async forumKeywordSearch(query: string, limit: number = 20) {
    try {
      const response = await this.elasticsearch.search({
        index: `${config.services.elasticsearch.indexPrefix}_forum_posts`,
        body: {
          query: {
            bool: {
              should: [
                { match: { content: query } },
                { match: { authorCharacterName: { query, boost: 1.5 } } }
              ]
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

  private async forumVectorSearch(embedding: number[], limit: number = 20, minScore: number = 0.4) {
    try {
      if (!embedding) return [];

      const results = await this.qdrant.search('forum_posts', {
        vector: embedding,
        limit,
        score_threshold: minScore
      });

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
