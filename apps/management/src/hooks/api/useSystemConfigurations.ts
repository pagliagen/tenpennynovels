import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { systemAPI, SystemConfigRecord } from '@/lib/api/system';

export const configKeys = {
  all: ['systemConfigurations'] as const,
  bySection: (section: string) => ['systemConfigurations', section] as const,
  byKey: (key: string) => ['systemConfiguration', key] as const,
};

export function useSystemConfigurations(section?: string) {
  return useQuery({
    queryKey: section ? configKeys.bySection(section) : configKeys.all,
    queryFn: () => systemAPI.getConfigurations(section),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateConfiguration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ configKey, value, updateReason }: { configKey: string; value: any; updateReason?: string }) =>
      systemAPI.updateConfiguration(configKey, value, updateReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: configKeys.all });
    },
  });
}

export function useInvalidateConfigCache() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => systemAPI.invalidateConfigCache(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: configKeys.all });
    },
  });
}
