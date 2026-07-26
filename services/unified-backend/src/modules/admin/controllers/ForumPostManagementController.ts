import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ForumPost } from '@database/models/ForumPost';
import { ForumDiscussion } from '@database/models/ForumDiscussion';
import { ForumTopic } from '@database/models/ForumTopic';
import { recalculateDiscussionLastPost, recalculateTopicLastPost } from '../../forum/controllers/ForumController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { resolveAdminCharacterSelectionContext } from '../utils/permissions';
import { logger } from '../utils/logger';
import { successResponse, errorResponse, listResponse, deleteResponse, getRequestId } from '@shared/utils/apiResponse';
import { escapeRegex } from '@shared/utils/validation';

/**
 * Admin-only manual moderation for ForumPost (pin/soft-delete/restore) -
 * distinct from the AI toxicity alert queue and from the character-facing
 * forum routes. See ForumDiscussionManagementController for the same
 * attribution rationale (admin User id + best-effort selected character).
 */
export class ForumPostManagementController {

  /**
   * GET /admin/forum-posts
   */
  static async getPosts(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      const search = req.query.search as string;
      const topicSlug = req.query.topicSlug as string;
      const discussionSlug = req.query.discussionSlug as string;
      const authorCharacterId = req.query.authorCharacterId as string;
      const moderationLabel = req.query.moderationLabel as string;
      const includeDeleted = req.query.includeDeleted === 'true';
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as string) === 'asc' ? 1 : -1;

      const filter: Record<string, unknown> = {};
      if (!includeDeleted) filter.isDeleted = false;
      // typeof guard: Express parses `?topicSlug[$ne]=x` into an object, not a
      // string — without this check that object would reach Mongo as a query
      // operator instead of a literal value (NoSQL injection).
      if (topicSlug && typeof topicSlug === 'string') filter.topicSlug = topicSlug;
      if (discussionSlug && typeof discussionSlug === 'string') filter.discussionSlug = discussionSlug;
      if (authorCharacterId && mongoose.Types.ObjectId.isValid(authorCharacterId)) {
        filter['author.characterId'] = new mongoose.Types.ObjectId(authorCharacterId);
      }
      if (moderationLabel === 'toxic' || moderationLabel === 'not-toxic') filter.moderationLabel = moderationLabel;
      if (search && typeof search === 'string') {
        const escapedSearch = escapeRegex(search);
        filter.content = { $regex: escapedSearch, $options: 'i' };
      }
      if (dateFrom || dateTo) {
        const createdAt: Record<string, Date> = {};
        if (dateFrom) createdAt.$gte = new Date(dateFrom);
        if (dateTo) createdAt.$lte = new Date(dateTo);
        filter.createdAt = createdAt;
      }

      const [posts, total] = await Promise.all([
        ForumPost.find(filter)
          .sort({ [sortBy]: sortOrder })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ForumPost.countDocuments(filter),
      ]);

      const pagination = {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        pageSize: limit,
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      };

      res.json(listResponse(posts, pagination, undefined, getRequestId(req)));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed forum posts list', {
        ...auditInfo,
        filters: { search, topicSlug, discussionSlug, authorCharacterId, moderationLabel, includeDeleted },
        currentPage: page,
        totalResults: total,
      });
    } catch (error: unknown) {
      logger.error('Error fetching forum posts:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile recuperare i post',
        'FETCH_FORUM_POSTS_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * PUT /admin/forum-posts/:postId/pin
   * body: { pinned: boolean }. At most one pinned post per discussion -
   * pinning unpins whatever was pinned before, same as the character-facing
   * ForumController.pinPost.
   */
  static async pinPost(req: Request, res: Response): Promise<void> {
    try {
      const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
      const { pinned } = req.body;

      if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json({ success: false, error: 'ID post non valido', code: 'INVALID_POST_ID' });
        return;
      }

      const post = await ForumPost.findOne({ _id: postId, isDeleted: false });
      if (!post) {
        res.status(404).json({ success: false, error: 'Post non trovato', code: 'POST_NOT_FOUND' });
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);

      if (pinned === false) {
        await ForumPost.updateOne({ _id: post._id }, { $set: { isPinned: false }, $unset: { pinnedAt: '', pinnedByCharacterId: '' } });
        res.json(successResponse({ pinned: false }, 'Post rimosso dai fissati', getRequestId(req)));
        logger.info('Admin unpinned forum post', { ...auditInfo, postId });
        return;
      }

      const characterContext = auditInfo
        ? await resolveAdminCharacterSelectionContext(req, auditInfo.adminId)
        : undefined;

      await ForumPost.updateMany(
        { discussionId: post.discussionId, isPinned: true },
        { $set: { isPinned: false }, $unset: { pinnedAt: '', pinnedByCharacterId: '' } }
      );
      await ForumPost.updateOne({ _id: post._id }, {
        $set: {
          isPinned: true,
          pinnedAt: new Date(),
          ...(characterContext ? { pinnedByCharacterId: new mongoose.Types.ObjectId(characterContext.characterId) } : {}),
        }
      });

      res.json(successResponse({ pinned: true }, 'Post fissato con successo', getRequestId(req)));
      logger.info('Admin pinned forum post', { ...auditInfo, postId, discussionId: post.discussionId.toString() });
    } catch (error: unknown) {
      logger.error('Error pinning forum post:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile aggiornare il pin del post',
        'PIN_FORUM_POST_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * DELETE /admin/forum-posts/:postId - soft delete, symmetric with
   * ForumController.deletePost (recalculates discussion + topic denormalized
   * postCount/lastPost).
   */
  static async softDeletePost(req: Request, res: Response): Promise<void> {
    try {
      const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
      if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json({ success: false, error: 'ID post non valido', code: 'INVALID_POST_ID' });
        return;
      }

      const post = await ForumPost.findOne({ _id: postId, isDeleted: false });
      if (!post) {
        res.status(404).json({ success: false, error: 'Post non trovato', code: 'POST_NOT_FOUND' });
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      const characterContext = auditInfo
        ? await resolveAdminCharacterSelectionContext(req, auditInfo.adminId)
        : undefined;

      await ForumPost.findOneAndUpdate({ _id: post._id }, {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          ...(characterContext ? { deletedByCharacterId: new mongoose.Types.ObjectId(characterContext.characterId) } : {}),
        }
      });

      await ForumDiscussion.updateOne({ _id: post.discussionId }, { $inc: { postCount: -1 } });
      await ForumTopic.updateOne({ _id: post.topicId }, { $inc: { postCount: -1 } });
      await recalculateDiscussionLastPost(post.discussionId);
      await recalculateTopicLastPost(post.topicId);

      try {
        const { publishForumPostDeletedEvent } = await import('../../../shared/services/EmbeddingEventPublisher');
        await publishForumPostDeletedEvent(post._id.toString());
      } catch {
        // Non-blocking
      }

      res.json(deleteResponse('Post eliminato con successo', getRequestId(req)));
      logger.info('Admin soft-deleted forum post', { ...auditInfo, postId });
    } catch (error: unknown) {
      logger.error('Error deleting forum post:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile eliminare il post',
        'DELETE_FORUM_POST_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * POST /admin/forum-posts/:postId/restore
   */
  static async restorePost(req: Request, res: Response): Promise<void> {
    try {
      const postId = Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId;
      if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json({ success: false, error: 'ID post non valido', code: 'INVALID_POST_ID' });
        return;
      }

      const post = await ForumPost.findOne({ _id: postId, isDeleted: true });
      if (!post) {
        res.status(404).json({ success: false, error: 'Post eliminato non trovato', code: 'POST_NOT_FOUND' });
        return;
      }

      await ForumPost.findOneAndUpdate({ _id: post._id }, {
        $set: { isDeleted: false },
        $unset: { deletedAt: '', deletedByCharacterId: '' }
      });

      await ForumDiscussion.updateOne({ _id: post.discussionId }, { $inc: { postCount: 1 } });
      await ForumTopic.updateOne({ _id: post.topicId }, { $inc: { postCount: 1 } });
      await recalculateDiscussionLastPost(post.discussionId);
      await recalculateTopicLastPost(post.topicId);

      try {
        const { publishForumPostEvent } = await import('../../../shared/services/EmbeddingEventPublisher');
        await publishForumPostEvent('created', {
          _id: post._id.toString(),
          content: post.content,
          topicSlug: post.topicSlug,
          discussionSlug: post.discussionSlug,
          authorCharacterId: post.author.characterId.toString(),
          authorCharacterName: post.author.characterName
        });
      } catch {
        // Non-blocking
      }

      res.json(successResponse({ restored: true }, 'Post ripristinato con successo', getRequestId(req)));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin restored forum post', { ...auditInfo, postId });
    } catch (error: unknown) {
      logger.error('Error restoring forum post:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile ripristinare il post',
        'RESTORE_FORUM_POST_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }
}
