/**
 * Forum Models - Centralized Export
 *
 * Phase 1: Existing Collections (Converted to Mongoose)
 * - ForumTopic
 * - ForumDiscussion
 * - ForumPost
 * - ForumTopicFavorite
 *
 * Phase 2: New Feature Models
 * - ForumDiscussionSubscription (subscriptions feature)
 * - ForumCharacterFollow (character follows feature)
 * - ForumBookmark (bookmarks feature)
 * - ForumReaction (reactions feature)
 * - ForumNotification (notifications feature)
 */

// Phase 1: Existing Collections
export * from './ForumTopic';
export * from './ForumDiscussion';
export * from './ForumPost';
export * from './ForumTopicFavorite';

// Phase 2: New Feature Models
export * from './ForumDiscussionSubscription';
export * from './ForumCharacterFollow';
export * from './ForumBookmark';
export * from './ForumReaction';
export * from './ForumNotification';
