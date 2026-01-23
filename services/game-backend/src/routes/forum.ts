import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
import { banChecks } from '../../../shared/src/middleware/banCheck';
import { ForumController } from '../controllers/ForumController';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for forum content creation
const forumCreationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 creations per windowMs
  message: {
    success: false,
    error: 'Too many forum posts created, please try again later.',
    code: 'FORUM_RATE_LIMIT_EXCEEDED',
    timestamp: new Date().toISOString()
  }
});

// FORUM ROUTES
// Forum initialization and stats
router.get('/init', AuthMiddleware.optionalAuth, ForumController.getForumInit);

// Topic management
router.get('/topics', ForumController.getTopics);
router.get('/topics/:slug', ForumController.getTopic);
router.post('/topics', AuthMiddleware.requireUserAuth, banChecks.forum(), forumCreationLimiter, ForumController.createTopic);

// Discussion management
router.get('/topics/:topicSlug/discussions', ForumController.getDiscussions);
router.get('/topics/:topicSlug/discussions/:discussionSlug', ForumController.getDiscussion);
router.post('/topics/:topicSlug/discussions', AuthMiddleware.requireUserAuth, banChecks.forum(), forumCreationLimiter, ForumController.createDiscussion);

// Post management  
router.get('/topics/:topicSlug/discussions/:discussionSlug/posts', ForumController.getPosts);
router.post('/topics/:topicSlug/discussions/:discussionSlug/posts', AuthMiddleware.requireUserAuth, banChecks.forum(), forumCreationLimiter, ForumController.createPost);

// Recent and popular discussions
router.get('/recent', ForumController.getRecentDiscussions);
router.get('/popular', ForumController.getPopularDiscussions);

// Favorites
router.get('/favorites', AuthMiddleware.requireUserAuth, ForumController.getUserFavoriteTopics);
router.post('/topics/:slug/favorite', AuthMiddleware.requireUserAuth, ForumController.addTopicToFavorites);
router.delete('/topics/:slug/favorite', AuthMiddleware.requireUserAuth, ForumController.removeTopicFromFavorites);
router.get('/topics/:slug/favorite', ForumController.checkTopicFavorite);

// Search
router.get('/search', ForumController.searchForum);
router.get('/search/stats', AuthMiddleware.optionalAuth, ForumController.getSearchStats);

export default router;