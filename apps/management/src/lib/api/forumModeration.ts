import { apiClient, withRetry } from './client';
import type { ApiResponse, ListResponse } from '@/types/api/common';
import type {
  ForumDiscussionAdmin,
  ForumDiscussionListParams,
  UpdateForumDiscussionData,
  ForumPostAdmin,
  ForumPostListParams,
} from '@/types/api/ForumModeration';

// ── Discussions ─────────────────────────────────────────────────────

export async function getForumDiscussionsAdmin(params: ForumDiscussionListParams): Promise<ListResponse<ForumDiscussionAdmin>> {
  const response = await withRetry(() =>
    apiClient.get<ListResponse<ForumDiscussionAdmin>>('/admin/forum-discussions', { params })
  );
  return response.data;
}

export async function updateForumDiscussionAdmin(discussionId: string, data: UpdateForumDiscussionData): Promise<ForumDiscussionAdmin> {
  const response = await withRetry(() =>
    apiClient.put<ApiResponse<ForumDiscussionAdmin>>(`/admin/forum-discussions/${discussionId}`, data)
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Errore nell\'aggiornamento della discussione');
  }
  return response.data.data;
}

export async function deleteForumDiscussionAdmin(discussionId: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<void>>(`/admin/forum-discussions/${discussionId}`)
  );
  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nell\'eliminazione della discussione');
  }
}

export async function restoreForumDiscussionAdmin(discussionId: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<void>>(`/admin/forum-discussions/${discussionId}/restore`)
  );
  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nel ripristino della discussione');
  }
}

// ── Posts ───────────────────────────────────────────────────────────

export async function getForumPostsAdmin(params: ForumPostListParams): Promise<ListResponse<ForumPostAdmin>> {
  const response = await withRetry(() =>
    apiClient.get<ListResponse<ForumPostAdmin>>('/admin/forum-posts', { params })
  );
  return response.data;
}

export async function pinForumPostAdmin(postId: string, pinned: boolean): Promise<void> {
  const response = await withRetry(() =>
    apiClient.put<ApiResponse<void>>(`/admin/forum-posts/${postId}/pin`, { pinned })
  );
  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nell\'aggiornamento del pin');
  }
}

export async function deleteForumPostAdmin(postId: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.delete<ApiResponse<void>>(`/admin/forum-posts/${postId}`)
  );
  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nell\'eliminazione del post');
  }
}

export async function restoreForumPostAdmin(postId: string): Promise<void> {
  const response = await withRetry(() =>
    apiClient.post<ApiResponse<void>>(`/admin/forum-posts/${postId}/restore`)
  );
  if (!response.data.success) {
    throw new Error(response.data.error || 'Errore nel ripristino del post');
  }
}
