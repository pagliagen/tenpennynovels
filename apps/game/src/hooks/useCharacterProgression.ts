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
    queryFn: async () => api.get<CharacterProgressionData>(`/game/characters/${characterId}/progression`),
    enabled: !!characterId
  });
}

export function useImproveSkill(characterId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ skillId, points }: { skillId: string; points: number }) => {
      return await api.post<{ skillId: string; skillName: string; breakdown: unknown; availableSkillPoints: number }>(
        `/game/characters/${characterId}/progression/skills/${skillId}/improve`,
        { points }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', characterId, 'progression'] });
      queryClient.invalidateQueries({ queryKey: ['character-sheet', characterId] });
    }
  });
}
