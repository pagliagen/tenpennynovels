/**
 * Search API Service
 *
 * API client for semantic search operations using Qdrant vector database.
 * Searches across document content with AI-powered similarity matching.
 *
 * @module lib/api/search
 * @since 1.0.0
 */

import { api } from './client';
import type { SearchResponse, DocumentType } from '@/types/document';

interface SemanticSearchBody {
  data: {
    results?: SearchResponse['results'];
    totalResults?: number;
    query?: string;
  };
}

/** Forme possibili del payload suggerimenti (gateway/backend). */
interface SuggestionsBody {
  data?: { suggestions?: string[] } | string[];
  suggestions?: string[];
}

export interface SemanticSearchParams {
  q: string; // Search query
  type?: DocumentType; // Filter by document type
  limit?: number; // Max results (default: 10)
  minSimilarity?: number; // Min similarity score 0-1 (default: 0.7)
}

export const searchApi = {
  /**
   * Semantic search across documents
   *
   * Uses Qdrant vector similarity search with embeddings.
   * Searches document content (not just titles) for contextual matches.
   *
   * Backend flow:
   * 1. Generate embedding for query (embeddings-service)
   * 2. Search Qdrant for similar vectors (ANN search)
   * 3. Return matched sections with similarity scores
   *
   * @param {SemanticSearchParams} params - Search parameters
   * @returns {Promise<SearchResponse>} Search results with relevance scores
   */
  async semantic(params: SemanticSearchParams): Promise<SearchResponse> {
    const { q, type, limit = 10, minSimilarity = 0.7 } = params;

    if (!q || q.trim().length < 2) {
      return {
        results: [],
        totalResults: 0,
        query: q,
      };
    }

    const body = await api.get<SemanticSearchBody>('/documents/semantic-search', {
      params: {
        q: q.trim(),
        ...(type && { type }),
        limit,
        minSimilarity,
      },
    });

    return {
      results: body.data.results || [],
      totalResults: body.data.totalResults || 0,
      query: body.data.query || q,
    };
  },

  /**
   * Get search suggestions
   *
   * Returns quick search suggestions based on document titles and keywords.
   * Lighter alternative to full semantic search for autocomplete.
   *
   * @param {string} query - Partial search query
   * @param {DocumentType} type - Optional type filter
   * @returns {Promise<string[]>} Suggested search terms
   */
  async suggestions(query: string, type?: DocumentType): Promise<string[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      const body = await api.get<SuggestionsBody>('/documents/search-suggestions', {
        params: {
          q: query.trim(),
          ...(type && { type }),
        },
      });

      if (Array.isArray(body.data)) {
        return body.data;
      }
      if (body.data && typeof body.data === 'object' && 'suggestions' in body.data) {
        return body.data.suggestions ?? [];
      }
      return body.suggestions ?? [];
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Ricerca] Endpoint suggerimenti non disponibile:', error);
      }
      return [];
    }
  },
};
