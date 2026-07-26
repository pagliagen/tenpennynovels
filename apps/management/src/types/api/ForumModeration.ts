/**
 * Types for manual forum moderation (discussions/posts) via
 * /admin/forum-discussions and /admin/forum-posts.
 *
 * Distinct from the AI toxicity alert queue (types/api - see lib/api/moderation.ts),
 * this is direct staff moderation: pin/lock/move/soft-delete/restore.
 */

export interface ForumDiscussionAdmin {
  _id: string;
  slug: string;
  topicId: string;
  topicSlug: string;
  title: string;
  isPinned: boolean;
  isLocked: boolean;
  isVisible: boolean;
  postCount: number;
  viewCount: number;
  subscriberCount: number;
  lastPostAt?: string;
  lastPostBy?: { characterId: string; characterName: string };
  createdAt: string;
  createdBy: { characterId: string; characterName: string };
  tags?: string[];
  isDeleted: boolean;
  deletedAt?: string;
}

export interface ForumDiscussionListParams {
  page?: number;
  limit?: number;
  search?: string;
  topicSlug?: string;
  isLocked?: boolean;
  isPinned?: boolean;
  includeDeleted?: boolean;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateForumDiscussionData {
  isPinned?: boolean;
  isLocked?: boolean;
  topicId?: string;
}

export interface ForumPostAdmin {
  _id: string;
  topicId: string;
  discussionId: string;
  topicSlug: string;
  discussionSlug: string;
  content: string;
  author: { characterId: string; characterName: string };
  createdAt: string;
  updatedAt?: string;
  isEdited: boolean;
  isDeleted: boolean;
  deletedAt?: string;
  isAnonymous?: boolean;
  isPinned?: boolean;
  moderationScore?: number;
  moderationLabel?: string;
}

export interface ForumPostListParams {
  page?: number;
  limit?: number;
  search?: string;
  topicSlug?: string;
  discussionSlug?: string;
  authorCharacterId?: string;
  moderationLabel?: string;
  includeDeleted?: boolean;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
