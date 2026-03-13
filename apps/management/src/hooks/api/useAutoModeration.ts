import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { moderationAPI, type ModerationAlertFilters } from '@/lib/api/moderation';

export const moderationKeys = {
  all: ['moderationAlerts'] as const,
  list: (filters: ModerationAlertFilters) => ['moderationAlerts', 'list', filters] as const,
  stats: (source?: 'chat' | 'forum') => ['moderationAlerts', 'stats', source] as const,
  detail: (id: string) => ['moderationAlerts', 'detail', id] as const,
};

export function useAutoModerationAlerts(filters: ModerationAlertFilters = {}) {
  return useQuery({
    queryKey: moderationKeys.list(filters),
    queryFn: () => moderationAPI.getAlerts(filters),
    staleTime: 30 * 1000,
  });
}

export function useAutoModerationStats(source?: 'chat' | 'forum') {
  return useQuery({
    queryKey: moderationKeys.stats(source),
    queryFn: () => moderationAPI.getStats(source),
    staleTime: 60 * 1000,
  });
}

export function useReviewAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status: string; reviewNotes?: string; actionTaken?: string }) =>
      moderationAPI.reviewAlert(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.all });
    },
  });
}
