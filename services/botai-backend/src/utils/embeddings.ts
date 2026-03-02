/**
 * Embeddings Utility
 *
 * Directly calls the embeddings service to generate embeddings
 * for bot memories without requiring Redis pub/sub infrastructure
 */

import { logger } from './logger';

const EMBEDDINGS_SERVICE_URL = process.env.EMBEDDINGS_SERVICE_URL || 'http://127.0.0.1:5002';
const EMBEDDING_MODEL = 'paraphrase-multilingual-MiniLM-L12-v2';

export interface EmbeddingResult {
  success: boolean;
  embedding?: number[];
  model?: string;
  error?: string;
}

/**
 * Generate embedding for text via embeddings service
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  try {
    // Truncate text to 2000 characters (model limit)
    const truncatedText = text.length > 2000 ? text.substring(0, 2000) : text;

    const response = await fetch(`${EMBEDDINGS_SERVICE_URL}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: truncatedText }),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      logger.error(`Embeddings service error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const result = await response.json();

    if (result.success && result.embedding) {
      return {
        success: true,
        embedding: result.embedding,
        model: EMBEDDING_MODEL
      };
    }

    return {
      success: false,
      error: 'Invalid response from embeddings service'
    };

  } catch (error: any) {
    logger.error('Error calling embeddings service:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Generate embedding for bot memory content
 * Formats as: "Memory at LocationName: content"
 */
export async function generateMemoryEmbedding(
  content: string,
  locationId: string
): Promise<EmbeddingResult> {
  // For now, just embed the content directly
  // In future, could fetch location name and format with context
  return generateEmbedding(content);
}

/**
 * Compute cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}
