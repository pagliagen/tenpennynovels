import { apiClient, withRetry } from './client';
import type {
  ForumCategory,
  ForumCategoryListParams,
  ForumCategoryListResponse,
  CreateForumCategoryData,
  UpdateForumCategoryData
} from '@/types/api/ForumCategory';
import type { ApiResponse } from '@/types/api/common';

export async function getForumCategories(params: ForumCategoryListParams): Promise<ForumCategoryListResponse> {
  const { pageSize, ...rest } = params;
  const requestParams = { ...rest, limit: pageSize };

  const response = await withRetry(() =>
    apiClient.get<ForumCategoryListResponse>('/admin/forum-categories', { params: requestParams })
  );
  return response.data;
}

export async function getForumCategory(categoryId: string): Promise<ForumCategory> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<ForumCategory>>(`/admin/forum-categories/${categoryId}`)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel recupero categoria');
  }

  return response.data.data;
}

export async function createForumCategory(data: CreateForumCategoryData): Promise<ForumCategory> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<ForumCategory>>('/admin/forum-categories', data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nella creazione categoria');
  }

  return response.data.data;
}

export async function updateForumCategory(categoryId: string, data: UpdateForumCategoryData): Promise<ForumCategory> {
  const response = await withRetry(() =>
    apiClient.put<ApiResponse<ForumCategory>>(`/admin/forum-categories/${categoryId}`, data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'aggiornamento categoria');
  }

  return response.data.data;
}

export async function deleteForumCategory(categoryId: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<void>>(`/admin/forum-categories/${categoryId}`)
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nell\'eliminazione categoria');
  }
}
