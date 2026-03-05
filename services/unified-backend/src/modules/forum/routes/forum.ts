import { Router } from 'express';
import { AuthMiddleware } from '../../auth/middleware/auth';
import { banChecks } from '@shared/middleware/banCheck';
import { ForumController } from '../controllers/ForumController';
import { ForumSubscriptionController } from '../controllers/ForumSubscriptionController';
import { ForumFollowController } from '../controllers/ForumFollowController';
import { ForumBookmarkController } from '../controllers/ForumBookmarkController';
import { ForumReactionController } from '../controllers/ForumReactionController';
import { ForumNotificationController } from '../controllers/ForumNotificationController';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for forum content creation
const forumCreationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 creations per windowMs
  message: {
    result: false,
    error: 'Too many forum posts created, please try again later.',
    code: 'FORUM_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

// FORUM ROUTES
// Forum initialization and stats
router.get('/init', AuthMiddleware.authenticateUser(false), ForumController.getForumInit);

// Topic management
router.get('/topics', ForumController.getTopics);
router.get('/topics/:slug', ForumController.getTopic);
router.post('/topics', AuthMiddleware.authenticateUser(), banChecks.forum(), forumCreationLimiter, ForumController.createTopic);

// Discussion management
router.get('/topics/:topicSlug/discussions', ForumController.getDiscussions);
router.get('/topics/:topicSlug/discussions/:discussionSlug', ForumController.getDiscussion);
router.post('/topics/:topicSlug/discussions', AuthMiddleware.authenticateUser(), banChecks.forum(), forumCreationLimiter, ForumController.createDiscussion);

// Post management  
router.get('/topics/:topicSlug/discussions/:discussionSlug/posts', ForumController.getPosts);
router.post('/topics/:topicSlug/discussions/:discussionSlug/posts', AuthMiddleware.authenticateUser(), banChecks.forum(), forumCreationLimiter, ForumController.createPost);

// Recent and popular discussions
router.get('/recent', ForumController.getRecentDiscussions);
router.get('/popular', ForumController.getPopularDiscussions);

// Favorites
router.get('/favorites', AuthMiddleware.authenticateUser(), ForumController.getUserFavoriteTopics);
router.post('/topics/:slug/favorite', AuthMiddleware.authenticateUser(), ForumController.addTopicToFavorites);
router.delete('/topics/:slug/favorite', AuthMiddleware.authenticateUser(), ForumController.removeTopicFromFavorites);
router.get('/topics/:slug/favorite', ForumController.checkTopicFavorite);

// Search
router.get('/search', ForumController.searchForum);
router.get('/search/stats', AuthMiddleware.authenticateUser(false), ForumController.getSearchStats);

// ========== NEW FEATURES ==========

// Discussion Subscriptions (4 routes)
router.post('/topics/:topicSlug/discussions/:discussionSlug/subscribe',
  AuthMiddleware.authenticateUser(),
  banChecks.forum(),
  ForumSubscriptionController.subscribe
);
router.delete('/topics/:topicSlug/discussions/:discussionSlug/subscribe',
  AuthMiddleware.authenticateUser(),
  ForumSubscriptionController.unsubscribe
);
router.get('/subscriptions',
  AuthMiddleware.authenticateUser(),
  ForumSubscriptionController.getSubscriptions
);
router.get('/topics/:topicSlug/discussions/:discussionSlug/subscribers',
  ForumSubscriptionController.getSubscribers
);

// Character Follows (5 routes)
router.post('/characters/:characterId/follow',
  AuthMiddleware.authenticateUser(),
  banChecks.forum(),
  ForumFollowController.follow
);
router.delete('/characters/:characterId/follow',
  AuthMiddleware.authenticateUser(),
  ForumFollowController.unfollow
);
router.get('/characters/:characterId/followers',
  ForumFollowController.getFollowers
);
router.get('/characters/:characterId/following',
  ForumFollowController.getFollowing
);
router.get('/my-follows',
  AuthMiddleware.authenticateUser(),
  ForumFollowController.getMyFollows
);

// Bookmarks (5 routes)
router.post('/bookmarks',
  AuthMiddleware.authenticateUser(),
  ForumBookmarkController.create
);
router.delete('/bookmarks/:bookmarkId',
  AuthMiddleware.authenticateUser(),
  ForumBookmarkController.delete
);
router.get('/bookmarks',
  AuthMiddleware.authenticateUser(),
  ForumBookmarkController.list
);
router.get('/bookmarks/check',
  AuthMiddleware.authenticateUser(),
  ForumBookmarkController.check
);
router.post('/bookmarks/toggle',
  AuthMiddleware.authenticateUser(),
  ForumBookmarkController.toggle
);

// Reactions (5 routes) - Rate limit gestito da API Gateway
router.post('/posts/:postId/reactions',
  AuthMiddleware.authenticateUser(),
  banChecks.forum(),
  ForumReactionController.create
);
router.delete('/posts/:postId/reactions',
  AuthMiddleware.authenticateUser(),
  ForumReactionController.delete
);
router.get('/posts/:postId/reactions',
  ForumReactionController.list
);
router.get('/my-reactions',
  AuthMiddleware.authenticateUser(),
  ForumReactionController.getMyReactions
);
router.get('/posts/:postId/reactions/check',
  AuthMiddleware.authenticateUser(),
  ForumReactionController.check
);

// Notifications (5 routes)
router.get('/notifications',
  AuthMiddleware.authenticateUser(),
  ForumNotificationController.list
);
router.get('/notifications/:notificationId',
  AuthMiddleware.authenticateUser(),
  ForumNotificationController.get
);
router.put('/notifications/:notificationId/read',
  AuthMiddleware.authenticateUser(),
  ForumNotificationController.markRead
);
router.put('/notifications/read-all',
  AuthMiddleware.authenticateUser(),
  ForumNotificationController.markAllRead
);
router.delete('/notifications/:notificationId',
  AuthMiddleware.authenticateUser(),
  ForumNotificationController.delete
);

export default router;