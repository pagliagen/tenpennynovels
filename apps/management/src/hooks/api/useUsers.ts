/**
 * User TanStack Query Hooks
 *
 * Hooks per gestire state management degli utenti con:
 * - Cache automatica (5 minuti staleTime)
 * - Retry automatico (3x exponential backoff)
 * - Optimistic updates con rollback
 * - Invalidation automatica post-mutation
 */

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as userAPI from '@/lib/api/users';
import type {
  User,
  UserListParams,
  UpdateUserData,
  BanUserData
} from '@/types/api/User';

/**
 * Query key factory per consistenza
 */
export const userKeys = {
  all: ['admin', 'users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params: UserListParams) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const
};

/**
 * Hook per recuperare lista utenti paginata
 */
export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => userAPI.getUsers(params),
    staleTime: 5 * 60 * 1000, // 5 minuti
    retry: 3
  });
}

/**
 * Hook per recuperare singolo utente
 */
export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => userAPI.getUserById(id),
    staleTime: 5 * 60 * 1000,
    retry: 3,
    enabled: !!id // Query abilitata solo se id presente
  });
}

/**
 * Helper per optimistic update lista utenti
 */
function updateUserInCache(
  queryClient: QueryClient,
  userId: string,
  updater: (user: User) => User
): void {
  // Aggiorna tutte le liste in cache
  queryClient.setQueriesData<{ items: User[] }>(
    { queryKey: userKeys.lists(), exact: false },
    (old) => {
      if (!old?.items) return old;
      return {
        ...old,
        items: old.items.map(user => user._id === userId ? updater(user) : user)
      };
    }
  );

  // Aggiorna detail in cache
  queryClient.setQueryData<User>(
    userKeys.detail(userId),
    (old) => old ? updater(old) : old
  );
}

/**
 * Hook per aggiornare utente con optimistic updates
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserData }) =>
      userAPI.updateUser(id, data),

    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: userKeys.lists() });
      await queryClient.cancelQueries({ queryKey: userKeys.detail(id) });

      // Snapshot previous values
      const previousLists = queryClient.getQueriesData({ queryKey: userKeys.lists() });
      const previousDetail = queryClient.getQueryData(userKeys.detail(id));

      // Optimistic update
      updateUserInCache(queryClient, id, (user) => ({
        ...user,
        ...data,
        accountStatus: data.accountStatus
          ? { ...user.accountStatus, ...data.accountStatus }
          : user.accountStatus
      }));

      return { previousLists, previousDetail };
    },

    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(userKeys.detail(variables.id), context.previousDetail);
      }
    },

    onSettled: (data, error, variables) => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(variables.id) });
    }
  });
}

/**
 * Hook per eliminare utente con optimistic updates
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => userAPI.deleteUser(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: userKeys.lists() });

      const previousLists = queryClient.getQueriesData({ queryKey: userKeys.lists() });

      // Optimistic removal
      queryClient.setQueriesData<{ items: User[] }>(
        { queryKey: userKeys.lists(), exact: false },
        (old) => {
          if (!old?.items) return old;
          return {
            ...old,
            items: old.items.filter(user => user._id !== id)
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
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    }
  });
}

/**
 * Hook per ban utente con optimistic updates
 */
export function useBanUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, banData }: { id: string; banData: BanUserData }) =>
      userAPI.banUser(id, banData),

    onMutate: async ({ id, banData }) => {
      await queryClient.cancelQueries({ queryKey: userKeys.lists() });
      await queryClient.cancelQueries({ queryKey: userKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: userKeys.lists() });
      const previousDetail = queryClient.getQueryData(userKeys.detail(id));

      // Optimistic update
      updateUserInCache(queryClient, id, (user) => ({
        ...user,
        accountStatus: {
          ...user.accountStatus,
          isBanned: true,
          banReason: banData.reason,
          bannedAt: new Date().toISOString()
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
        queryClient.setQueryData(userKeys.detail(variables.id), context.previousDetail);
      }
    },

    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(variables.id) });
    }
  });
}

/**
 * Hook per unban utente con optimistic updates
 */
export function useUnbanUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => userAPI.unbanUser(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: userKeys.lists() });
      await queryClient.cancelQueries({ queryKey: userKeys.detail(id) });

      const previousLists = queryClient.getQueriesData({ queryKey: userKeys.lists() });
      const previousDetail = queryClient.getQueryData(userKeys.detail(id));

      // Optimistic update
      updateUserInCache(queryClient, id, (user) => ({
        ...user,
        accountStatus: {
          ...user.accountStatus,
          isBanned: false,
          banReason: undefined,
          bannedAt: undefined
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
        queryClient.setQueryData(userKeys.detail(variables), context.previousDetail);
      }
    },

    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(variables) });
    }
  });
}
