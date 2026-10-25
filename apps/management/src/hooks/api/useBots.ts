/**
 * Hook React Query per il tab «Bot» (strumento da sviluppo). La generazione non è un hook: ha uno stato a più passi
 * (annullabile, con battiti di avanzamento) e lo gestisce `GenerateBotModal`.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as botsAPI from '@/lib/api/bots';
import type { BotDraft, BotRow, BotsOverview } from '@/types/api/Bot';

export const botKeys = {
  all: ['admin', 'bots'] as const,
};

export function useBots(enabled = true) {
  return useQuery({
    queryKey: botKeys.all,
    queryFn: botsAPI.getBots,
    enabled,
    staleTime: 30 * 1000,
    retry: false,
  });
}

/** Crea il bot e aggiunge la riga alla cache dall'esito, senza rileggere l'elenco. */
export function useCreateBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ locationId, draft }: { locationId: string; draft: BotDraft; locationName: string }) => botsAPI.createBot({ locationId, draft }),
    onSuccess: (created, variables) => {
      const row: BotRow = {
        name: variables.draft.character.name,
        characterId: created.characterId,
        environment: created.environment,
        locationId: variables.locationId,
        locationName: variables.locationName,
        file: created.file,
        active: created.reloaded,
        playerStatus: 'approved',
      };
      queryClient.setQueryData<BotsOverview>(botKeys.all, (old) => ({ hiddenOtherEnvironments: old?.hiddenOtherEnvironments ?? 0, bots: [...(old?.bots ?? []), row] }));
    },
  });
}
