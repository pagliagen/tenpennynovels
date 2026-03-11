import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as socialClassAPI from '@/lib/api/socialClasses';
import type {
  SocialClassListParams,
  CreateSocialClassData,
  UpdateSocialClassData
} from '@/types/api/SocialClass';

export const socialClassKeys = {
  all: ['admin', 'social-classes'] as const,
  lists: () => [...socialClassKeys.all, 'list'] as const,
  list: (params: Partial<SocialClassListParams>) => [...socialClassKeys.lists(), params] as const,
  stats: () => [...socialClassKeys.all, 'stats'] as const,
  details: () => [...socialClassKeys.all, 'detail'] as const,
  detail: (id: string) => [...socialClassKeys.details(), id] as const,
};

export function useSocialClasses(params: Partial<SocialClassListParams> = {}) {
  return useQuery({
    queryKey: socialClassKeys.list(params),
    queryFn: () => socialClassAPI.getSocialClasses(params),
    staleTime: 5 * 60 * 1000,
    retry: 3
  });
}

export function useSocialClass(id: string) {
  return useQuery({
    queryKey: socialClassKeys.detail(id),
    queryFn: () => socialClassAPI.getSocialClassById(id),
    staleTime: 5 * 60 * 1000,
    retry: 3,
    enabled: !!id
  });
}

export function useSocialClassStats() {
  return useQuery({
    queryKey: socialClassKeys.stats(),
    queryFn: () => socialClassAPI.getSocialClassStats(),
    staleTime: 5 * 60 * 1000,
    retry: 3
  });
}

export function useCreateSocialClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSocialClassData) => socialClassAPI.createSocialClass(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialClassKeys.all });
    }
  });
}

export function useUpdateSocialClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSocialClassData }) =>
      socialClassAPI.updateSocialClass(id, data),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: socialClassKeys.all });
      queryClient.invalidateQueries({ queryKey: socialClassKeys.detail(variables.id) });
    }
  });
}

export function useDeleteSocialClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason, forceDelete }: { id: string; reason: string; forceDelete?: boolean }) =>
      socialClassAPI.deleteSocialClass(id, reason, forceDelete),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialClassKeys.all });
    }
  });
}
