import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as occupationAPI from '@/lib/api/occupations';
import type {
  OccupationListParams,
  CreateOccupationData,
  UpdateOccupationData
} from '@/types/api/Occupation';

export const occupationKeys = {
  all: ['admin', 'occupations'] as const,
  lists: () => [...occupationKeys.all, 'list'] as const,
  list: (params: OccupationListParams) => [...occupationKeys.lists(), params] as const,
  details: () => [...occupationKeys.all, 'detail'] as const,
  detail: (id: string) => [...occupationKeys.details(), id] as const
};

export function useOccupations(params: OccupationListParams) {
  return useQuery({
    queryKey: occupationKeys.list(params),
    queryFn: () => occupationAPI.getOccupations(params),
    staleTime: 5 * 60 * 1000,
    retry: 3
  });
}

export function useOccupation(id: string) {
  return useQuery({
    queryKey: occupationKeys.detail(id),
    queryFn: () => occupationAPI.getOccupationById(id),
    staleTime: 5 * 60 * 1000,
    retry: 3,
    enabled: !!id
  });
}

export function useCreateOccupation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOccupationData) => occupationAPI.createOccupation(data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: occupationKeys.lists() });
    }
  });
}

export function useUpdateOccupation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOccupationData }) =>
      occupationAPI.updateOccupation(id, data),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: occupationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: occupationKeys.detail(variables.id) });
    }
  });
}

export function useDeleteOccupation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      occupationAPI.deleteOccupation(id, reason),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: occupationKeys.lists() });
    }
  });
}
