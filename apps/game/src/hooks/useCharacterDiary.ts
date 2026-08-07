/**
 * Character Diary Hooks
 *
 * Diario classico, personaggi incontrati, e sessioni di gioco ("role") del personaggio.
 *
 * @module hooks/useCharacterDiary
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api/client';

export interface DiaryEntry {
  _id: string;
  characterId: string;
  title: string;
  content: string;
  entryDate: string;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EncounterNote {
  _id: string;
  ownerCharacterId: string;
  targetCharacterId?: string;
  targetName: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterGamingSession {
  _id: string;
  title: string;
  sessionType?: string;
  primaryLocation: string;
  sessionDate: string;
  startTime: string;
  endTime?: string;
  status: string;
  summary?: string;
}

// --- Diario classico ---

export function useDiaryEntries(characterId: string | undefined) {
  return useQuery({
    queryKey: ['character', characterId, 'diary-entries'],
    queryFn: async () => api.get<{ entries: DiaryEntry[] }>(`/game/characters/${characterId}/diary-entries`),
    enabled: !!characterId
  });
}

export function useCreateDiaryEntry(characterId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; content: string; entryDate?: string }) =>
      api.post<{ entry: DiaryEntry }>(`/game/characters/${characterId}/diary-entries`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['character', characterId, 'diary-entries'] })
  });
}

export function useUpdateDiaryEntry(characterId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, ...data }: { entryId: string; title?: string; content?: string; isVisible?: boolean }) =>
      api.put<{ entry: DiaryEntry }>(`/game/characters/${characterId}/diary-entries/${entryId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['character', characterId, 'diary-entries'] })
  });
}

export function useDeleteDiaryEntry(characterId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => api.delete(`/game/characters/${characterId}/diary-entries/${entryId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['character', characterId, 'diary-entries'] })
  });
}

// --- Personaggi incontrati ---

export function useEncounters(characterId: string | undefined) {
  return useQuery({
    queryKey: ['character', characterId, 'encounters'],
    queryFn: async () => api.get<{ encounters: EncounterNote[] }>(`/game/characters/${characterId}/encounters`),
    enabled: !!characterId
  });
}

export function useCreateEncounter(characterId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { targetName: string; notes: string; targetCharacterId?: string }) =>
      api.post<{ encounter: EncounterNote }>(`/game/characters/${characterId}/encounters`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['character', characterId, 'encounters'] })
  });
}

export function useDeleteEncounter(characterId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (encounterId: string) => api.delete(`/game/characters/${characterId}/encounters/${encounterId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['character', characterId, 'encounters'] })
  });
}

// --- Role (sessioni) ---

export function useCharacterSessions(characterId: string | undefined) {
  return useQuery({
    queryKey: ['character', characterId, 'sessions'],
    queryFn: async () => api.get<{ sessions: CharacterGamingSession[] }>(`/game/characters/${characterId}/sessions`),
    enabled: !!characterId
  });
}

export async function downloadSessionTranscript(characterId: string, sessionId: string) {
  const result = await api.get<{ sessionTitle: string; sessionDate: string; messageCount: number; transcript: string }>(
    `/game/characters/${characterId}/sessions/${sessionId}/transcript`
  );

  const blob = new Blob([result.transcript || '(nessun messaggio)'], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `giocata-${result.sessionTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
