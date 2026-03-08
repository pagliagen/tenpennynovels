/**
 * useSearch Hook
 *
 * Semantic search powered by Qdrant vector database.
 * Searches documents using embeddings for semantic similarity.
 *
 * @module hooks/useSearch
 * @since 1.0.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { DocumentType } from '@/types/document';

const SEARCH_DEBOUNCE_MS = 400;

interface SearchResult {
  document: {
    _id: string;
    slug: string;
    title: string;
    content: string;
    description?: string;
    tags: string[];
    isDraft: boolean;
  };
  route: {
    path: string;
    type: DocumentType;
    subtypeTitle: string;
    anchor: string;
    fullPath: string;
  };
  matchLevel: number;
  matchHeading: string;
  similarity: number;
  matchScore: string;
}

interface AIAnswerSource {
  heading: string;
  slug?: string;
  fullPath?: string;
  title?: string;
  used: boolean;
}

export interface AIAnswer {
  answer: string;
  sources: AIAnswerSource[];
  model?: string;
}

interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  query: string;
  aiAnswer?: AIAnswer;
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
        `/documents/semantic-search?${params.toString()}`
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
 * Search state manager for interactive search UI.
 * Uses debounced query for API calls to avoid request spam while typing.
 */
export function useSearchState() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const search = useSearch(debouncedQuery, {
    enabled: isOpen && debouncedQuery.length >= 2,
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
    setDebouncedQuery('');
    clearTimeout(timerRef.current);
  }, []);

  return {
    query,
    setQuery: handleSearch,
    isOpen,
    setIsOpen,
    results: search.data?.results || [],
    totalResults: search.data?.totalResults || 0,
    isLoading: search.isLoading || (query !== debouncedQuery && query.trim().length >= 2),
    error: search.error,
    aiAnswer: search.data?.aiAnswer,
    handleClose,
  };
}
