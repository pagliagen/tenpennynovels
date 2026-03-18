/**
 * Location API
 *
 * Funzioni per interagire con gli endpoint /admin/locations del backend.
 */

import { apiClient, withRetry } from './client';
import type {
  Location,
  LocationDetail,
  LocationListParams,
  LocationListResponse,
  LocationHierarchyResponse,
  LocationStatsResponse,
  CreateLocationData,
  UpdateLocationData
} from '@/types/api/Location';
import type { ApiResponse } from '@/types/api/common';

/**
 * Recupera lista location (flat, con paginazione)
 */
export async function getLocations(params: Partial<LocationListParams> = {}): Promise<LocationListResponse> {
  const response = await withRetry(() =>
    apiClient.get<LocationListResponse>('/admin/locations', { params })
  );
  return response.data;
}

/**
 * Recupera gerarchia location (albero)
 */
export async function getLocationHierarchy(): Promise<LocationHierarchyResponse> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<LocationHierarchyResponse>>('/admin/locations/hierarchy')
  );
  if (!response.data.success || !response.data.data) {
    throw new Error('Errore nel recupero gerarchia location');
  }
  return response.data.data;
}

/**
 * Recupera statistiche location
 */
export async function getLocationStats(): Promise<LocationStatsResponse> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<LocationStatsResponse>>('/admin/locations/stats')
  );
  if (!response.data.success || !response.data.data) {
    throw new Error('Errore nel recupero statistiche location');
  }
  return response.data.data;
}

/**
 * Recupera dettaglio singola location
 */
export async function getLocationById(id: string): Promise<LocationDetail> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<LocationDetail>>(`/admin/locations/${id}`)
  );
  if (!response.data.success || !response.data.data) {
    throw new Error('Errore nel recupero dettaglio location');
  }
  return response.data.data;
}

/**
 * Crea nuova location
 */
export async function createLocation(data: CreateLocationData): Promise<{ locationId: string; slug: string }> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<{ locationId: string; slug: string }>>('/admin/locations', data)
  );
  if (!response.data.success || !response.data.data) {
    throw new Error((response.data as any).error || 'Errore nella creazione location');
  }
  return response.data.data;
}

/**
 * Aggiorna location
 */
export async function updateLocation(id: string, data: UpdateLocationData): Promise<void> {
  const response = await withRetry(() =>
    apiClient.put<ApiResponse<any>>(`/admin/locations/${id}`, data)
  );
  if (!response.data.success) {
    throw new Error((response.data as any).error || 'Errore nell\'aggiornamento location');
  }
}

/**
 * Elimina location (soft delete)
 */
export async function deleteLocation(id: string, reason: string, forceDelete = false): Promise<void> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<void>>(`/admin/locations/${id}`, {
      data: { reason, forceDelete }
    })
  );
  if (!response.data.success) {
    throw new Error((response.data as any).error || 'Errore nell\'eliminazione location');
  }
}

/**
 * Riordina location siblings
 */
export async function reorderLocations(parentId: string | null, orderedIds: string[]): Promise<void> {
  const response = await withRetry(() =>
    apiClient.put<ApiResponse<void>>('/admin/locations/reorder', { parentId, orderedIds })
  );
  if (!response.data.success) {
    throw new Error((response.data as any).error || 'Errore nel riordinamento location');
  }
}
