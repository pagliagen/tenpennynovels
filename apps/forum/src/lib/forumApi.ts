// Forum API Integration
// Handles communication with backend forum services

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';

export interface ForumTopic {
  id: string;
  slug: string;
  title: string;
  description?: string;
  category: string;
  isPublic: boolean;
  isVisible: boolean;
  isLocked: boolean;
  postCount: number;
  lastPostAt?: Date | string;
  lastPostBy?: {
    userId: string;
    username: string;
    characterName?: string;
  };
  createdAt: Date | string;
  createdBy: {
    userId: string;
    username: string;
  };
  isPinned?: boolean;
  color?: string;
  icon?: string;
}

export interface ForumPost {
  id: string;
  topicSlug: string;
  discussionSlug?: string;
  content: string;
  authorUserId: string;
  authorUsername: string;
  authorCharacterName?: string;
  authorCharacterId?: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  isEdited: boolean;
  editHistory?: EditEntry[];
  isPinned?: boolean;
  isDeleted: boolean;
  deletedAt?: Date | string;
  deletedBy?: string;
  replyToPostId?: string;
  reactionCounts?: {
    [emoji: string]: number;
  };
  relevanceScore?: number;
}

export interface Discussion {
  id: string;
  slug: string;
  topicSlug: string;
  title: string;
  isPinned: boolean;
  isLocked: boolean;
  isVisible: boolean;
  postCount: number;
  viewCount: number;
  lastPostAt?: Date | string;
  lastPostBy?: {
    userId: string;
    username: string;
    characterName?: string;
  };
  createdAt: Date | string;
  createdBy: {
    userId: string;
    username: string;
    characterName?: string;
  };
  tags?: string[];
}

export interface EditEntry {
  editedAt: Date | string;
  editedBy: string;
  reason?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CreateTopicRequest {
  title: string;
  description?: string;
  isPublic: boolean;
  slug?: string;
  color?: string;
  icon?: string;
}

export interface CreateDiscussionRequest {
  title: string;
  content: string;
  tags?: string[];
}

export interface CreatePostRequest {
  content: string;
  replyToPostId?: string;
}

export interface UpdatePostRequest {
  content: string;
  reason?: string;
}

/**
 * Get authentication headers from cookies
 */
function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  
  return {
    'Cookie': document.cookie,
  };
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}/forum${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${errorText}`);
  }
  
  return response.json();
}

// TOPIC MANAGEMENT

export async function getTopics(): Promise<ForumTopic[]> {
  const response = await apiRequest<{ success: boolean; data: ForumTopic[] }>('/topics');
  return response.data;
}

export async function getTopic(slug: string): Promise<ForumTopic> {
  const response = await apiRequest<{ success: boolean; data: ForumTopic }>(`/topics/${slug}`);
  return response.data;
}

export async function createTopic(data: CreateTopicRequest): Promise<ForumTopic> {
  return apiRequest<ForumTopic>('/topics', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTopic(slug: string, data: Partial<CreateTopicRequest>): Promise<ForumTopic> {
  return apiRequest<ForumTopic>(`/topics/${slug}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteTopic(slug: string): Promise<void> {
  return apiRequest<void>(`/topics/${slug}`, {
    method: 'DELETE',
  });
}

export async function pinTopic(slug: string): Promise<ForumTopic> {
  return apiRequest<ForumTopic>(`/topics/${slug}/pin`, {
    method: 'POST',
  });
}

export async function unpinTopic(slug: string): Promise<ForumTopic> {
  return apiRequest<ForumTopic>(`/topics/${slug}/unpin`, {
    method: 'POST',
  });
}

export async function lockTopic(slug: string): Promise<ForumTopic> {
  return apiRequest<ForumTopic>(`/topics/${slug}/lock`, {
    method: 'POST',
  });
}

export async function unlockTopic(slug: string): Promise<ForumTopic> {
  return apiRequest<ForumTopic>(`/topics/${slug}/unlock`, {
    method: 'POST',
  });
}

// DISCUSSION MANAGEMENT

export async function getDiscussions(
  topicSlug: string, 
  page: number = 1, 
  limit: number = 20
): Promise<PaginatedResponse<Discussion>> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  
  const response = await apiRequest<{ success: boolean; data: Discussion[]; pagination: any }>(`/topics/${topicSlug}/discussions?${params}`);
  return {
    data: response.data,
    pagination: response.pagination
  };
}

export async function getDiscussion(topicSlug: string, discussionSlug: string): Promise<Discussion> {
  const response = await apiRequest<{ success: boolean; data: Discussion }>(`/topics/${topicSlug}/discussions/${discussionSlug}`);
  return response.data;
}

export async function createDiscussion(
  topicSlug: string, 
  data: CreateDiscussionRequest
): Promise<Discussion> {
  return apiRequest<Discussion>(`/topics/${topicSlug}/discussions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDiscussion(
  topicSlug: string, 
  discussionSlug: string, 
  data: Partial<CreateDiscussionRequest>
): Promise<Discussion> {
  return apiRequest<Discussion>(`/topics/${topicSlug}/discussions/${discussionSlug}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteDiscussion(topicSlug: string, discussionSlug: string): Promise<void> {
  return apiRequest<void>(`/topics/${topicSlug}/discussions/${discussionSlug}`, {
    method: 'DELETE',
  });
}

export async function pinDiscussion(topicSlug: string, discussionSlug: string): Promise<Discussion> {
  return apiRequest<Discussion>(`/topics/${topicSlug}/discussions/${discussionSlug}/pin`, {
    method: 'POST',
  });
}

export async function lockDiscussion(topicSlug: string, discussionSlug: string): Promise<Discussion> {
  return apiRequest<Discussion>(`/topics/${topicSlug}/discussions/${discussionSlug}/lock`, {
    method: 'POST',
  });
}

// POST MANAGEMENT

export async function getPosts(
  topicSlug: string, 
  discussionSlug: string, 
  page: number = 1, 
  limit: number = 20
): Promise<PaginatedResponse<ForumPost>> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  
  return apiRequest<PaginatedResponse<ForumPost>>(`/topics/${topicSlug}/discussions/${discussionSlug}/posts?${params}`);
}

export async function getPost(
  topicSlug: string, 
  discussionSlug: string, 
  postId: string
): Promise<ForumPost> {
  return apiRequest<ForumPost>(`/topics/${topicSlug}/discussions/${discussionSlug}/posts/${postId}`);
}

export async function createPost(
  topicSlug: string, 
  discussionSlug: string, 
  data: CreatePostRequest
): Promise<ForumPost> {
  return apiRequest<ForumPost>(`/topics/${topicSlug}/discussions/${discussionSlug}/posts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePost(
  topicSlug: string, 
  discussionSlug: string, 
  postId: string, 
  data: UpdatePostRequest
): Promise<ForumPost> {
  return apiRequest<ForumPost>(`/topics/${topicSlug}/discussions/${discussionSlug}/posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deletePost(
  topicSlug: string, 
  discussionSlug: string, 
  postId: string
): Promise<void> {
  return apiRequest<void>(`/topics/${topicSlug}/discussions/${discussionSlug}/posts/${postId}`, {
    method: 'DELETE',
  });
}

// RECENT AND POPULAR DISCUSSIONS

export async function getRecentDiscussions(
  limit: number = 20
): Promise<PaginatedResponse<Discussion>> {
  const response = await apiRequest<{ success: boolean; data: Discussion[]; pagination: any }>(`/recent?limit=${limit}`);
  return {
    data: response.data,
    pagination: response.pagination
  };
}

export async function getPopularDiscussions(
  limit: number = 20,
  timeframe: 'week' | 'month' | 'all' = 'week'
): Promise<PaginatedResponse<Discussion>> {
  const response = await apiRequest<{ success: boolean; data: Discussion[]; pagination: any }>(`/popular?limit=${limit}&timeframe=${timeframe}`);
  return {
    data: response.data,
    pagination: response.pagination
  };
}

// SEARCH

export async function searchForum(
  query: string, 
  topicSlug?: string, 
  page: number = 1, 
  limit: number = 20
): Promise<PaginatedResponse<ForumPost>> {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
    limit: limit.toString(),
  });
  
  if (topicSlug) {
    params.append('topic', topicSlug);
  }
  
  return apiRequest<PaginatedResponse<ForumPost>>(`/forum/search?${params}`);
}

// MODERATION

export async function reportPost(
  topicSlug: string, 
  discussionSlug: string, 
  postId: string, 
  reason: string
): Promise<void> {
  return apiRequest<void>(`/topics/${topicSlug}/discussions/${discussionSlug}/posts/${postId}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function banUser(userId: string, reason: string, duration?: number): Promise<void> {
  return apiRequest<void>(`/moderation/ban`, {
    method: 'POST',
    body: JSON.stringify({ userId, reason, duration }),
  });
}

export async function getReports(): Promise<any[]> {
  return apiRequest<any[]>('/moderation/reports');
}

// FAVORITES

export async function getUserFavoriteTopics(): Promise<ForumTopic[]> {
  const response = await apiRequest<{ success: boolean; data: ForumTopic[] }>('/favorites');
  return response.data;
}

export async function addTopicToFavorites(slug: string): Promise<{ message: string; topicSlug: string; isFavorite: boolean }> {
  const response = await apiRequest<{ success: boolean; data: { message: string; topicSlug: string; isFavorite: boolean } }>(`/topics/${slug}/favorite`, {
    method: 'POST'
  });
  return response.data;
}

export async function removeTopicFromFavorites(slug: string): Promise<{ message: string; topicSlug: string; isFavorite: boolean }> {
  const response = await apiRequest<{ success: boolean; data: { message: string; topicSlug: string; isFavorite: boolean } }>(`/topics/${slug}/favorite`, {
    method: 'DELETE'
  });
  return response.data;
}

export async function checkTopicFavorite(slug: string): Promise<{ isFavorite: boolean }> {
  const response = await apiRequest<{ success: boolean; data: { isFavorite: boolean } }>(`/topics/${slug}/favorite`);
  return response.data;
}