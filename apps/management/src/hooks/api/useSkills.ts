import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as skillAPI from '@/lib/api/skills';
import type {
  SkillListParams,
  CreateSkillData,
  UpdateSkillData
} from '@/types/api/Skill';

export const skillKeys = {
  all: ['admin', 'skills'] as const,
  lists: () => [...skillKeys.all, 'list'] as const,
  list: (params: SkillListParams) => [...skillKeys.lists(), params] as const,
  details: () => [...skillKeys.all, 'detail'] as const,
  detail: (id: string) => [...skillKeys.details(), id] as const
};

export function useSkills(params: SkillListParams) {
  return useQuery({
    queryKey: skillKeys.list(params),
    queryFn: () => skillAPI.getSkills(params),
    staleTime: 5 * 60 * 1000,
    retry: 3
  });
}

export function useSkill(id: string) {
  return useQuery({
    queryKey: skillKeys.detail(id),
    queryFn: () => skillAPI.getSkillById(id),
    staleTime: 5 * 60 * 1000,
    retry: 3,
    enabled: !!id
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSkillData) => skillAPI.createSkill(data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: skillKeys.lists() });
    }
  });
}

export function useUpdateSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSkillData }) =>
      skillAPI.updateSkill(id, data),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: skillKeys.lists() });
      queryClient.invalidateQueries({ queryKey: skillKeys.detail(variables.id) });
    }
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      skillAPI.deleteSkill(id, reason),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: skillKeys.lists() });
    }
  });
}
