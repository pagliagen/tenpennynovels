/**
 * useAllRoutes Hook
 *
 * Fetches all routes hierarchically grouped by type.
 * Used for multi-type sidebar navigation.
 *
 * @module hooks/useAllRoutes
 * @since 1.0.0
 */

import { useQuery } from '@tanstack/react-query';
import { documentsApi } from '@/lib/api/documents';

interface RoutesByType {
  ambientazione: any[];
  approfondimenti: any[];
  regolamento: any[];
}

/**
 * Fetch all routes with hierarchical structure
 *
 * Returns routes grouped by type with parent/child relationships.
 * Cached for 5 minutes to reduce API calls.
 *
 * @returns {UseQueryResult<RoutesByType>}
 */
export function useAllRoutes() {
  return useQuery<RoutesByType>({
    queryKey: ['allRoutes'],
    queryFn: async () => {
      const routes = await documentsApi.listHierarchical();
      return routes;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false, // Don't refetch on tab switch
    refetchOnReconnect: false, // Don't refetch on reconnect
  });
}
