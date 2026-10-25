/**
 * Editorial AI API
 *
 * Endpoint /admin/editorial del backend. La revisione di canone è deterministica ed è sempre attiva;
 * le funzioni con il modello (quando ci saranno) dipendono da featureFlagsStore.editorialAiEnabled.
 */

import { apiClient, withRetry } from './client';
import type { CanonReport, DescriptionSuggestion, TagsSuggestion } from '@/types/api/Editorial';
import type { ApiResponse } from '@/types/api/common';

export async function getCanonCheck(): Promise<CanonReport> {
  const response = await withRetry(() => apiClient.get<ApiResponse<CanonReport>>('/admin/editorial/canon-check'));
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nella revisione di canone');
  }
  return response.data.data;
}

/** Una generazione dura da pochi secondi a un minuto: timeout lungo e MAI retry (raddoppierebbe il lavoro del modello). */
const AI_TIMEOUT_MS = 130_000;

async function postSuggestion<T>(locationId: string, action: 'suggest-description' | 'suggest-tags'): Promise<T> {
  const response = await apiClient.post<ApiResponse<T>>(`/admin/editorial/ai/locations/${locationId}/${action}`, undefined, { timeout: AI_TIMEOUT_MS });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Il servizio AI non ha risposto');
  }
  return response.data.data;
}

export const suggestLocationDescription = (locationId: string): Promise<DescriptionSuggestion> => postSuggestion(locationId, 'suggest-description');
export const suggestLocationTags = (locationId: string): Promise<TagsSuggestion> => postSuggestion(locationId, 'suggest-tags');
