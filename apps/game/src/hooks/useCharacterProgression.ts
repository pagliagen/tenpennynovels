/**
 * Character Progression Hooks
 *
 * Punti esperienza/abilità disponibili e spesa px su una skill (tab Statistiche/Abilità).
 *
 * @module hooks/useCharacterProgression
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

export interface CharacterProgressionData {
  availableExperiencePoints: number;
  availableSkillPoints: number;
  totalExperienceEarned: number;
  totalSkillPointsEarned: number;
  totalExperienceSpent: number;
  totalSkillPointsSpent: number;
  skillsImproved: Array<{
    skill: string;
    timesImproved: number;
    totalPointsSpent: number;
    currentValue: number;
    startingValue: number;
    lastImprovedAt: string;
  }>;
  recentSpending: Array<{
    spentAt: string;
    type: 'skill' | 'stat';
    target: string;
    pointsSpent: number;
    resultValue: number;
  }>;
}

export function useCharacterProgression(characterId: string | undefined) {
  return useQuery({
    queryKey: ['character', characterId, 'progression'],
    queryFn: () => unwrap(api.get<{ data: CharacterProgressionData }>(`/game/characters/${characterId}/progression`)),
    enabled: !!characterId
  });
}

export function useImproveSkill(characterId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ skillId, points }: { skillId: string; points: number }) =>
      unwrap(api.post<{ data: { skillId: string; skillName: string; breakdown: unknown; availableSkillPoints: number } }>(
        `/game/characters/${characterId}/progression/skills/${skillId}/improve`,
        { points }
      )),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', characterId, 'progression'] });
      queryClient.invalidateQueries({ queryKey: ['character-sheet', characterId] });
    }
  });
}
