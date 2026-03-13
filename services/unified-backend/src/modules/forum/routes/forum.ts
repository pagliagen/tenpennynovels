import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthMiddleware } from '../../auth/middleware/auth';
import { banChecks } from '@shared/middleware/banCheck';
import { ForumController } from '../controllers/ForumController';
import { ForumSubscriptionController } from '../controllers/ForumSubscriptionController';
import { ForumFollowController } from '../controllers/ForumFollowController';
import { ForumBookmarkController } from '../controllers/ForumBookmarkController';
import { ForumReactionController } from '../controllers/ForumReactionController';
import { ForumNotificationController } from '../controllers/ForumNotificationController';

const router = Router();

const forumCreationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
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
router.get('/init', optionalAuth, ForumController.getForumInit);

// ----- Topics (read-only, CRUD via /admin/forum-topics) -----
router.get('/topics', optionalAuth, ForumController.getTopics);
router.get('/topics/:slug', optionalAuth, ForumController.getTopic);

// ----- Discussions -----
router.get('/topics/:topicSlug/discussions', optionalAuth, ForumController.getDiscussions);
router.get('/topics/:topicSlug/discussions/:discussionSlug', optionalAuth, ForumController.getDiscussion);
router.post('/topics/:topicSlug/discussions', requiredAuthBan, forumCreationLimiter, ForumController.createDiscussion);
router.put('/topics/:topicSlug/discussions/:discussionSlug', requiredAuth, ForumController.updateDiscussion);
router.delete('/topics/:topicSlug/discussions/:discussionSlug', requiredAuth, ForumController.deleteDiscussion);

// ----- Posts -----
router.get('/topics/:topicSlug/discussions/:discussionSlug/posts', optionalAuth, ForumController.getPosts);
router.post('/topics/:topicSlug/discussions/:discussionSlug/posts', requiredAuthBan, forumCreationLimiter, ForumController.createPost);
router.put('/posts/:postId', requiredAuth, ForumController.updatePost);
router.delete('/posts/:postId', requiredAuth, ForumController.deletePost);

// ----- Search, Recent, Popular -----
router.get('/search', optionalAuth, ForumController.searchForum);
router.get('/recent', optionalAuth, ForumController.getRecentDiscussions);
router.get('/popular', optionalAuth, ForumController.getPopularDiscussions);

// ----- Favorites -----
router.post('/topics/:slug/favorite', requiredAuth, ForumController.toggleTopicFavorite);
router.get('/favorites', requiredAuth, ForumController.getUserFavoriteTopics);

// ----- Subscriptions -----
router.post('/topics/:topicSlug/discussions/:discussionSlug/subscribe', requiredAuthBan, ForumSubscriptionController.subscribe);
router.get('/subscriptions', requiredAuth, ForumSubscriptionController.getSubscriptions);

// ----- Follows -----
router.post('/characters/:characterId/follow', requiredAuthBan, ForumFollowController.follow);
router.get('/following', requiredAuth, ForumFollowController.getFollowing);

// ----- Bookmarks -----
router.post('/posts/:postId/bookmark', requiredAuth, ForumBookmarkController.toggleBookmark);
router.get('/bookmarks', requiredAuth, ForumBookmarkController.getBookmarks);

// ----- Reactions -----
router.post('/posts/:postId/reactions', requiredAuthBan, ForumReactionController.create);
router.get('/posts/:postId/reactions', optionalAuth, ForumReactionController.list);

// ----- Notifications -----
router.get('/notifications', requiredAuth, ForumNotificationController.getNotifications);
router.get('/notifications/unread-count', requiredAuth, ForumNotificationController.getUnreadCount);
router.post('/notifications/mark-read', requiredAuth, ForumNotificationController.markRead);

export default router;
