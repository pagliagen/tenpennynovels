/**
 * Character Inventory Actions Hooks
 *
 * Inventario "grezzo" della scheda (equip/disequip/butta/cedi) — distinto dal
 * merge legacy esposto da useCharacterSheetData (character.equipment), che non
 * porta l'id della singola riga di inventario necessario per queste azioni.
 *
 * @module hooks/useCharacterInventoryActions
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

export interface InventoryItemView {
  inventoryItemId: string;
  itemId: string;
  name: string;
  description: string;
  category?: string;
  imageUrl?: string;
  quantity: number;
  isEquipped: boolean;
  isVisible: boolean;
}

export function useCharacterInventory(characterId: string | undefined) {
  return useQuery({
    queryKey: ['character', characterId, 'inventory'],
    queryFn: () => unwrap(api.get<{ data: { equipped: InventoryItemView[]; unequipped: InventoryItemView[] } }>(
      `/game/characters/${characterId}/inventory`
    )),
    enabled: !!characterId
  });
}

function useInvalidateInventory(characterId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['character', characterId, 'inventory'] });
    queryClient.invalidateQueries({ queryKey: ['character-sheet', characterId] });
  };
}

export function useSetEquipped(characterId: string | undefined) {
  const invalidate = useInvalidateInventory(characterId);
  return useMutation({
    mutationFn: async ({ inventoryItemId, equip }: { inventoryItemId: string; equip: boolean }) =>
      api.patch(`/game/characters/${characterId}/inventory/${inventoryItemId}/equip`, { equip }),
    onSuccess: invalidate
  });
}

export function useDiscardItem(characterId: string | undefined) {
  const invalidate = useInvalidateInventory(characterId);
  return useMutation({
    mutationFn: async ({ inventoryItemId, quantity }: { inventoryItemId: string; quantity?: number }) =>
      api.delete(`/game/characters/${characterId}/inventory/${inventoryItemId}`, { data: { quantity } }),
    onSuccess: invalidate
  });
}

export function useTransferItem(characterId: string | undefined) {
  const invalidate = useInvalidateInventory(characterId);
  return useMutation({
    mutationFn: async ({ inventoryItemId, toCharacterId, quantity }: { inventoryItemId: string; toCharacterId: string; quantity: number }) =>
      api.post<{ transferred: boolean; itemName: string; toCharacterName: string }>(
        `/game/characters/${characterId}/inventory/${inventoryItemId}/transfer`,
        { toCharacterId, quantity }
      ),
    onSuccess: invalidate
  });
}

export interface PublicCharacterOption {
  id: string;
  name: string;
  surname?: string;
  status?: string;
  isOwnCharacter: boolean;
}

export function usePublicCharacterList() {
  return useQuery({
    queryKey: ['characters', 'public-list'],
    queryFn: () => unwrap(api.get<{ data: { characters: PublicCharacterOption[] } }>('/game/characters/public-list')),
    staleTime: 60000
  });
}
