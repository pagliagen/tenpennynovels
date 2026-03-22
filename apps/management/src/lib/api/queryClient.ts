/**
 * TanStack Query setup and configuration
 */

import { QueryClient, QueryClientConfig } from '@tanstack/react-query';
import { QUERY_CONFIG } from '@/constants/config';

/**
 * Query client configuration
 */
const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: QUERY_CONFIG.STALE_TIME,
      gcTime: QUERY_CONFIG.GC_TIME,
      retry: QUERY_CONFIG.RETRY,
      refetchOnWindowFocus: QUERY_CONFIG.REFETCH_ON_WINDOW_FOCUS,
      refetchOnReconnect: true,
      refetchOnMount: true
    },
    mutations: {
      retry: 1 // Retry mutations once
    }
  }
};

/**
 * Create Query Client instance
 */
export const queryClient = new QueryClient(queryClientConfig);

/**
 * Query key factories for consistent naming
 */
export const queryKeys = {
  // Admin queries
  admin: {
    all: ['admin'] as const,
    users: (params?: Record<string, unknown>) =>
      ['admin', 'users', params] as const,
    user: (id: string) =>
      ['admin', 'users', id] as const,
    characters: (params?: Record<string, unknown>) =>
      ['admin', 'characters', params] as const,
    character: (id: string) =>
      ['admin', 'characters', id] as const,
    documents: (params?: Record<string, unknown>) =>
      ['admin', 'documents', params] as const,
    document: (id: string) =>
      ['admin', 'documents', id] as const
  }
} as const;
