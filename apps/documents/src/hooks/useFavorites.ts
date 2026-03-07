import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { favoritesApi, isDocumentCachedAsFavorite, type FavoriteEntry } from '@/lib/api/favorites';

export const favoritesKeys = {
  all: ['favorites'] as const,
  list: () => [...favoritesKeys.all, 'list'] as const,
  status: (documentId: string) => [...favoritesKeys.all, 'status', documentId] as const,
};

export function useFavorites(enabled = true): UseQueryResult<FavoriteEntry[]> {
  return useQuery({
    queryKey: favoritesKeys.list(),
    queryFn: () => favoritesApi.list(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: false,
    enabled,
  });
}

export function useIsFavorited(documentId: string, isAuthenticated: boolean): UseQueryResult<boolean> {
  const { data: favorites } = useFavorites(isAuthenticated);

  return useQuery({
    queryKey: favoritesKeys.status(documentId),
    queryFn: () => {
      if (favorites) {
        return favorites.some((f) => f.document._id === documentId);
      }
      return isDocumentCachedAsFavorite(documentId);
    },
    enabled: !!documentId && isAuthenticated,
    staleTime: 60_000,
    retry: false,
  });
}

interface ToggleFavoriteVars {
  type: string;
  path: string;
  documentId: string;
  isFavorited: boolean;
}

export function useToggleFavorite(): UseMutationResult<{ favorited: boolean }, Error, ToggleFavoriteVars> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ type, path }: ToggleFavoriteVars) => favoritesApi.toggle(type, path),

    onMutate: async ({ documentId, isFavorited }) => {
      await queryClient.cancelQueries({ queryKey: favoritesKeys.list() });
      await queryClient.cancelQueries({ queryKey: favoritesKeys.status(documentId) });

      queryClient.setQueryData(favoritesKeys.status(documentId), !isFavorited);

      return { documentId, previousValue: isFavorited };
    },

    onSuccess: (data, { documentId }) => {
      queryClient.setQueryData(favoritesKeys.status(documentId), data.favorited);
      queryClient.invalidateQueries({ queryKey: favoritesKeys.list() });
    },

    onError: (_error, _vars, context) => {
      if (context) {
        queryClient.setQueryData(
          favoritesKeys.status(context.documentId),
          context.previousValue
        );
      }
    },
  });
}
