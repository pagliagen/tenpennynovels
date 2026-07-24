/**
 * Forum API Service
 *
 * Handles all HTTP API calls related to forum operations.
 * Uses the singleton apiClient for consistent auth and error handling.
 *
 * **Endpoints**:
 * - GET /forum/init - Forum init data
 * - GET /forum/topics - List topics
 * - GET /forum/topics/:slug - Get topic detail
 * - GET /forum/topics/:topicSlug/discussions - List discussions
 * - POST /forum/topics/:topicSlug/discussions - Create discussion
 * - GET /forum/topics/:topicSlug/discussions/:discussionSlug/posts - List posts
 * - POST /forum/topics/:topicSlug/discussions/:discussionSlug/posts - Create post
 * - GET /forum/search - Search forum
 * - POST /forum/topics/:slug/favorite - Toggle topic favorite
 * - POST /forum/posts/:postId/bookmark - Toggle bookmark
 * - GET /forum/notifications - Get notifications
 *
 * @module lib/api/forum
 * @since 2.0.0
 */

import type {
  ForumInitData,
  ForumCategory,
  ForumTopic,
  ForumDiscussion,
  DiscussionVisibility,
  ForumPost,
  ForumSearchResult,
  ForumBookmark,
  ForumNotification,
  PaginationInfo,
} from '@/types/forum';

import { api } from './client';

/**
 * Forum API Service
 *
 * Service layer for all forum CRUD operations.
 */
export const forumApi = {
  // ── Init ──────────────────────────────────────────────────────────

  async getInit(): Promise<ForumInitData> {
    const response = await api.get<{ data: ForumInitData }>('/forum/init');
    return response.data;
  },

  // ── Categories ────────────────────────────────────────────────────

  async getCategories(): Promise<ForumCategory[]> {
    const response = await api.get<{ data: ForumCategory[] }>('/forum/categories');
    return response.data;
  },

  // ── Topics ────────────────────────────────────────────────────────

  async getTopics(): Promise<ForumTopic[]> {
    const response = await api.get<{ data: ForumTopic[] }>('/forum/topics');
    return response.data;
  },

  async getTopic(slug: string): Promise<ForumTopic> {
    const response = await api.get<{ data: ForumTopic }>(`/forum/topics/${slug}`);
    return response.data;
  },

  // ── Discussions ───────────────────────────────────────────────────

  async getDiscussions(
    topicSlug: string,
    page?: number,
    limit?: number
  ): Promise<{ list: ForumDiscussion[]; pagination: PaginationInfo }> {
    const response = await api.get<{ list: ForumDiscussion[]; pagination: PaginationInfo }>(
      `/forum/topics/${topicSlug}/discussions`,
      { params: { page, limit } }
    );
    const defaultPagination: PaginationInfo = { page: 1, pageSize: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false };
    return { list: response.list ?? [], pagination: response.pagination ?? defaultPagination };
  },

  async getDiscussion(
    topicSlug: string,
    discussionSlug: string
  ): Promise<ForumDiscussion> {
    const response = await api.get<{ data: ForumDiscussion }>(
      `/forum/topics/${topicSlug}/discussions/${discussionSlug}`
    );
    return response.data;
  },

  async createDiscussion(
    topicSlug: string,
    data: { title: string; content: string; tags?: string[]; visibility?: DiscussionVisibility; isAnonymous?: boolean }
  ): Promise<{ id: string; slug: string }> {
    const response = await api.post<{ data: { id: string; slug: string } }>(
      `/forum/topics/${topicSlug}/discussions`,
      data
    );
    const body = response as { data?: { id: string; slug: string }; id?: string; slug?: string };
    return body.data ?? (body as { id: string; slug: string });
  },

  async updateDiscussion(
    topicSlug: string,
    discussionSlug: string,
    data: { title?: string; tags?: string[] }
  ): Promise<void> {
    await api.put(`/forum/topics/${topicSlug}/discussions/${discussionSlug}`, data);
  },

  async updateDiscussionVisibility(
    topicSlug: string,
    discussionSlug: string,
    data: { visibility?: DiscussionVisibility; excludedCharacterIds?: string[] }
  ): Promise<void> {
    await api.put(`/forum/topics/${topicSlug}/discussions/${discussionSlug}/visibility`, data);
  },

  async broadcastDiscussion(topicSlug: string, discussionSlug: string): Promise<{ recipientCount: number }> {
    const response = await api.post<{ data: { broadcasted: boolean; recipientCount: number } }>(
      `/forum/topics/${topicSlug}/discussions/${discussionSlug}/broadcast`
    );
    return response.data;
  },

  async deleteDiscussion(topicSlug: string, discussionSlug: string): Promise<void> {
    await api.delete(`/forum/topics/${topicSlug}/discussions/${discussionSlug}`);
  },

  // ── Posts ─────────────────────────────────────────────────────────

  async getPosts(
    topicSlug: string,
    discussionSlug: string,
    page?: number,
    limit?: number
  ): Promise<{ list: ForumPost[]; pagination: PaginationInfo }> {
    const response = await api.get<{ list: ForumPost[]; pagination: PaginationInfo }>(
      `/forum/topics/${topicSlug}/discussions/${discussionSlug}/posts`,
      { params: { page, limit } }
    );
    const defaultPagination: PaginationInfo = { page: 1, pageSize: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false };
    return { list: response.list ?? [], pagination: response.pagination ?? defaultPagination };
  },

  async createPost(
    topicSlug: string,
    discussionSlug: string,
    data: { content: string; replyToPostId?: string; isAnonymous?: boolean }
  ): Promise<{ id: string }> {
    const response = await api.post<{ data: { id: string } }>(
      `/forum/topics/${topicSlug}/discussions/${discussionSlug}/posts`,
      data
    );
    return response.data;
  },

  async updatePost(postId: string, content: string): Promise<void> {
    await api.put(`/forum/posts/${postId}`, { content });
  },

  async deletePost(postId: string): Promise<void> {
    await api.delete(`/forum/posts/${postId}`);
  },

  async togglePinPost(postId: string, pinned: boolean): Promise<void> {
    await api.put(`/forum/posts/${postId}/pin`, { pinned });
  },

  // ── Search ────────────────────────────────────────────────────────

  async searchForum(
    query: string,
    topicSlug?: string
  ): Promise<{ list: ForumSearchResult[]; pagination: PaginationInfo }> {
    const response = await api.get<{ list: ForumSearchResult[]; pagination: PaginationInfo }>(
      '/forum/search',
      { params: { q: query, topicSlug } }
    );
    const defaultPagination: PaginationInfo = { page: 1, pageSize: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false };
    return { list: response.list ?? [], pagination: response.pagination ?? defaultPagination };
  },

  // ── Favorites ─────────────────────────────────────────────────────

  async getFavorites(): Promise<ForumTopic[]> {
    const response = await api.get<{ data: ForumTopic[] }>('/forum/favorites');
    return response.data;
  },

  async toggleFavorite(topicSlug: string): Promise<{ isFavorite: boolean }> {
    const response = await api.post<{ data: { isFavorite: boolean } }>(
      `/forum/topics/${topicSlug}/favorite`
    );
    return response.data;
  },

  // ── Subscriptions ─────────────────────────────────────────────────

  async subscribe(topicSlug: string, discussionSlug: string): Promise<void> {
    await api.post(`/forum/topics/${topicSlug}/discussions/${discussionSlug}/subscribe`);
  },

  async getSubscriptions(): Promise<any[]> {
    const response = await api.get<{ data: { subscriptions: any[] } }>('/forum/subscriptions');
    return response.data.subscriptions;
  },

  // ── Bookmarks ─────────────────────────────────────────────────────

  async toggleBookmark(postId: string): Promise<void> {
    await api.post(`/forum/posts/${postId}/bookmark`);
  },

  async getBookmarks(): Promise<ForumBookmark[]> {
    const response = await api.get<{ data: { bookmarks: ForumBookmark[] } }>('/forum/bookmarks');
    return response.data.bookmarks;
  },

  // ── Notifications ─────────────────────────────────────────────────

  async getNotifications(
    page?: number
  ): Promise<{ list: ForumNotification[]; pagination: PaginationInfo }> {
    const response = await api.get<{
      list?: ForumNotification[];
      pagination?: PaginationInfo;
    }>('/forum/notifications', { params: { page } });
    const list = response.list ?? [];
    const pagination = response.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false };
    return { list, pagination };
  },

  async markNotificationsRead(notificationIds: string[]): Promise<void> {
    await api.post('/forum/notifications/mark-read', { notificationIds });
  },

  async markAllNotificationsRead(): Promise<void> {
    await api.post('/forum/notifications/mark-read', { all: true });
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get<{ data: { unreadCount: number } }>('/forum/notifications/unread-count');
    return response.data.unreadCount;
  },

  // ── Recent & Popular ──────────────────────────────────────────────

  async getRecentDiscussions(limit?: number): Promise<ForumDiscussion[]> {
    const response = await api.get<{ data: ForumDiscussion[] }>(
      '/forum/recent',
      { params: { limit } }
    );
    return response.data;
  },

  async getPopularDiscussions(timeframe?: string, limit?: number): Promise<ForumDiscussion[]> {
    const response = await api.get<{ data: ForumDiscussion[] }>(
      '/forum/popular',
      { params: { timeframe, limit } }
    );
    return response.data;
  },
};
