import { apiClient, withRetry } from './client';
import type { ForumTopicPermissionOverride, ForumTopicPermissionOverrideValues } from '@/types/api/ForumTopicPermission';
import type { ApiResponse } from '@/types/api/common';

export async function getForumTopicPermissions(topicId: string): Promise<ForumTopicPermissionOverride[]> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<ForumTopicPermissionOverride[]>>(`/admin/forum-topics/${topicId}/permissions`)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel recupero dei permessi');
  }

  return response.data.data;
}

export async function upsertForumTopicPermission(
  topicId: string,
  characterId: string,
  data: { overrides: ForumTopicPermissionOverrideValues; reason?: string }
): Promise<ForumTopicPermissionOverride> {
  const response = await withRetry(() =>
    apiClient.put<ApiResponse<ForumTopicPermissionOverride>>(`/admin/forum-topics/${topicId}/permissions/${characterId}`, data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'aggiornamento dei permessi');
  }

  return response.data.data;
}

export async function deleteForumTopicPermission(topicId: string, characterId: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<void>>(`/admin/forum-topics/${topicId}/permissions/${characterId}`)
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nella rimozione dei permessi');
  }
}
