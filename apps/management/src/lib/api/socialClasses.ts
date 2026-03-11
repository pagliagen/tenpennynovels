import { apiClient, withRetry } from './client';
import type {
  SocialClass,
  SocialClassListParams,
  SocialClassListResponse,
  CreateSocialClassData,
  UpdateSocialClassData
} from '@/types/api/SocialClass';
import type { ApiResponse } from '@/types/api/common';

export async function getSocialClasses(params: SocialClassListParams = {}): Promise<SocialClassListResponse> {
  const response = await withRetry(() =>
    apiClient.get<SocialClassListResponse>('/admin/social-classes', { params })
  );
  return response.data;
}

export async function getSocialClassStats(): Promise<any> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<any>>('/admin/social-classes/stats')
  );
  if (!response.data.result || !response.data.data) {
    throw new Error('Errore nel recupero statistiche classi sociali');
  }
  return response.data.data;
}

export async function getSocialClassById(id: string): Promise<SocialClass> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<SocialClass>>(`/admin/social-classes/${id}`)
  );
  if (!response.data.result || !response.data.data) {
    throw new Error('Errore nel recupero classe sociale');
  }
  return response.data.data;
}

export async function createSocialClass(data: CreateSocialClassData): Promise<SocialClass> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<SocialClass>>('/admin/social-classes', data)
  );
  if (!response.data.result || !response.data.data) {
    throw new Error((response.data as any).error || 'Errore nella creazione classe sociale');
  }
  return response.data.data;
}

export async function updateSocialClass(id: string, data: UpdateSocialClassData): Promise<SocialClass> {
  const response = await withRetry(() =>
    apiClient.put<ApiResponse<SocialClass>>(`/admin/social-classes/${id}`, data)
  );
  if (!response.data.result || !response.data.data) {
    throw new Error((response.data as any).error || 'Errore nell\'aggiornamento classe sociale');
  }
  return response.data.data;
}

export async function deleteSocialClass(
  id: string,
  reason: string,
  forceDelete = false
): Promise<void> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<void>>(`/admin/social-classes/${id}`, {
      data: { reason, forceDelete }
    })
  );
  if (!response.data.result) {
    throw new Error((response.data as any).error || 'Errore nell\'eliminazione classe sociale');
  }
}

export async function reorderSocialClasses(
  classOrders: Array<{ socialClassId: string; displayOrder: number }>
): Promise<void> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<void>>('/admin/social-classes/reorder', { classOrders })
  );
  if (!response.data.result) {
    throw new Error((response.data as any).error || 'Errore nel riordinamento classi sociali');
  }
}
