import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

interface AiStatusResponse {
  result: boolean;
  data: { aiAvailable: boolean };
}

export function useAiStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-status'],
    queryFn: async () => {
      const res = await api.get<AiStatusResponse>('/documents/ai-status');
      return res.data.aiAvailable;
    },
    staleTime: 60_000,
    gcTime: 120_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return { aiAvailable: data ?? false, isLoading };
}
