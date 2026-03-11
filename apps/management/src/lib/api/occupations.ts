import { apiClient, withRetry } from './client';
import type {
  Occupation,
  OccupationListParams,
  OccupationListResponse,
  CreateOccupationData,
  UpdateOccupationData
} from '@/types/api/Occupation';
import type { ApiResponse } from '@/types/api/common';

export async function getOccupations(params: OccupationListParams): Promise<OccupationListResponse> {
  const { pageSize, ...rest } = params;
  const requestParams = { ...rest, limit: pageSize };

  const response = await withRetry(() =>
    apiClient.get<OccupationListResponse>('/admin/occupations', { params: requestParams })
  );
  return response.data;
}

export async function getOccupationById(id: string): Promise<Occupation> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<Occupation>>(`/admin/occupations/${id}`)
  );

  if (!response.data.result || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel recupero occupazione');
  }

  return response.data.data;
}

export async function createOccupation(data: CreateOccupationData): Promise<Occupation> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<Occupation>>('/admin/occupations', data)
  );

  if (!response.data.result || !response.data.data) {
    throw new Error(response.data.error || 'Errore nella creazione occupazione');
  }

  return response.data.data;
}

export async function updateOccupation(id: string, data: UpdateOccupationData): Promise<Occupation> {
  const response = await withRetry(() =>
    apiClient.put<ApiResponse<Occupation>>(`/admin/occupations/${id}`, data)
  );

  if (!response.data.result || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'aggiornamento occupazione');
  }

  return response.data.data;
}

export async function deleteOccupation(id: string, reason?: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<void>>(`/admin/occupations/${id}`, {
      data: reason ? { reason } : undefined
    })
  );

  if (!response.data.result) {
    throw new Error(response.data.error || 'Errore nell\'eliminazione occupazione');
  }
}
