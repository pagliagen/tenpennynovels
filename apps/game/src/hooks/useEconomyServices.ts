/**
 * useEconomyServices Hooks
 *
 * TanStack Query hooks for continuative services (servitù, comunicazioni,
 * trasporti, sicurezza), budgeted against the character's Valore di Credito.
 *
 * Subscribe/unsubscribe are toggles: implemented with a real optimistic
 * update (onMutate snapshot + setQueryData, rollback in onError) and
 * deliberately NO invalidate in onSuccess/onSettled — invalidating here would
 * trigger a refetch race that can flicker the just-applied optimistic state
 * back and forth (the exact bug already present in useForumSocial's
 * useToggleBookmark, not repeated here).
 *
 * @module hooks/useEconomyServices
 */

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';

import { economyApi } from '@/lib/api/economy';
import { queryKeys } from '@/lib/api/queryClient';
import type { EconomyServicesResponse } from '@/types/economy';

interface ServiceMutationVariables {
  serviceId: string;
  propertyIndex?: number;
}

export function useEconomyServices(): UseQueryResult<EconomyServicesResponse, Error> {
  return useQuery({
    queryKey: queryKeys.economy.services,
    queryFn: () => economyApi.getServices(),
    staleTime: 60 * 1000,
  });
}

/**
 * Applies a new commitment on top of the server-confirmed committedTotal
 * (rather than recomputing from activeServices from scratch — the existing
 * total already correctly accounts for cancelled-but-still-committed entries,
 * whose "still counts until pointsFreeAt" logic lives server-side only).
 */
function withAddedCommitment(data: EconomyServicesResponse, monthlyCost: number): EconomyServicesResponse {
  const committedTotal = data.committedTotal + monthlyCost;

  return {
    ...data,
    committedTotal,
    available: data.capacity - committedTotal,
    catalog: data.catalog.map((entry) => ({
      ...entry,
      canSubscribe: committedTotal + entry.monthlyCost <= data.capacity,
    })),
  };
}

export function useSubscribeService(): UseMutationResult<void, Error, ServiceMutationVariables, { previous?: EconomyServicesResponse }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ serviceId, propertyIndex }) => economyApi.subscribeService(serviceId, propertyIndex),

    onMutate: async ({ serviceId, propertyIndex }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.economy.services });
      const previous = queryClient.getQueryData<EconomyServicesResponse>(queryKeys.economy.services);

      if (previous) {
        const service = previous.catalog.find((s) => s._id === serviceId);
        if (service) {
          const withNewEntry: EconomyServicesResponse = {
            ...previous,
            activeServices: [
              ...previous.activeServices,
              {
                serviceId,
                category: service.category,
                monthlyCost: service.monthlyCost,
                activatedAt: new Date().toISOString(),
                propertyIndex,
              },
            ],
          };
          queryClient.setQueryData(queryKeys.economy.services, withAddedCommitment(withNewEntry, service.monthlyCost));
        }
      }

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.economy.services, context.previous);
      }
    },
  });
}

export function useUnsubscribeService(): UseMutationResult<void, Error, ServiceMutationVariables, { previous?: EconomyServicesResponse }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ serviceId, propertyIndex }) => economyApi.unsubscribeService(serviceId, propertyIndex),

    onMutate: async ({ serviceId, propertyIndex }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.economy.services });
      const previous = queryClient.getQueryData<EconomyServicesResponse>(queryKeys.economy.services);

      if (previous) {
        // Cancelling doesn't free the points until the already-paid monthly
        // cycle ends server-side — mark cancelledAt only, keep it committed.
        const optimistic: EconomyServicesResponse = {
          ...previous,
          activeServices: previous.activeServices.map((entry) =>
            entry.serviceId === serviceId && entry.propertyIndex === propertyIndex
              ? { ...entry, cancelledAt: new Date().toISOString() }
              : entry
          ),
        };
        queryClient.setQueryData(queryKeys.economy.services, optimistic);
      }

      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.economy.services, context.previous);
      }
    },
  });
}
