import { apiClient, withRetry } from './client';
import type {
  ForumTopic,
  ForumTopicListParams,
  ForumTopicListResponse,
  CreateForumTopicData,
  UpdateForumTopicData
} from '@/types/api/ForumTopic';
import type { ApiResponse } from '@/types/api/common';

export async function getForumTopics(params: ForumTopicListParams): Promise<ForumTopicListResponse> {
  const { pageSize, ...rest } = params;
  const requestParams = { ...rest, limit: pageSize };

  const response = await withRetry(() =>
    apiClient.get<ForumTopicListResponse>('/admin/forum-topics', { params: requestParams })
  );
  return response.data;
}

export async function getForumTopic(topicId: string): Promise<ForumTopic> {
  const response = await withRetry(() =>
    apiClient.get<ApiResponse<ForumTopic>>(`/admin/forum-topics/${topicId}`)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nel recupero argomento');
  }

  return response.data.data;
}

export async function createForumTopic(data: CreateForumTopicData): Promise<ForumTopic> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<ForumTopic>>('/admin/forum-topics', data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nella creazione argomento');
  }

  return response.data.data;
}

export async function updateForumTopic(topicId: string, data: UpdateForumTopicData): Promise<ForumTopic> {
  const response = await withRetry(() =>
    apiClient.put<ApiResponse<ForumTopic>>(`/admin/forum-topics/${topicId}`, data)
  );

  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'aggiornamento argomento');
  }

  return response.data.data;
}

export async function deleteForumTopic(topicId: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<void>>(`/admin/forum-topics/${topicId}`)
  );

  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nell\'eliminazione argomento');
  }
}
