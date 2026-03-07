/**
 * TanStack Query Client Configuration
 *
 * Configures React Query with optimal defaults for the application.
 * Handles caching, retries, refetching, and error handling.
 *
 * @module lib/api/queryClient
 * @since 2.0.0
 */

import { QueryClient, DefaultOptions, QueryCache, MutationCache } from '@tanstack/react-query';
import { QUERY_CONFIG } from '@/constants/config';
import { parseError } from './errors';

/**
 * Default Query Options
 *
 * Global defaults for all queries and mutations.
 * Individual queries can override these settings.
 *
 * @constant
 * @since 2.0.0
 */
const queryConfig: DefaultOptions = {
  queries: {
    // Time before data is considered stale (5 minutes)
    staleTime: QUERY_CONFIG.STALE_TIME,

    // Time to keep unused data in cache (10 minutes)
    gcTime: QUERY_CONFIG.CACHE_TIME,

    // Number of retry attempts for failed queries
    retry: QUERY_CONFIG.RETRY,

    // Retry delay function (exponential backoff: 1s, 2s, 4s)
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    // Refetch on window focus (good for keeping data fresh)
    refetchOnWindowFocus: QUERY_CONFIG.REFETCH_ON_WINDOW_FOCUS,

    // Refetch on network reconnect (good for mobile/flaky connections)
    refetchOnReconnect: QUERY_CONFIG.REFETCH_ON_RECONNECT,

    // Don't refetch on mount if data is fresh
    refetchOnMount: false,

    // Transform errors to ApiError
    throwOnError: false,
  },

  mutations: {
    // Don't retry mutations by default (user-initiated actions)
    retry: 0,

    // Transform errors to ApiError
    throwOnError: false,
  },
};

/**
 * Query Cache Instance
 *
 * Global query cache with error handling for all queries.
 *
 * @constant
 * @type {QueryCache}
 * @since 2.0.0
 */
const queryCache = new QueryCache({
  onError: (error: Error) => {
    const apiError = parseError(error);

    // Log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[Query Error]', {
        category: apiError.category,
        message: apiError.message,
        details: apiError.details,
      });
    }

    // Additional error handling can be added here
    // e.g., show toast notification, redirect on auth error, etc.
  },
});

/**
 * Mutation Cache Instance
 *
 * Global mutation cache with error handling for all mutations.
 *
 * @constant
 * @type {MutationCache}
 * @since 2.0.0
 */
const mutationCache = new MutationCache({
  onError: (error: Error) => {
    const apiError = parseError(error);

    // Log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[Mutation Error]', {
        category: apiError.category,
        message: apiError.message,
        details: apiError.details,
      });
    }

    // Additional error handling can be added here
  },
});

/**
 * Query Client Instance
 *
 * Singleton instance of QueryClient used throughout the application.
 * Configured with optimal defaults for caching and error handling.
 *
 * Features:
 * - Automatic background refetching
 * - Exponential backoff retry logic
 * - Global error transformation
 * - Cache persistence (future: via persistQueryClient)
 *
 * @constant
 * @type {QueryClient}
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * import { queryClient } from '@/lib/api/queryClient';
 *
 * // Invalidate cache
 * queryClient.invalidateQueries({ queryKey: ['users'] });
 *
 * // Prefetch data
 * await queryClient.prefetchQuery({
 *   queryKey: ['user', userId],
 *   queryFn: () => api.get(`/users/${userId}`)
 * });
 * ```
 */
export const queryClient = new QueryClient({
  defaultOptions: queryConfig,
  queryCache,
  mutationCache,
});

/**
 * Query Key Factory
 *
 * Type-safe query key builders for consistent cache management.
 *
 * @namespace queryKeys
 * @since 2.0.0
 */
export const queryKeys = {
  auth: {
    session: ['auth', 'session'] as const,
  },

  documents: {
    all: ['documents'] as const,
    list: (filters?: Record<string, unknown>) => ['documents', 'list', filters] as const,
    detail: (type: string, path: string) => ['documents', 'detail', type, path] as const,
    routes: (type?: string) => ['documents', 'routes', type] as const,
  },

  search: {
    all: ['search'] as const,
    results: (query: string, type?: string) => ['search', 'results', query, type] as const,
    suggestions: (query: string) => ['search', 'suggestions', query] as const,
  },

  favorites: {
    all: ['favorites'] as const,
    list: () => ['favorites', 'list'] as const,
    status: (documentId: string) => ['favorites', 'status', documentId] as const,
  },
} as const;
