/**
 * Embeddings utility for semantic search
 * Interfaces with Python sentence-transformers service
 */

import { spawn } from 'child_process';
import { logger } from './logger';
import path from 'path';

export interface EmbeddingResult {
  success: boolean;
  embedding?: number[];
  embeddings?: number[][];
  similarity?: number;
  dimensions?: number;
  count?: number;
  error?: string;
}

export class EmbeddingsService {
  private pythonPath: string;
  private scriptPath: string;

  constructor() {
    this.pythonPath = 'python3';

    // Path to Python embeddings generator script
    this.scriptPath = path.join(
      process.cwd(),
      'services',
      'embeddings-service',
      'embeddings_generator.py'
    );
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const input = {
      action: 'generate',
      text: text
    };

    const result = await this.callPythonScript(input);

    if (!result.success || !result.embedding) {
      throw new Error(result.error || 'Failed to generate embedding');
    }

    return result.embedding;
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    const input = {
      action: 'batch',
      texts: texts
    };

    const result = await this.callPythonScript(input);

    if (!result.success || !result.embeddings) {
      throw new Error(result.error || 'Failed to generate batch embeddings');
    }

    return result.embeddings;
  }

  /**
   * Compute cosine similarity between two embeddings
   */
  async computeSimilarity(embedding1: number[], embedding2: number[]): Promise<number> {
    const input = {
      action: 'similarity',
      embedding1: embedding1,
      embedding2: embedding2
    };

    const result = await this.callPythonScript(input);

    if (!result.success || result.similarity === undefined) {
      throw new Error(result.error || 'Failed to compute similarity');
    }

    return result.similarity;
  }

  /**
   * Call Python script and return result
   */
  private callPythonScript(input: any): Promise<EmbeddingResult> {
    return new Promise((resolve, reject) => {
      const python = spawn(this.pythonPath, [this.scriptPath]);

      let stdout = '';
      let stderr = '';

      // Send input to Python script
      python.stdin.write(JSON.stringify(input));
      python.stdin.end();

      // Collect stdout
      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      python.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${error}`));
        }
      });

      // Handle process errors
      python.on('error', (error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });
    });
  }

  /**
   * Check if embeddings service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.generateEmbedding('test');
      return true;
    } catch (error) {
      logger.error('Embeddings service not available:', error);
      return false;
    }
  }
}

// Singleton instance
let embeddingsService: EmbeddingsService | null = null;

/**
 * Get or create embeddings service instance
 */
export function getEmbeddingsService(): EmbeddingsService {
  if (!embeddingsService) {
    embeddingsService = new EmbeddingsService();
  }
  return embeddingsService;
}

/**
 * Generate embedding for document content
 * Combines title and content for better semantic representation
 */
export async function generateDocumentEmbedding(
  title: string,
  content: string
): Promise<number[]> {
  const service = getEmbeddingsService();

  // Combine title and content (title is more important, so we prefix it)
  const text = `${title}\n\n${content}`;

  // Truncate if too long (max 512 tokens ~ 2000 chars for safety)
  const truncatedText = text.length > 2000 ? text.substring(0, 2000) : text;

  return service.generateEmbedding(truncatedText);
}

/**
 * Search documents by semantic similarity
 * Returns documents sorted by similarity score
 */
export interface DocumentSearchResult {
  documentId: string;
  title: string;
  similarity: number;
  content?: string;
}

/**
 * Compute cosine similarity between query and document embeddings
 * Returns similarity score between 0 and 1
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}
