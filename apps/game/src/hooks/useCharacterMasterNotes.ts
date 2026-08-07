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

/**
 * `api.get/post` spogliano solo l'involucro axios: il body resta quello del
 * backend, `successResponse(payload)` → `{ success, data: payload, timestamp }`.
 * Va quindi letto `.data`, non il payload direttamente.
 */
async function unwrap<T>(promise: Promise<{ data: T }>): Promise<T> {
  const result = await promise;
  return result.data;
}

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
    queryFn: () => {
      const qs = category ? `?category=${category}` : '';
      return unwrap(api.get<{ data: { notes: MasterNote[] } }>(`/game/characters/${characterId}/master-notes${qs}`));
    },
    enabled: !!characterId
  });
}

export function useCreateMasterNote(characterId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { content: string; category: 'general' | 'damage' }) =>
      unwrap(api.post<{ data: { note: MasterNote } }>(`/game/characters/${characterId}/master-notes`, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', characterId, 'master-notes'] });
    }
  });
}
