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

    const response = (await api.get('/documents/semantic-search', {
      params: {
        q: q.trim(),
        ...(type && { type }),
        limit,
        minSimilarity,
      },
    })) as any;

    return {
      results: response.data.results || [],
      totalResults: response.data.totalResults || 0,
      query: response.data.query || q,
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
      const response = (await api.get('/documents/search-suggestions', {
        params: {
          q: query.trim(),
          ...(type && { type }),
        },
      })) as any;

      return response.data.suggestions || response.data || [];
    } catch (error) {
      // Suggestions are optional, don't fail if endpoint doesn't exist
      console.warn('[Search] Suggestions endpoint not available:', error);
      return [];
    }
  },
};
