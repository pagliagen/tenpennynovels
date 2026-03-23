/**
 * useCharacterDirectory Hook
 *
 * TanStack Query hook for fetching character directory data.
 * Implements auto-refresh every 30s for online status updates.
 *
 * @module hooks/useCharacterDirectory
 * @since 2.0.0
 */

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api/client';

/**
 * Character Directory Entry
 */
export interface CharacterDirectoryEntry {
  _id: string;
  name: string;
  surname: string;
  avatar?: string;
  prestavolto?: string;
  currentOccupation?: string;
  lastActive?: string; // ISO date string
  currentLocation?: {
    _id: string;
    name: string;
  };
  isOnline: boolean; // Computed: lastActive within 5 minutes
}

/**
 * Character Directory Response
 */
interface CharacterDirectoryResponse {
  characters: CharacterDirectoryEntry[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Character Directory Filters
 */
export interface CharacterDirectoryFilters {
  search?: string; // Search by name
  onlineOnly?: boolean; // Show only online characters
  occupation?: string; // Filter by occupation
  page?: number;
  limit?: number;
}

/**
 * useCharacterDirectory Hook
 *
 * Fetches character directory with filters and auto-refresh.
 *
 * @param {CharacterDirectoryFilters} filters - Query filters
 * @returns {UseQueryResult<CharacterDirectoryResponse>} Query result
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useCharacterDirectory({
 *   search: 'Arthur',
 *   onlineOnly: true,
 *   page: 1,
 *   limit: 25
 * });
 * ```
 */
export function useCharacterDirectory(filters: CharacterDirectoryFilters = {}) {
  return useQuery<CharacterDirectoryResponse>({
    queryKey: ['character-directory', filters],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.search) params.append('search', filters.search);
      if (filters.onlineOnly) params.append('onlineOnly', 'true');
      if (filters.occupation) params.append('occupation', filters.occupation);
      if (filters.page) params.append('page', filters.page.toString());
      if (filters.limit) params.append('limit', filters.limit.toString());

      const response = await api.get<{ data: CharacterDirectoryResponse }>(
        `/game/characters/directory?${params.toString()}`
      );

      return response.data;
    },
    refetchInterval: 30000, // Auto-refresh every 30s for online status
    staleTime: 10000, // Consider data stale after 10s
  });
}
