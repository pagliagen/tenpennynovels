/**
 * useSemanticSearch Hook
 *
 * Semantic search across documents using Qdrant vector similarity.
 * AI-powered contextual search (not just keyword matching).
 *
 * @module hooks/useSemanticSearch
 * @since 1.0.0
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';

import { searchApi } from '@/lib/api/search';
import type { SearchResponse, DocumentType } from '@/types/document';

/**
 * Query keys factory for search
 */
export const searchKeys = {
  all: ['search'] as const,
  semantic: (query: string, type?: DocumentType, limit?: number) =>
    [...searchKeys.all, 'semantic', query, type, limit] as const,
};

/**
 * Semantic search with debouncing
 *
 * @param {string} query - Search query
 * @param {DocumentType} type - Optional type filter
 * @param {number} limit - Max results (default: 10)
 * @param {number} minSimilarity - Min similarity score 0-1 (default: 0.7)
 * @param {boolean} enabled - Whether to fetch (default: true, but auto-disabled for short queries)
 * @returns {UseQueryResult<SearchResponse>} Query result with search results
 *
 * @example
 * const [searchQuery, setSearchQuery] = useState('');
 * const { data, isLoading } = useSemanticSearch(searchQuery, 'ambientazione');
 *
 * // Results include similarity scores and highlighted excerpts
 * data?.results.map(result => (
 *   <SearchResultCard key={result.section.id} result={result} />
 * ));
 */
export function useSemanticSearch(
  query: string,
  type?: DocumentType,
  limit: number = 10,
  minSimilarity: number = 0.7,
  enabled: boolean = true
): UseQueryResult<SearchResponse> {
  const trimmedQuery = query.trim();
  const isQueryValid = trimmedQuery.length >= 2;

  return useQuery({
    queryKey: searchKeys.semantic(trimmedQuery, type, limit),
    queryFn: () =>
      searchApi.semantic({
        q: trimmedQuery,
        type,
        limit,
        minSimilarity,
      }),
    enabled: enabled && isQueryValid,
    staleTime: 2 * 60 * 1000, // 2 minutes (search results can change)
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    retry: 1, // Retry once on failure
  });
}

/**
 * Search suggestions hook (for autocomplete)
 *
 * @param {string} query - Partial search query
 * @param {DocumentType} type - Optional type filter
 * @param {boolean} enabled - Whether to fetch
 * @returns {UseQueryResult<string[]>} Query result with suggestions
 *
 * @example
 * const { data: suggestions } = useSearchSuggestions(inputValue);
 */
export function useSearchSuggestions(
  query: string,
  type?: DocumentType,
  enabled: boolean = true
): UseQueryResult<string[]> {
  const trimmedQuery = query.trim();

  return useQuery({
    queryKey: ['search', 'suggestions', trimmedQuery, type],
    queryFn: () => searchApi.suggestions(trimmedQuery, type),
    enabled: enabled && trimmedQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry suggestions
  });
}
