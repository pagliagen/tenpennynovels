/**
 * useMarketCatalog Hooks
 *
 * TanStack Query hooks for the Mercato general-store catalog:
 * - useGeneralStore() - Catalog + character finances (cash/bankDeposit/creditLine)
 * - usePurchaseItem() - Buy an item with cash or credit
 *
 * @module hooks/useMarketCatalog
 */

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';

import { economyApi } from '@/lib/api/economy';
import { queryKeys } from '@/lib/api/queryClient';
import type { GeneralStoreResponse, PaymentMethod, PurchaseResponse } from '@/types/economy';

/**
 * useGeneralStore Hook
 *
 * Fetches the full general-store catalog (no server pagination — the whole
 * public item list comes back in one response) along with the character's
 * current wallet (cash, bankDeposit, socialClass, weekly credit line).
 */
export function useGeneralStore(): UseQueryResult<GeneralStoreResponse, Error> {
  return useQuery({
    queryKey: queryKeys.market.all,
    queryFn: () => economyApi.getGeneralStore(),
    staleTime: 60 * 1000,
  });
}

/**
 * usePurchaseItem Hook
 *
 * Buys an item. Purchase math (cash-then-bankDeposit split, credit-line
 * deduction) is computed server-side, so on success we write the returned
 * authoritative `finances` straight into the cache rather than guessing it
 * optimistically — no invalidate involved, so there's no refetch race.
 */
export function usePurchaseItem(): UseMutationResult<
  PurchaseResponse,
  Error,
  { itemId: string; paymentMethod: PaymentMethod }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, paymentMethod }) => economyApi.purchaseItem(itemId, paymentMethod),

    onSuccess: (result) => {
      queryClient.setQueryData<GeneralStoreResponse>(queryKeys.market.all, (old) => {
        if (!old?.character) return old;
        return {
          ...old,
          character: {
            finances: {
              ...old.character.finances,
              cash: result.finances.cash,
              bankDeposit: result.finances.bankDeposit,
              totalWealth: result.finances.totalWealth,
              creditLine: {
                ...old.character.finances.creditLine,
                maxWeekly: result.finances.creditLine.maxWeekly,
                currentAvailable: result.finances.creditLine.currentAvailable,
              },
            },
          },
        };
      });
    },
  });
}
