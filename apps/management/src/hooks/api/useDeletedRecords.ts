/**
 * TanStack Query hooks for Deleted Records
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as deletedRecordsAPI from '@/lib/api/deletedRecords';
import type {
  DeletedRecordsParams,
  DeletedRecord,
  RecordType,
  RestoreRecordData,
  BulkPermanentDeleteData
} from '@/types/api/DeletedRecord';

/**
 * Query keys factory
 */
export const deletedRecordKeys = {
  all: ['admin', 'deleted-records'] as const,
  lists: () => [...deletedRecordKeys.all, 'list'] as const,
  list: (params: DeletedRecordsParams) => [...deletedRecordKeys.lists(), params] as const
};

/**
 * Query hook: Get deleted records
 */
export function useDeletedRecords(params: DeletedRecordsParams = {}) {
  return useQuery({
    queryKey: deletedRecordKeys.list(params),
    queryFn: () => deletedRecordsAPI.getDeletedRecords(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3
  });
}

/**
 * Mutation hook: Restore deleted record
 */
export function useRestoreRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RestoreRecordData }) =>
      deletedRecordsAPI.restoreRecord(id, data),

    onMutate: async ({ id }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: deletedRecordKeys.lists() });

      // Snapshot previous state
      const previousLists = queryClient.getQueriesData({
        queryKey: deletedRecordKeys.lists()
      });

      // Optimistic update: remove from deleted list
      queryClient.setQueriesData(
        { queryKey: deletedRecordKeys.lists(), exact: false },
        (old: any) => {
          if (!old?.items) return old;
          return {
            ...old,
            items: old.items.filter((record: DeletedRecord) => record._id !== id),
            pagination: {
              ...old.pagination,
              totalItems: old.pagination.totalItems - 1
            }
          };
        }
      );

      return { previousLists };
    },

    onError: (error: any, variables, context) => {
      // If KEY_CONFLICT, don't rollback (will open modal for user to resolve)
      if (error.code === 'KEY_CONFLICT') {
        return;
      }

      // Other errors: rollback optimistic update
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    onSuccess: (data) => {
      // Invalidate target list (users, characters, etc.) to show restored record
      const targetType = data.type;
      queryClient.invalidateQueries({
        queryKey: [targetType, 'list']
      });
    },

    onSettled: () => {
      // Refetch deleted records list
      queryClient.invalidateQueries({ queryKey: deletedRecordKeys.lists() });
    }
  });
}

/**
 * Mutation hook: Permanently delete record
 */
export function usePermanentlyDeleteRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, type }: { id: string; type: RecordType }) =>
      deletedRecordsAPI.permanentlyDelete(id, { type }),

    onMutate: async ({ id }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: deletedRecordKeys.lists() });

      // Snapshot previous state
      const previousLists = queryClient.getQueriesData({
        queryKey: deletedRecordKeys.lists()
      });

      // Optimistic update: remove from list
      queryClient.setQueriesData(
        { queryKey: deletedRecordKeys.lists(), exact: false },
        (old: any) => {
          if (!old?.items) return old;
          return {
            ...old,
            items: old.items.filter((record: DeletedRecord) => record._id !== id),
            pagination: {
              ...old.pagination,
              totalItems: old.pagination.totalItems - 1
            }
          };
        }
      );

      return { previousLists };
    },

    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    onSettled: () => {
      // Refetch deleted records list
      queryClient.invalidateQueries({ queryKey: deletedRecordKeys.lists() });
    }
  });
}

/**
 * Mutation hook: Bulk permanent delete
 */
export function useBulkPermanentlyDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BulkPermanentDeleteData) =>
      deletedRecordsAPI.bulkPermanentlyDelete(data),

    onMutate: async ({ ids }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: deletedRecordKeys.lists() });

      // Snapshot previous state
      const previousLists = queryClient.getQueriesData({
        queryKey: deletedRecordKeys.lists()
      });

      // Optimistic update: remove all ids from list
      queryClient.setQueriesData(
        { queryKey: deletedRecordKeys.lists(), exact: false },
        (old: any) => {
          if (!old?.items) return old;
          return {
            ...old,
            items: old.items.filter((record: DeletedRecord) => !ids.includes(record._id)),
            pagination: {
              ...old.pagination,
              totalItems: old.pagination.totalItems - ids.length
            }
          };
        }
      );

      return { previousLists };
    },

    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    onSettled: () => {
      // Refetch deleted records list
      queryClient.invalidateQueries({ queryKey: deletedRecordKeys.lists() });
    }
  });
}
