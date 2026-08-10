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

/**
 * `api.get/post/...` spogliano solo l'involucro di trasporto axios, restituendo
 * il body JSON del backend così com'è. I controller di questo modulo usano
 * `successResponse(payload)` → `{ success, data: payload, timestamp }`: va
 * quindi letto `.data`, non il payload direttamente (a differenza di
 * `listResponse`, che mette i campi al livello radice — vedi useTickets.ts).
 */
async function unwrap<T>(promise: Promise<{ data: T }>): Promise<T> {
  const result = await promise;
  return result.data;
}

export interface DiaryEntry {
  _id: string;
  characterId: string;
  title: string;
  content: string;
  entryDate: string;
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

export interface CharacterChatScene {
  _id: string;
  characterId: string;
  sourceSceneId: string;
  locationId: string;
  locationName?: string;
  title: string;
  summary?: string;
  startedAt: string;
  closedAt: string;
  createdAt: string;
  updatedAt: string;
}

// --- Diario classico ---

export function useDiaryEntries(characterId: string | undefined) {
  return useQuery({
    queryKey: ['character', characterId, 'diary-entries'],
    queryFn: () => unwrap(api.get<{ data: { entries: DiaryEntry[] } }>(`/game/characters/${characterId}/diary-entries`)),
    enabled: !!characterId
  });
}

export function useCreateDiaryEntry(characterId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; content: string; entryDate?: string }) =>
      unwrap(api.post<{ data: { entry: DiaryEntry } }>(`/game/characters/${characterId}/diary-entries`, data)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['character', characterId, 'diary-entries'] })
  });
}

export function useUpdateDiaryEntry(characterId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, ...data }: { entryId: string; title?: string; content?: string; entryDate?: string }) =>
      unwrap(api.put<{ data: { entry: DiaryEntry } }>(`/game/characters/${characterId}/diary-entries/${entryId}`, data)),
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
    queryFn: () => unwrap(api.get<{ data: { encounters: EncounterNote[] } }>(`/game/characters/${characterId}/encounters`)),
    enabled: !!characterId
  });
}

export function useCreateEncounter(characterId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { targetName: string; notes: string; targetCharacterId?: string }) =>
      unwrap(api.post<{ data: { encounter: EncounterNote } }>(`/game/characters/${characterId}/encounters`, data)),
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
    queryFn: () => unwrap(api.get<{ data: { sessions: CharacterGamingSession[] } }>(`/game/characters/${characterId}/sessions`)),
    enabled: !!characterId
  });
}

export async function downloadSessionTranscript(characterId: string, sessionId: string) {
  const result = await unwrap(api.get<{ data: { sessionTitle: string; sessionDate: string; messageCount: number; transcript: string } }>(
    `/game/characters/${characterId}/sessions/${sessionId}/transcript`
  ));

  downloadTranscriptFile(result.transcript, `giocata-${result.sessionTitle}`);
}

// --- Chat Scenes ("role" auto-segmentate dalla chat standard) ---

export function useCharacterChatScenes(characterId: string | undefined) {
  return useQuery({
    queryKey: ['character', characterId, 'chat-scenes'],
    queryFn: () => unwrap(api.get<{ data: { scenes: CharacterChatScene[] } }>(`/game/characters/${characterId}/chat-scenes`)),
    enabled: !!characterId
  });
}

export function useUpdateChatScene(characterId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sceneId, ...data }: { sceneId: string; title?: string; summary?: string }) =>
      unwrap(api.put<{ data: { scene: CharacterChatScene } }>(`/game/characters/${characterId}/chat-scenes/${sceneId}`, data)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['character', characterId, 'chat-scenes'] })
  });
}

export async function downloadSceneTranscript(characterId: string, sceneId: string) {
  const result = await unwrap(api.get<{ data: { locationName?: string; startedAt: string; messageCount: number; transcript: string } }>(
    `/game/characters/${characterId}/chat-scenes/${sceneId}/transcript`
  ));

  const label = result.locationName
    ? `giocata a ${result.locationName}`
    : `giocata-${sceneId}`;
  downloadTranscriptFile(result.transcript, label);
}

function downloadTranscriptFile(transcript: string, label: string) {
  const blob = new Blob([transcript || '(nessun messaggio)'], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
