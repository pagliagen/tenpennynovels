/**
 * Character Finances TanStack Query Hooks
 *
 * Nessun optimistic update: è un form di modifica esplicita (patrimonio/VC/rendita
 * settimanale), non un toggle — onSettled invalidate è sufficiente e coerente con
 * l'eccezione già in uso per useItems/useSocialClasses.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as characterFinancesAPI from '@/lib/api/characterFinances';
import type { UpdateCharacterFinancesData } from '@/types/api/CharacterFinances';

export const characterFinancesKeys = {
  all: ['admin', 'characterFinances'] as const,
  detail: (characterId: string) => [...characterFinancesKeys.all, characterId] as const
};

/**
 * Hook per recuperare le finanze di un personaggio
 */
export function useCharacterFinances(characterId: string) {
  return useQuery({
    queryKey: characterFinancesKeys.detail(characterId),
    queryFn: () => characterFinancesAPI.getCharacterFinances(characterId),
    staleTime: 5 * 60 * 1000,
    retry: 3,
    enabled: !!characterId
  });
}

/**
 * Hook per aggiornare le finanze di un personaggio
 */
export function useUpdateCharacterFinances() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, data }: { characterId: string; data: UpdateCharacterFinancesData }) =>
      characterFinancesAPI.updateCharacterFinances(characterId, data),

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: characterFinancesKeys.detail(variables.characterId) });
    }
  });
}
