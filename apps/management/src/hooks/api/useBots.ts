import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { botsApi, BotUpdateParams } from '@/lib/api/bots';
import { useNotificationStore } from '@/store/notificationStore';

export const botKeys = {
  all: ['admin', 'bots'] as const,
  lists: () => [...botKeys.all, 'list'] as const,
  details: () => [...botKeys.all, 'detail'] as const,
  detail: (id: string) => [...botKeys.details(), id] as const,
  characterMemories: (botId: string, charId: string) => [...botKeys.all, 'memories', botId, charId] as const,
};

export function useBotList() {
  return useQuery({
    queryKey: botKeys.lists(),
    queryFn: () => botsApi.list(),
    staleTime: 60 * 1000,
    retry: 2,
  });
}

export function useBotDetail(localAiBotId: string) {
  return useQuery({
    queryKey: botKeys.detail(localAiBotId),
    queryFn: () => botsApi.getDetail(localAiBotId),
    staleTime: 30 * 1000,
    retry: 2,
    enabled: !!localAiBotId,
  });
}

export function useBotCharacterMemories(localAiBotId: string, characterId: string) {
  return useQuery({
    queryKey: botKeys.characterMemories(localAiBotId, characterId),
    queryFn: () => botsApi.getCharacterMemories(localAiBotId, characterId),
    staleTime: 30 * 1000,
    enabled: !!localAiBotId && !!characterId,
  });
}

export function useUpdateBot() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BotUpdateParams }) =>
      botsApi.update(id, data),
    onSuccess: (_data, { id }) => {
      addNotification({ type: 'success', message: 'Bot aggiornato' });
      queryClient.invalidateQueries({ queryKey: botKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: botKeys.lists() });
    },
    onError: (error: any) => {
      addNotification({ type: 'error', message: error?.response?.data?.error || 'Errore aggiornamento bot' });
    },
  });
}

export function useDeleteBot() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: (id: string) => botsApi.cancel(id),
    onSuccess: () => {
      addNotification({ type: 'success', message: 'Bot eliminato' });
      queryClient.invalidateQueries({ queryKey: botKeys.lists() });
    },
    onError: (error: any) => {
      addNotification({ type: 'error', message: error?.response?.data?.error || 'Errore eliminazione bot' });
    },
  });
}

export function useChangeBotLocation() {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  return useMutation({
    mutationFn: ({ id, locationId }: { id: string; locationId: string }) =>
      botsApi.changeLocation(id, locationId),
    onSuccess: (_data, { id }) => {
      addNotification({ type: 'success', message: 'Location del bot aggiornata' });
      queryClient.invalidateQueries({ queryKey: botKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: botKeys.lists() });
    },
    onError: (error: any) => {
      addNotification({ type: 'error', message: error?.response?.data?.error || 'Errore cambio location' });
    },
  });
}
