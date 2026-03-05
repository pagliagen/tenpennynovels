/**
 * HTTP Server for unified-backend sync calls
 * Exposes endpoints compatible with embeddings-service Flask API
 */

import express, { Request, Response, NextFunction } from 'express';
import { PythonEmbeddingService } from '../services/PythonEmbeddingService';

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * Simple structured logger
 */
const logger = {
  debug: (message: string, ...args: any[]) => {
    if (LOG_LEVEL === 'debug') {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  }
};

export class EmbeddingsHttpServer {
  private app: express.Application;
  private server: any;

  constructor(
    private pythonService: PythonEmbeddingService,
    private port: number = 5001,
    private host: string = '127.0.0.1'
  ) {
    this.app = express();
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
     * Embed endpoint (compatible with Flask API)
     * POST /embed
     * Body: { text: string }
     * Response: { success: boolean, embedding?: number[], dimensions?: number, error?: string }
     */
    this.app.post('/embed', async (req: Request, res: Response) => {
      try {
        const { text } = req.body;

        // Validation
        if (!text || typeof text !== 'string') {
          return res.status(400).json({
            success: false,
            error: 'Missing or invalid text parameter'
          });
        }

        if (text.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Text cannot be empty'
          });
        }

        if (text.length > 10000) {
          return res.status(400).json({
            success: false,
            error: 'Text too long (max 10000 chars)'
          });
        }

        // Generate embedding via Python subprocess
        const embedding = await this.pythonService.generateEmbedding(text);

        res.json({
          success: true,
          embedding,
          dimensions: embedding.length
        });

      } catch (error: any) {
        logger.error(`Error in /embed: ${error.message}`);

        // Determine appropriate status code
        if (error.message.includes('not ready')) {
          return res.status(503).json({
            success: false,
            error: 'Service temporarily unavailable'
          });
        }

        if (error.message.includes('timeout')) {
          return res.status(504).json({
            success: false,
            error: 'Request timeout'
          });
        }

        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    });
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
