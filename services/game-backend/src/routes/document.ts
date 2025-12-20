import { Router } from 'express';
import { AuthMiddleware } from '../middleware/auth';
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
// Topic management
router.get('/topics', ForumController.getTopics);
router.get('/topics/:slug', ForumController.getTopic);
router.post('/topics', AuthMiddleware.requireUserAuth, forumCreationLimiter, ForumController.createTopic);

// Discussion management
router.get('/topics/:topicSlug/discussions', ForumController.getDiscussions);
router.get('/topics/:topicSlug/discussions/:discussionSlug', ForumController.getDiscussion);
router.post('/topics/:topicSlug/discussions', AuthMiddleware.requireUserAuth, forumCreationLimiter, ForumController.createDiscussion);

// Post management  
router.get('/topics/:topicSlug/discussions/:discussionSlug/posts', ForumController.getPosts);
router.post('/topics/:topicSlug/discussions/:discussionSlug/posts', AuthMiddleware.requireUserAuth, forumCreationLimiter, ForumController.createPost);

// Search
router.get('/search', ForumController.searchForum);

export default router;