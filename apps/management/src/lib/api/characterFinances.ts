/**
 * Character Finances API
 *
 * Funzioni per interagire con /admin/characters/:characterId/finances.
 */

import { apiClient, withRetry } from './client';
import type { CharacterFinances, UpdateCharacterFinancesData } from '@/types/api/CharacterFinances';
import type { ApiResponse } from '@/types/api/common';

/**
 * Recupera le finanze di un personaggio
 */
export async function getCharacterFinances(characterId: string): Promise<CharacterFinances> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<CharacterFinances>>(`/admin/characters/${characterId}/finances`)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel recupero delle finanze del personaggio');
  }

  return response.data.data;
}

/**
 * Aggiorna le finanze di un personaggio (patrimonio, Valore di Credito, rendita settimanale)
 */
export async function updateCharacterFinances(
  characterId: string,
  data: UpdateCharacterFinancesData
): Promise<CharacterFinances> {
  const response = await withRetry(() =>
    apiClient.patch<ApiResponse<CharacterFinances>>(`/admin/characters/${characterId}/finances`, data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'aggiornamento delle finanze del personaggio');
  }

  return response.data.data;
}
