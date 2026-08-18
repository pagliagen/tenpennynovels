/**
 * Character TanStack Query Hooks
 *
 * Hooks per gestire state management dei characters con:
 * - Cache automatica (5 minuti staleTime)
 * - Retry automatico (3x exponential backoff)
 * - Optimistic updates con rollback
 * - Invalidation automatica post-mutation
 */

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as characterAPI from '@/lib/api/characters';
import type {
  Character,
  CharacterListParams,
  UpdateCharacterData,
  ApproveCharacterData,
  RejectCharacterData
} from '@/types/api/Character';

/**
 * Query key factory per consistenza
 */
export const characterKeys = {
  all: ['admin', 'characters'] as const,
  lists: () => [...characterKeys.all, 'list'] as const,
  list: (params: CharacterListParams) => [...characterKeys.lists(), params] as const,
  details: () => [...characterKeys.all, 'detail'] as const,
  detail: (id: string) => [...characterKeys.details(), id] as const
};

/**
 * Hook per recuperare lista characters paginata
 */
export function useCharacters(params: CharacterListParams) {
  return useQuery({
    queryKey: characterKeys.list(params),
    queryFn: () => characterAPI.getCharacters(params),
    staleTime: 5 * 60 * 1000, // 5 minuti
    retry: 3
  });
}

/**
 * Hook per recuperare singolo character
 */
export function useCharacter(id: string) {
  return useQuery({
    queryKey: characterKeys.detail(id),
    queryFn: () => characterAPI.getCharacterById(id),
    staleTime: 5 * 60 * 1000,
    retry: 3,
    enabled: !!id
  });
}

/**
 * Helper per optimistic update lista characters
 */
function updateCharacterInCache(
  queryClient: QueryClient,
  characterId: string,
  updater: (character: Character) => Character
): void {
  // Aggiorna tutte le liste in cache
  queryClient.setQueriesData<{ list: Character[] }>(
    { queryKey: characterKeys.lists(), exact: false },
    (old) => {
      if (!old?.list) return old;
      return {
        ...old,
        list: old.list.map(char => char._id === characterId ? updater(char) : char)
      };
    }
  );

  // Aggiorna detail in cache
  queryClient.setQueryData<Character>(
    characterKeys.detail(characterId),
    (old) => old ? updater(old) : old
  );
}

/**
 * Hook per aggiornare character con optimistic updates
 */
export function useUpdateCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCharacterData }) =>
      characterAPI.updateCharacter(id, data),

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: characterKeys.lists() });
      await queryClient.cancelQueries({ queryKey: characterKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: characterKeys.lists() });
      const previousDetail = queryClient.getQueryData(characterKeys.detail(id));

      // Optimistic update (exclude fields that cause type conflicts)
      const { occupation, location, socialClass, ...safeData } = data;
      updateCharacterInCache(queryClient, id, (char) => ({
        ...char,
        ...safeData,
        biography: data.biography ? { ...char.biography, ...data.biography } : char.biography,
        // Keep original complex objects, will be updated on invalidation
        occupation: char.occupation,
        location: char.location,
        socialClass: char.socialClass
      }));

      return { previousLists, previousDetail };
    },

    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(characterKeys.detail(variables.id), context.previousDetail);
      }
    },

    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
      queryClient.invalidateQueries({ queryKey: characterKeys.detail(variables.id) });
    }
  });
}

/**
 * Hook per eliminare character con optimistic updates
 */
export function useDeleteCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => characterAPI.deleteCharacter(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: characterKeys.lists() });

      const previousLists = queryClient.getQueriesData({ queryKey: characterKeys.lists() });

      // Optimistic removal
      queryClient.setQueriesData<{ list: Character[] }>(
        { queryKey: characterKeys.lists(), exact: false },
        (old) => {
          if (!old?.list) return old;
          return {
            ...old,
            list: old.list.filter(char => char._id !== id)
          };
        }
      );

      return { previousLists };
    },

    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
    }
  });
}

/**
 * Hook per cambiare referente PNG con optimistic updates
 */
export function useChangeReferent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, newReferentId }: { characterId: string; newReferentId: string }) =>
      characterAPI.changeReferent(characterId, newReferentId),

    onMutate: async ({ characterId, newReferentId }) => {
      await queryClient.cancelQueries({ queryKey: characterKeys.lists() });
      await queryClient.cancelQueries({ queryKey: characterKeys.detail(characterId) });

      const previousLists = queryClient.getQueriesData({ queryKey: characterKeys.lists() });
      const previousDetail = queryClient.getQueryData(characterKeys.detail(characterId));

      // Optimistic update - referentCharacterId only (userId will be refetched)
      updateCharacterInCache(queryClient, characterId, (char) => ({
        ...char,
        referentCharacterId: newReferentId
      }));

      return { previousLists, previousDetail };
    },

    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(characterKeys.detail(variables.characterId), context.previousDetail);
      }
    },

    onSettled: (data, error, variables) => {
      // MUST refetch because userId changes too
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
      queryClient.invalidateQueries({ queryKey: characterKeys.detail(variables.characterId) });
    }
  });
}

/**
 * Hook per approvare character con optimistic updates
 */
export function useApproveCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: ApproveCharacterData }) =>
      characterAPI.approveCharacter(id, data),

    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: characterKeys.lists() });
      await queryClient.cancelQueries({ queryKey: characterKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: characterKeys.lists() });
      const previousDetail = queryClient.getQueryData(characterKeys.detail(id));

      // Optimistic update
      updateCharacterInCache(queryClient, id, (char) => ({
        ...char,
        status: 'approved',
        approvalStatus: {
          ...char.approvalStatus,
          status: 'approved',
          reviewedAt: new Date().toISOString()
        }
      }));

      return { previousLists, previousDetail };
    },

    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(characterKeys.detail(variables.id), context.previousDetail);
      }
    },

    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
      queryClient.invalidateQueries({ queryKey: characterKeys.detail(variables.id) });
    }
  });
}

/**
 * Hook per rifiutare character con optimistic updates
 */
export function useRejectCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectCharacterData }) =>
      characterAPI.rejectCharacter(id, data),

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: characterKeys.lists() });
      await queryClient.cancelQueries({ queryKey: characterKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: characterKeys.lists() });
      const previousDetail = queryClient.getQueryData(characterKeys.detail(id));

      // Optimistic update
      updateCharacterInCache(queryClient, id, (char) => ({
        ...char,
        status: 'rejected',
        approvalStatus: {
          ...char.approvalStatus,
          status: 'rejected',
          rejectionReason: data.note,
          reviewedAt: new Date().toISOString()
        }
      }));

      return { previousLists, previousDetail };
    },

    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(characterKeys.detail(variables.id), context.previousDetail);
      }
    },

    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
      queryClient.invalidateQueries({ queryKey: characterKeys.detail(variables.id) });
    }
  });
}

/**
 * Hook per riportare in bozza un character già approvato, con optimistic update
 */
export function useRevertCharacterToDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: { note?: string } }) =>
      characterAPI.revertCharacterToDraft(id, data),

    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: characterKeys.lists() });
      await queryClient.cancelQueries({ queryKey: characterKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: characterKeys.lists() });
      const previousDetail = queryClient.getQueryData(characterKeys.detail(id));

      updateCharacterInCache(queryClient, id, (char) => ({
        ...char,
        playerStatus: 'draft'
      }));

      return { previousLists, previousDetail };
    },

    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(characterKeys.detail(variables.id), context.previousDetail);
      }
    },

    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
      queryClient.invalidateQueries({ queryKey: characterKeys.detail(variables.id) });
    }
  });
}

/**
 * Hook per bulk approve characters con optimistic updates
 */
export function useBulkApproveCharacters() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (characterIds: string[]) => characterAPI.bulkApproveCharacters(characterIds),

    onMutate: async (characterIds) => {
      await queryClient.cancelQueries({ queryKey: characterKeys.lists() });

      const previousLists = queryClient.getQueriesData({ queryKey: characterKeys.lists() });

      // Optimistic update for all characters
      queryClient.setQueriesData<{ list: Character[] }>(
        { queryKey: characterKeys.lists(), exact: false },
        (old) => {
          if (!old?.list) return old;
          return {
            ...old,
            list: old.list.map(character =>
              characterIds.includes(character._id)
                ? {
                    ...character,
                    status: 'approved' as const,
                    metadata: {
                      ...character.metadata,
                      approvalDate: new Date().toISOString()
                    }
                  }
                : character
            )
          };
        }
      );

      return { previousLists };
    },

    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
    }
  });
}

/**
 * Hook per bulk reject characters con optimistic updates
 */
export function useBulkRejectCharacters() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { characterIds: string[]; reason: string }) =>
      characterAPI.bulkRejectCharacters(params),

    onMutate: async ({ characterIds, reason }) => {
      await queryClient.cancelQueries({ queryKey: characterKeys.lists() });

      const previousLists = queryClient.getQueriesData({ queryKey: characterKeys.lists() });

      // Optimistic update for all characters
      queryClient.setQueriesData<{ list: Character[] }>(
        { queryKey: characterKeys.lists(), exact: false },
        (old) => {
          if (!old?.list) return old;
          return {
            ...old,
            list: old.list.map(character =>
              characterIds.includes(character._id)
                ? {
                    ...character,
                    status: 'rejected' as const,
                    metadata: {
                      ...character.metadata,
                      rejectionDate: new Date().toISOString(),
                      rejectionReason: reason
                    }
                  }
                : character
            )
          };
        }
      );

      return { previousLists };
    },

    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
    }
  });
}

/**
 * Hook per bulk delete characters con optimistic updates
 */
export function useBulkDeleteCharacters() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (characterIds: string[]) => characterAPI.bulkDeleteCharacters(characterIds),

    onMutate: async (characterIds) => {
      await queryClient.cancelQueries({ queryKey: characterKeys.lists() });

      const previousLists = queryClient.getQueriesData({ queryKey: characterKeys.lists() });

      // Optimistic removal
      queryClient.setQueriesData<{ list: Character[] }>(
        { queryKey: characterKeys.lists(), exact: false },
        (old) => {
          if (!old?.list) return old;
          return {
            ...old,
            list: old.list.filter(character => !characterIds.includes(character._id))
          };
        }
      );

      return { previousLists };
    },

    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
    }
  });
}
