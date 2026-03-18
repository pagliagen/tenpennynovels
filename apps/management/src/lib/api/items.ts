import { apiClient, withRetry } from './client';
import type {
  Item,
  ItemListParams,
  ItemListResponse,
  CreateItemData,
  UpdateItemData
} from '@/types/api/Item';
import type { ApiResponse } from '@/types/api/common';

export async function getItems(params: ItemListParams): Promise<ItemListResponse> {
  const { pageSize, ...rest } = params;
  const requestParams = { ...rest, limit: pageSize };

  const response = await withRetry(() =>
    apiClient.get<ItemListResponse>('/admin/items', { params: requestParams })
  );
  return response.data;
}

export async function getItemById(id: string): Promise<Item> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<Item>>(`/admin/items/${id}`)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel recupero item');
  }

  return response.data.data;
}

export async function createItem(data: CreateItemData): Promise<Item> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<Item>>('/admin/items', data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nella creazione item');
  }

  return response.data.data;
}

export async function updateItem(id: string, data: UpdateItemData): Promise<Item> {
  const response = await withRetry(() =>
    apiClient.put<ApiResponse<Item>>(`/admin/items/${id}`, data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'aggiornamento item');
  }

  return response.data.data;
}

export async function deleteItem(id: string, reason?: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<void>>(`/admin/items/${id}`, {
      data: reason ? { reason } : undefined
    })
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nell\'eliminazione item');
  }
}
