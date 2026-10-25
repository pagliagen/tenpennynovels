/**
 * Editorial AI API
 *
 * Endpoint /admin/editorial del backend. La revisione di canone è deterministica ed è sempre attiva;
 * le funzioni con il modello (quando ci saranno) dipendono da featureFlagsStore.editorialAiEnabled.
 */

import { apiClient, withRetry } from './client';
import type { CanonReport } from '@/types/api/Editorial';
import type { ApiResponse } from '@/types/api/common';

export async function getCanonCheck(): Promise<CanonReport> {
  const response = await withRetry(() => apiClient.get<ApiResponse<CanonReport>>('/admin/editorial/canon-check'));
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nella revisione di canone');
  }
  return response.data.data;
}
