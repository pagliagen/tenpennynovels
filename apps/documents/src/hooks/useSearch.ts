/**
 * useSearch Hook
 *
 * Semantic search powered by Qdrant vector database.
 * Searches documents using embeddings for semantic similarity.
 *
 * @module hooks/useSearch
 * @since 1.0.0
 */

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { DocumentType } from '@/types/document';

interface SearchResult {
  document: {
    _id: string;
    slug: string;
    title: string;
    content: string; // Preview (300 chars)
    description?: string;
    tags: string[];
    isDraft: boolean;
  };
  route: {
    path: string;
    type: DocumentType;
    title: string;
    anchor: string;  // e.g., "#regina-vittoria"
    fullPath: string;  // e.g., "/ambientazione/epoca-vittoriana#regina-vittoria"
  };
  similarity: number;
  matchScore: string; // e.g., "85.3%"
}

interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  query: string;
}

interface UseSearchOptions {
  type?: DocumentType;
  limit?: number;
  minSimilarity?: number;
  enabled?: boolean;
}

/**
 * Semantic search hook
 *
 * @param {string} query - Search query
 * @param {UseSearchOptions} options - Search options
 * @returns Query result with search results
 *
 * @example
 * const { data, isLoading, search } = useSearch('vampire folklore', {
 *   type: 'ambientazione',
 *   limit: 5,
 *   minSimilarity: 0.5
 * });
 */
export function useSearch(query: string = '', options: UseSearchOptions = {}) {
  const { type, limit = 5, minSimilarity = 0.3, enabled = true } = options;

  const queryKey = ['search', query, type, limit, minSimilarity];

  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      if (!query || query.trim().length < 2) {
        return { results: [], totalResults: 0, query: '' };
      }

      const params = new URLSearchParams({
        q: query.trim(),
        limit: limit.toString(),
        minSimilarity: minSimilarity.toString(),
      });

      if (type) {
        params.append('type', type);
      }

      const response = await api.get<{ data: SearchResponse }>(
        `/game/documents/semantic-search?${params.toString()}`
      );

      return response.data;
    },
    enabled: enabled && query.trim().length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  return queryResult;
}

/**
 * Search state manager for interactive search UI
 */
export function useSearchState() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const search = useSearch(query, {
    enabled: isOpen && query.length >= 2,
  });

  const handleSearch = useCallback((newQuery: string) => {
    setQuery(newQuery);
    if (newQuery.trim().length >= 2) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  return {
    query,
    setQuery: handleSearch,
    isOpen,
    setIsOpen,
    results: search.data?.results || [],
    totalResults: search.data?.totalResults || 0,
    isLoading: search.isLoading,
    error: search.error,
    handleClose,
  };
}
