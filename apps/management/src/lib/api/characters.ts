/**
 * Character API
 *
 * Funzioni per interagire con gli endpoint /admin/characters del backend.
 * Tutte le chiamate usano il client axios con retry automatico.
 */

import { apiClient, withRetry } from './client';
import type {
  Character,
  CharacterListParams,
  CharacterListResponse,
  UpdateCharacterData,
  ApproveCharacterData,
  RejectCharacterData
} from '@/types/api/Character';
import type { ApiResponse } from '@/types/api/common';

/**
 * Recupera lista characters paginata
 */
export async function getCharacters(params: CharacterListParams): Promise<CharacterListResponse> {
  const response = await withRetry(() =>
    apiClient.get<CharacterListResponse>('/admin/characters', { params })
  );
  return response.data;
}

/**
 * Recupera singolo character per ID
 */
export async function getCharacterById(id: string): Promise<Character> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<Character>>(`/admin/characters/${id}`)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel recupero character');
  }

  return response.data.data;
}

/**
 * Aggiorna character
 */
export async function updateCharacter(id: string, data: UpdateCharacterData): Promise<Character> {
  const response = await withRetry(() =>
    apiClient.patch<ApiResponse<Character>>(`/admin/characters/${id}`, data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'aggiornamento character');
  }

  return response.data.data;
}

/**
 * Elimina character (soft delete)
 */
export async function deleteCharacter(id: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<void>>(`/admin/characters/${id}`)
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nell\'eliminazione character');
  }
}

/**
 * Change PNG referent character
 */
export async function changeReferent(characterId: string, newReferentId: string): Promise<Character> {
  const response = await withRetry(() =>
    apiClient.patch<ApiResponse<Character>>(`/admin/characters/${characterId}/change-referent`, {
      newReferentId
    })
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel cambio referente');
  }

  return response.data.data;
}

/**
 * Approva character
 */
export async function approveCharacter(id: string, data?: ApproveCharacterData): Promise<Character> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<Character>>(`/admin/characters/${id}/approve`, data || {})
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'approvazione character');
  }

  return response.data.data;
}

/**
 * Rifiuta character
 */
export async function rejectCharacter(id: string, data: RejectCharacterData): Promise<Character> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<Character>>(`/admin/characters/${id}/reject`, data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel rifiuto character');
  }

  return response.data.data;
}

/**
 * Riporta in bozza un character già approvato
 */
export async function revertCharacterToDraft(
  id: string,
  data?: { note?: string }
): Promise<{ characterId: string; action: 'draft'; note?: string }> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<{ characterId: string; action: 'draft'; note?: string }>>(
      `/admin/characters/${id}/draft`,
      data || {}
    )
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel riportare il personaggio in bozza');
  }

  return response.data.data;
}

/**
 * Attiva/disattiva character
 */
export async function toggleCharacterStatus(id: string, isActive: boolean): Promise<Character> {
  return updateCharacter(id, {
    status: isActive ? 'active' : 'inactive'
  });
}

/**
 * Bulk approve characters
 */
export async function bulkApproveCharacters(
  characterIds: string[]
): Promise<{ success: number; failed: number; results: Array<{ characterId: string; success: boolean; error?: string }> }> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<{ success: number; failed: number; results: Array<{ characterId: string; success: boolean; error?: string }> }>>(
      '/admin/characters/bulk-approve',
      { characterIds }
    )
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'approvazione multipla characters');
  }

  return response.data.data;
}

/**
 * Bulk reject characters
 */
export async function bulkRejectCharacters(
  params: {
    characterIds: string[];
    reason: string;
  }
): Promise<{ success: number; failed: number; results: Array<{ characterId: string; success: boolean; error?: string }> }> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<{ success: number; failed: number; results: Array<{ characterId: string; success: boolean; error?: string }> }>>(
      '/admin/characters/bulk-reject',
      params
    )
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel rifiuto multiplo characters');
  }

  return response.data.data;
}

/**
 * Bulk delete characters
 */
export async function bulkDeleteCharacters(
  characterIds: string[]
): Promise<{ success: number; failed: number; results: Array<{ characterId: string; success: boolean; error?: string }> }> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<{ success: number; failed: number; results: Array<{ characterId: string; success: boolean; error?: string }> }>>(
      '/admin/characters/bulk-delete',
      { characterIds }
    )
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'eliminazione multipla characters');
  }

  return response.data.data;
}
