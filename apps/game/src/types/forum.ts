/**
 * Forum Types
 *
 * Frontend types for the forum system (Bacheca).
 * Supports topics, discussions, posts, bookmarks, notifications, and search.
 *
 * @module types/forum
 * @since 2.0.0
 */

export type AccessRuleType = 'public' | 'authenticated' | 'corporation' | 'gameplayRole';

export interface TopicAccessRule {
  type: AccessRuleType;
  corporationId?: string;
  gameplayRole?: string;
  label?: string;
}

export interface ForumAuthor {
  characterId: string;
  characterName: string;
}

export interface ForumCategory {
  id: string;
  slug: string;
  title: string;
  description?: string;
  sortOrder: number;
  color?: string;
  icon?: string;
}

export interface ForumTopic {
  id: string;
  slug: string;
  title: string;
  description?: string;
  sortOrder: number;
  accessRules: TopicAccessRule[];
  isVisible: boolean;
  isLocked: boolean;
  isPinned: boolean;
  discussionCount: number;
  postCount: number;
  lastPostAt?: string;
  lastPostBy?: ForumAuthor;
  createdAt: string;
  createdBy: ForumAuthor;
  color?: string;
  icon?: string;
  isFavorite?: boolean;
  categoryId?: string;
  categorySlug?: string;
}

export interface ForumDiscussion {
  id: string;
  slug: string;
  topicSlug: string;
  topicId?: string;
  title: string;
  isPinned: boolean;
  isLocked: boolean;
  postCount: number;
  viewCount: number;
  subscriberCount: number;
  lastPostAt?: string;
  lastPostBy?: ForumAuthor;
  createdAt: string;
  createdBy: ForumAuthor;
  tags: string[];
  popularityScore?: number;
}

export interface ForumPost {
  id: string;
  topicSlug: string;
  discussionSlug: string;
  content: string;
  author: ForumAuthor;
  createdAt: string;
  updatedAt?: string;
  isEdited: boolean;
  isDeleted: boolean;
  replyToPostId?: string;
}

export interface ForumBookmark {
  _id: string;
  itemType: 'discussion' | 'post';
  itemId: string;
  topicSlug?: string;
  discussionSlug?: string;
  createdAt: string;
  /** Populated when itemType === 'post' */
  post?: ForumPost;
  /** Populated when itemType === 'discussion' */
  discussion?: ForumDiscussion;
}

export type ForumNotificationType =
  | 'new_post_in_subscribed_discussion'
  | 'reply_to_your_post';

export interface ForumNotification {
  _id: string;
  type: ForumNotificationType;
  title: string;
  message: string;
  topicSlug?: string;
  discussionSlug?: string;
  relatedPostId?: string;
  triggeredByCharacterName?: string;
  isRead: boolean;
  createdAt: string;
}

export interface ForumSearchResult {
  id: string;
  topicSlug: string;
  discussionSlug: string;
  content: string;
  author: ForumAuthor;
  createdAt: string;
  score?: number;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ForumInitData {
  totalDiscussions: number;
  totalPosts: number;
  authContext: {
    isAuthenticated: boolean;
    character: { characterId: string; characterName: string; gameplayRoles: string[] } | null;
  };
}

export type ForumView = 'categories' | 'topics' | 'discussions' | 'thread' | 'search' | 'bookmarks' | 'notifications' | 'createDiscussion';
