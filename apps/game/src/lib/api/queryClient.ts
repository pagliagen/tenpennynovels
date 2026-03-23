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
 * Use these instead of hardcoding query keys.
 *
 * @namespace queryKeys
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * import { queryKeys } from '@/lib/api/queryClient';
 *
 * // User queries
 * useQuery({
 *   queryKey: queryKeys.users.detail(userId),
 *   queryFn: () => api.get(`/users/${userId}`)
 * });
 *
 * // Character queries
 * useQuery({
 *   queryKey: queryKeys.characters.list(campaignId),
 *   queryFn: () => api.get(`/characters?campaign=${campaignId}`)
 * });
 * ```
 */
export const queryKeys = {
  /**
   * Auth-related query keys
   */
  auth: {
    /** Current user query key */
    me: ['auth', 'me'] as const,

    /** Session validation query key */
    session: ['auth', 'session'] as const,
  },

  /**
   * User-related query keys
   */
  users: {
    /** All users list query key */
    all: ['users'] as const,

    /** User list with filters query key builder */
    list: (filters?: Record<string, unknown>) => ['users', 'list', filters] as const,

    /** Single user detail query key builder */
    detail: (id: string) => ['users', 'detail', id] as const,
  },

  /**
   * Character-related query keys
   */
  characters: {
    /** All characters list query key */
    all: ['characters'] as const,

    /** Character list with filters query key builder */
    list: (filters?: Record<string, unknown>) => ['characters', 'list', filters] as const,

    /** Single character detail query key builder */
    detail: (id: string) => ['characters', 'detail', id] as const,

    /** Characters by campaign query key builder */
    byCampaign: (campaignId: string) => ['characters', 'campaign', campaignId] as const,

    /** Public characters list (for recipient selector) */
    publicList: ['characters', 'publicList'] as const,
  },

  /**
   * Location-related query keys
   */
  locations: {
    /** All locations list query key */
    all: ['locations'] as const,

    /** Location list with filters query key builder */
    list: (filters?: Record<string, unknown>) => ['locations', 'list', filters] as const,

    /** Single location detail query key builder */
    detail: (id: string) => ['locations', 'detail', id] as const,

    /** Location occupants query key builder */
    occupants: (id: string) => ['locations', id, 'occupants'] as const,
  },

  /**
   * Message-related query keys
   */
  messages: {
    /** Location messages query key builder */
    location: (locationId: string, page?: number) =>
      ['messages', 'location', locationId, page] as const,

    /** Private messages query key builder */
    private: (characterId: string, page?: number) =>
      ['messages', 'private', characterId, page] as const,

    /** Postal messages query key builder */
    postal: (characterId: string, page?: number) =>
      ['messages', 'postal', characterId, page] as const,
  },

  /**
   * Presence-related query keys
   */
  presence: {
    /** All online characters query key */
    all: ['presence'] as const,

    /** Single character presence query key builder */
    detail: (characterId: string) => ['presence', characterId] as const,
  },

  /**
   * Market-related query keys
   */
  market: {
    /** All market items query key */
    all: ['market'] as const,

    /** Market items with filters query key builder */
    list: (filters?: Record<string, unknown>) => ['market', 'list', filters] as const,

    /** Single market item detail query key builder */
    detail: (id: string) => ['market', 'detail', id] as const,
  },

  /**
   * OnGame Mail-related query keys
   */
  onGameMail: {
    /** Thread list (conversation list) query key */
    threads: ['onGameMail', 'threads'] as const,

    /** Single thread (conversation) query key builder */
    thread: (partnerId: string) => ['onGameMail', 'thread', partnerId] as const,

    /** Message types config query key */
    messageTypes: ['onGameMail', 'messageTypes'] as const,

    /** Unread count query key */
    unreadCount: ['onGameMail', 'unreadCount'] as const,
  },

  /**
   * OffGame Chat-related query keys
   */
  offGameChat: {
    /** Chat list (all chats) query key */
    chats: ['offGameChat', 'chats'] as const,

    /** Single chat with messages query key builder */
    chat: (chatId: string) => ['offGameChat', 'chat', chatId] as const,

    /** Total unread count query key */
    unreadCount: ['offGameChat', 'unreadCount'] as const,
  },

  /**
   * Economy-related query keys
   */
  economy: {
    /** Wallet balance query key */
    wallet: ['economy', 'wallet'] as const,
  },
} as const;
