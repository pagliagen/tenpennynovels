/**
 * Editorial AI API
 *
 * Endpoint /admin/editorial del backend. La revisione di canone è deterministica ed è sempre attiva;
 * le funzioni con il modello (quando ci saranno) dipendono da featureFlagsStore.editorialAiEnabled.
 */

import { apiClient, withRetry } from './client';
import type { CanonReport, DescriptionSuggestion, PositionsSuggestion, TagsSuggestion } from '@/types/api/Editorial';
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

async function postSuggestion<T>(locationId: string, action: 'suggest-description' | 'suggest-tags', description: string): Promise<T> {
  // Il testo è quello nel form (anche non salvato): è la base che l'AI espande, non quella su DB.
  const response = await apiClient.post<ApiResponse<T>>(`/admin/editorial/ai/locations/${locationId}/${action}`, { description }, { timeout: AI_TIMEOUT_MS });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Il servizio AI non ha risposto');
  }
  return response.data.data;
}

export const suggestLocationDescription = (locationId: string, description: string): Promise<DescriptionSuggestion> => postSuggestion(locationId, 'suggest-description', description);
export const suggestLocationTags = (locationId: string, description: string): Promise<TagsSuggestion> => postSuggestion(locationId, 'suggest-tags', description);

export interface PositionsRequest {
  name: string;
  description: string;
  tags: string[];
  /** Nomi delle posizioni già nel form: l'AI non li ripete. */
  existing: string[];
}

/** Senza id: serve anche mentre si crea la location. Il testo viene dal form. */
export async function suggestLocationPositions(request: PositionsRequest): Promise<PositionsSuggestion> {
  const response = await apiClient.post<ApiResponse<PositionsSuggestion>>('/admin/editorial/ai/suggest-positions', request, { timeout: AI_TIMEOUT_MS });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Il servizio AI non ha risposto');
  }
  return response.data.data;
}
