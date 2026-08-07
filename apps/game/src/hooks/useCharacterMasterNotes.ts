/**
 * Character Master Notes Hooks
 *
 * Note libere scritte dal master su un personaggio, incluse le note "Danni"
 * (danni fisici e mentali) — tab Note Master della scheda.
 *
 * @module hooks/useCharacterMasterNotes
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';

export interface MasterNote {
  _id: string;
  characterId: string;
  authorId: string;
  authorName: string;
  category: 'general' | 'damage';
  content: string;
  createdAt: string;
  updatedAt: string;
}

export function useMasterNotes(characterId: string | undefined, category?: 'general' | 'damage') {
  return useQuery({
    queryKey: ['character', characterId, 'master-notes', category ?? 'all'],
    queryFn: async () => {
      const qs = category ? `?category=${category}` : '';
      return api.get<{ notes: MasterNote[] }>(`/game/characters/${characterId}/master-notes${qs}`);
    },
    enabled: !!characterId
  });
}

export function useCreateMasterNote(characterId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { content: string; category: 'general' | 'damage' }) =>
      api.post<{ note: MasterNote }>(`/game/characters/${characterId}/master-notes`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', characterId, 'master-notes'] });
    }
  });
}
