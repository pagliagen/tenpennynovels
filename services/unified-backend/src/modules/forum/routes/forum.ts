import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthMiddleware } from '../../auth/middleware/auth';
import { banChecks } from '@shared/middleware/banCheck';
import { ForumController } from '../controllers/ForumController';
import { ForumSubscriptionController } from '../controllers/ForumSubscriptionController';
import { ForumBookmarkController } from '../controllers/ForumBookmarkController';
import { ForumNotificationController } from '../controllers/ForumNotificationController';

const router = Router();

// Rate limiters for different operation types
const forumReadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 read requests per minute
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'FORUM_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

const forumCreationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 creation requests per 5 minutes
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'FORUM_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

const forumModificationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 modification requests per minute
  message: {
    result: false,
    error: 'Troppe richieste, riprova più tardi.',
    code: 'FORUM_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

const optionalAuth = [
  AuthMiddleware.authenticateUser(false),
  AuthMiddleware.authenticateCharacter(false)
];
const requiredAuth = [
  AuthMiddleware.authenticateUser(),
  AuthMiddleware.authenticateCharacter()
];
const requiredAuthBan = [
  AuthMiddleware.authenticateUser(),
  AuthMiddleware.authenticateCharacter(),
  banChecks.forum()
];

// ----- Init -----
router.get('/init', forumReadLimiter, optionalAuth, ForumController.getForumInit);

// ----- Topics (read-only, CRUD via /admin/forum-topics) -----
router.get('/topics', forumReadLimiter, optionalAuth, ForumController.getTopics);
router.get('/topics/:slug', forumReadLimiter, optionalAuth, ForumController.getTopic);

// ----- Discussions -----
router.get('/topics/:topicSlug/discussions', forumReadLimiter, optionalAuth, ForumController.getDiscussions);
router.get('/topics/:topicSlug/discussions/:discussionSlug', forumReadLimiter, optionalAuth, ForumController.getDiscussion);
router.post('/topics/:topicSlug/discussions', forumCreationLimiter, requiredAuthBan, ForumController.createDiscussion);
router.put('/topics/:topicSlug/discussions/:discussionSlug', forumModificationLimiter, requiredAuthBan, ForumController.updateDiscussion);
router.delete('/topics/:topicSlug/discussions/:discussionSlug', forumModificationLimiter, requiredAuthBan, ForumController.deleteDiscussion);
router.post('/topics/:topicSlug/discussions/:discussionSlug/restore', forumModificationLimiter, requiredAuthBan, ForumController.restoreDiscussion);

// ----- Posts -----
router.get('/topics/:topicSlug/discussions/:discussionSlug/posts', forumReadLimiter, optionalAuth, ForumController.getPosts);
router.post('/topics/:topicSlug/discussions/:discussionSlug/posts', forumCreationLimiter, requiredAuthBan, ForumController.createPost);
router.put('/posts/:postId', forumModificationLimiter, requiredAuthBan, ForumController.updatePost);
router.delete('/posts/:postId', forumModificationLimiter, requiredAuthBan, ForumController.deletePost);
router.post('/posts/:postId/restore', forumModificationLimiter, requiredAuthBan, ForumController.restorePost);

// ----- Search, Recent, Popular -----
router.get('/search', forumReadLimiter, optionalAuth, ForumController.searchForum);
router.get('/recent', forumReadLimiter, optionalAuth, ForumController.getRecentDiscussions);
router.get('/popular', forumReadLimiter, optionalAuth, ForumController.getPopularDiscussions);

// ----- Favorites -----
router.post('/topics/:slug/favorite', forumCreationLimiter, requiredAuth, ForumController.toggleTopicFavorite);
router.get('/favorites', forumReadLimiter, requiredAuth, ForumController.getUserFavoriteTopics);

// ----- Subscriptions -----
router.post('/topics/:topicSlug/discussions/:discussionSlug/subscribe', forumCreationLimiter, requiredAuthBan, ForumSubscriptionController.subscribe);
router.get('/subscriptions', forumReadLimiter, requiredAuth, ForumSubscriptionController.getSubscriptions);

// ----- Bookmarks -----
router.post('/posts/:postId/bookmark', forumCreationLimiter, requiredAuth, ForumBookmarkController.toggleBookmark);
router.get('/bookmarks', forumReadLimiter, requiredAuth, ForumBookmarkController.getBookmarks);

// ----- Notifications -----
router.get('/notifications', forumReadLimiter, requiredAuth, ForumNotificationController.getNotifications);
router.get('/notifications/unread-count', forumReadLimiter, requiredAuth, ForumNotificationController.getUnreadCount);
router.post('/notifications/mark-read', forumCreationLimiter, requiredAuth, ForumNotificationController.markRead);

export default router;
