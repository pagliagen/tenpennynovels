import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { onGameMailApi, offGameMailApi } from '@/lib/api/mail';

// OnGame Mail Hooks
export function useOnGameMail(filters: {
  page: number;
  limit: number;
  search?: string;
  messageType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: ['admin', 'mail', 'ongame', filters],
    queryFn: () => onGameMailApi.getMessages(filters),
    placeholderData: keepPreviousData
  });
}

export function useOnGameMailStats() {
  return useQuery({
    queryKey: ['admin', 'mail', 'ongame', 'stats'],
    queryFn: () => onGameMailApi.getStats(),
    staleTime: 60 * 1000 // 1 minute
  });
}

export function useHardDeleteOnGameMail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      onGameMailApi.hardDelete(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'mail', 'ongame'] });
    }
  });
}

export function useSoftDeleteOnGameMail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => onGameMailApi.softDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'mail', 'ongame'] });
    }
  });
}

export function useBulkDeleteOnGameMail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageIds, deleteType, reason }: {
      messageIds: string[];
      deleteType: 'hard' | 'soft';
      reason?: string;
    }) => onGameMailApi.bulkDelete(messageIds, deleteType, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'mail', 'ongame'] });
    }
  });
}

// OffGame Mail Hooks
export function useOffGameMail(filters: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  return useQuery({
    queryKey: ['admin', 'mail', 'offgame', filters],
    queryFn: () => offGameMailApi.getMessages(filters),
    placeholderData: keepPreviousData
  });
}

export function useOffGameMailStats() {
  return useQuery({
    queryKey: ['admin', 'mail', 'offgame', 'stats'],
    queryFn: () => offGameMailApi.getStats(),
    staleTime: 60 * 1000 // 1 minute
  });
}

export function useHardDeleteOffGameMail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      offGameMailApi.hardDelete(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'mail', 'offgame'] });
    }
  });
}

export function useSoftDeleteOffGameMail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => offGameMailApi.softDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'mail', 'offgame'] });
    }
  });
}

export function useBulkDeleteOffGameMail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageIds, deleteType, reason }: {
      messageIds: string[];
      deleteType: 'hard' | 'soft';
      reason?: string;
    }) => offGameMailApi.bulkDelete(messageIds, deleteType, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'mail', 'offgame'] });
    }
  });
}
