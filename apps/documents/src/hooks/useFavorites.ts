/**
 * useFavorites Hook
 *
 * Manages user's favorite documents with optimistic updates.
 * All operations require authentication.
 *
 * @module hooks/useFavorites
 * @since 1.0.0
 */

import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { favoritesApi } from '@/lib/api/favorites';
import type { FavoriteDocument } from '@/types/document';

/**
 * Query keys factory for favorites
 */
export const favoritesKeys = {
  all: ['favorites'] as const,
  list: () => [...favoritesKeys.all, 'list'] as const,
  status: (documentId: string) => [...favoritesKeys.all, 'status', documentId] as const,
};

/**
 * Fetch user's favorite documents
 *
 * Requires authentication. Returns empty array if not authenticated.
 *
 * @returns {UseQueryResult<FavoriteDocument[]>} Query result with favorites list
 *
 * @example
 * const { data: favorites, isLoading } = useFavorites();
 */
export function useFavorites(): UseQueryResult<FavoriteDocument[]> {
  return useQuery({
    queryKey: favoritesKeys.list(),
    queryFn: () => favoritesApi.list(),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    retry: false, // Don't retry if auth fails
  });
}

/**
 * Check if document is favorited
 *
 * @param {string} documentId - Document ID to check
 * @returns {UseQueryResult<boolean>} Query result with favorited status
 */
export function useIsFavorited(documentId: string): UseQueryResult<boolean> {
  return useQuery({
    queryKey: favoritesKeys.status(documentId),
    queryFn: () => favoritesApi.isFavorited(documentId),
    enabled: !!documentId,
    staleTime: 1 * 60 * 1000,
    retry: false,
  });
}

/**
 * Add document to favorites (with optimistic update)
 *
 * @returns {UseMutationResult} Mutation for adding favorite
 *
 * @example
 * const addFavorite = useAddFavorite();
 *
 * <button onClick={() => addFavorite.mutate(documentId)}>
 *   ⭐ Add to Favorites
 * </button>
 */
export function useAddFavorite(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => favoritesApi.add(documentId),
    onMutate: async (documentId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: favoritesKeys.list() });
      await queryClient.cancelQueries({ queryKey: favoritesKeys.status(documentId) });

      // Optimistically update status
      queryClient.setQueryData(favoritesKeys.status(documentId), true);

      return { documentId };
    },
    onSuccess: () => {
      // Invalidate favorites list to refetch
      queryClient.invalidateQueries({ queryKey: favoritesKeys.list() });
    },
    onError: (error, documentId, context) => {
      // Rollback on error
      if (context) {
        queryClient.setQueryData(favoritesKeys.status(documentId), false);
      }
      console.error('[Favorites] Failed to add favorite:', error);
    },
  });
}

/**
 * Remove document from favorites (with optimistic update)
 *
 * @returns {UseMutationResult} Mutation for removing favorite
 *
 * @example
 * const removeFavorite = useRemoveFavorite();
 *
 * <button onClick={() => removeFavorite.mutate(documentId)}>
 *   Remove from Favorites
 * </button>
 */
export function useRemoveFavorite(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => favoritesApi.remove(documentId),
    onMutate: async (documentId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: favoritesKeys.list() });
      await queryClient.cancelQueries({ queryKey: favoritesKeys.status(documentId) });

      // Optimistically update status
      queryClient.setQueryData(favoritesKeys.status(documentId), false);

      // Optimistically remove from list
      const previousFavorites = queryClient.getQueryData<FavoriteDocument[]>(favoritesKeys.list());
      if (previousFavorites) {
        queryClient.setQueryData(
          favoritesKeys.list(),
          previousFavorites.filter((fav) => fav.id !== documentId)
        );
      }

      return { documentId, previousFavorites };
    },
    onSuccess: () => {
      // Invalidate favorites list to refetch
      queryClient.invalidateQueries({ queryKey: favoritesKeys.list() });
    },
    onError: (error, documentId, context) => {
      // Rollback on error
      if (context) {
        queryClient.setQueryData(favoritesKeys.status(documentId), true);
        if (context.previousFavorites) {
          queryClient.setQueryData(favoritesKeys.list(), context.previousFavorites);
        }
      }
      console.error('[Favorites] Failed to remove favorite:', error);
    },
  });
}

/**
 * Toggle favorite status (add or remove)
 *
 * @returns {UseMutationResult} Mutation for toggling favorite
 *
 * @example
 * const toggleFavorite = useToggleFavorite();
 * const { data: isFavorited } = useIsFavorited(documentId);
 *
 * <button onClick={() => toggleFavorite.mutate({ documentId, isFavorited })}>
 *   {isFavorited ? '⭐ Favorited' : '☆ Add to Favorites'}
 * </button>
 */
export function useToggleFavorite(): UseMutationResult<void, Error, { documentId: string; isFavorited: boolean }> {
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  return useMutation({
    mutationFn: async ({ documentId, isFavorited }) => {
      if (isFavorited) {
        await removeFavorite.mutateAsync(documentId);
      } else {
        await addFavorite.mutateAsync(documentId);
      }
    },
  });
}
