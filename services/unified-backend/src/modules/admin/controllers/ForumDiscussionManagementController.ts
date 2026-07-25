import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ForumDiscussion } from '@database/models/ForumDiscussion';
import { ForumTopic } from '@database/models/ForumTopic';
import { ForumPost } from '@database/models/ForumPost';
import { recalculateTopicLastPost } from '../../forum/controllers/ForumController';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { resolveAdminCharacterSelectionContext } from '../utils/permissions';
import { logger } from '../utils/logger';
import { successResponse, errorResponse, listResponse, updateResponse, deleteResponse, getRequestId } from '@shared/utils/apiResponse';
import { escapeRegex } from '@shared/utils/validation';

/**
 * Admin-only manual moderation for ForumDiscussion (pin/lock/move/soft-delete/
 * restore) - distinct from the AI toxicity alert queue (ForumModerationPage /
 * ModerationAlert) and from the character-facing forum routes in
 * modules/forum/routes/forum.ts, which require req.character. Attribution
 * here uses the admin's User id (AdminAuthMiddleware.getAuditInfo), with the
 * admin's currently-selected character (if any) recorded on deletedByCharacterId
 * when available - that field is optional precisely for this admin-only path.
 */
export class ForumDiscussionManagementController {

  /**
   * GET /admin/forum-discussions
   */
  static async getDiscussions(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      const search = req.query.search as string;
      const topicSlug = req.query.topicSlug as string;
      const isLocked = req.query.isLocked as string;
      const isPinned = req.query.isPinned as string;
      const includeDeleted = req.query.includeDeleted === 'true';
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const sortBy = (req.query.sortBy as string) || 'lastPostAt';
      const sortOrder = (req.query.sortOrder as string) === 'asc' ? 1 : -1;

      const filter: Record<string, unknown> = {};
      if (!includeDeleted) filter.isDeleted = false;
      if (topicSlug) filter.topicSlug = topicSlug;
      if (search) {
        const escapedSearch = escapeRegex(search);
        filter.title = { $regex: escapedSearch, $options: 'i' };
      }
      if (isLocked === 'true' || isLocked === 'false') filter.isLocked = isLocked === 'true';
      if (isPinned === 'true' || isPinned === 'false') filter.isPinned = isPinned === 'true';
      if (dateFrom || dateTo) {
        const createdAt: Record<string, Date> = {};
        if (dateFrom) createdAt.$gte = new Date(dateFrom);
        if (dateTo) createdAt.$lte = new Date(dateTo);
        filter.createdAt = createdAt;
      }

      const [discussions, total] = await Promise.all([
        ForumDiscussion.find(filter)
          .sort({ [sortBy]: sortOrder })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ForumDiscussion.countDocuments(filter),
      ]);

      const pagination = {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        pageSize: limit,
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      };

      res.json(listResponse(discussions, pagination, undefined, getRequestId(req)));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed forum discussions list', {
        ...auditInfo,
        filters: { search, topicSlug, isLocked, isPinned, includeDeleted },
        currentPage: page,
        totalResults: total,
      });
    } catch (error: unknown) {
      logger.error('Error fetching forum discussions:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile recuperare le discussioni',
        'FETCH_FORUM_DISCUSSIONS_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * PUT /admin/forum-discussions/:discussionId
   * Supports pin/unpin, lock/unlock, and "move" (change parent topic).
   */
  static async updateDiscussion(req: Request, res: Response): Promise<void> {
    try {
      const discussionId = Array.isArray(req.params.discussionId) ? req.params.discussionId[0] : req.params.discussionId;
      const { isPinned, isLocked, topicId } = req.body;

      if (!discussionId || !mongoose.Types.ObjectId.isValid(discussionId)) {
        res.status(400).json({ success: false, error: 'ID discussione non valido', code: 'INVALID_DISCUSSION_ID' });
        return;
      }

      const discussion = await ForumDiscussion.findById(discussionId);
      if (!discussion) {
        res.status(404).json({ success: false, error: 'Discussione non trovata', code: 'DISCUSSION_NOT_FOUND' });
        return;
      }

      const update: Record<string, unknown> = {};
      if (isPinned !== undefined) update.isPinned = !!isPinned;
      if (isLocked !== undefined) update.isLocked = !!isLocked;

      const previousTopicId = discussion.topicId;
      let moved = false;

      if (topicId !== undefined && topicId !== null && String(topicId) !== previousTopicId.toString()) {
        if (!mongoose.Types.ObjectId.isValid(topicId)) {
          res.status(400).json({ success: false, error: 'ID argomento di destinazione non valido', code: 'INVALID_TARGET_TOPIC_ID' });
          return;
        }
        const targetTopic = await ForumTopic.findById(topicId).select('slug').lean();
        if (!targetTopic) {
          res.status(404).json({ success: false, error: 'Argomento di destinazione non trovato', code: 'TARGET_TOPIC_NOT_FOUND' });
          return;
        }
        update.topicId = targetTopic._id;
        update.topicSlug = targetTopic.slug;
        moved = true;
      }

      const updated = await ForumDiscussion.findByIdAndUpdate(discussionId, { $set: update }, { new: true }).lean();
      if (!updated) {
        res.status(404).json({ success: false, error: 'Discussione non trovata dopo aggiornamento', code: 'DISCUSSION_NOT_FOUND' });
        return;
      }

      if (moved) {
        const postCount = await ForumPost.countDocuments({ discussionId: discussion._id, isDeleted: false });
        // Move denormalized topicSlug/topicId onto every post too - they're read directly from
        // ForumPost in getPosts/searchForum, not joined from the parent discussion.
        await ForumPost.updateMany(
          { discussionId: discussion._id },
          { $set: { topicId: updated.topicId, topicSlug: updated.topicSlug } }
        );
        await Promise.all([
          ForumTopic.updateOne({ _id: previousTopicId }, { $inc: { discussionCount: -1, postCount: -postCount } }),
          ForumTopic.updateOne({ _id: updated.topicId }, { $inc: { discussionCount: 1, postCount } }),
        ]);
        await Promise.all([
          recalculateTopicLastPost(previousTopicId),
          recalculateTopicLastPost(updated.topicId),
        ]);
      }

      res.json(updateResponse(updated, 'Discussione aggiornata con successo', getRequestId(req)));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin updated forum discussion', { ...auditInfo, discussionId, changes: Object.keys(update), moved });
    } catch (error: unknown) {
      logger.error('Error updating forum discussion:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile aggiornare la discussione',
        'UPDATE_FORUM_DISCUSSION_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * DELETE /admin/forum-discussions/:discussionId - soft delete, symmetric
   * with ForumController.deleteDiscussion (same isDeleted/deletedAt fields,
   * same topic counter decrement + recalculateTopicLastPost).
   */
  static async softDeleteDiscussion(req: Request, res: Response): Promise<void> {
    try {
      const discussionId = Array.isArray(req.params.discussionId) ? req.params.discussionId[0] : req.params.discussionId;
      if (!discussionId || !mongoose.Types.ObjectId.isValid(discussionId)) {
        res.status(400).json({ success: false, error: 'ID discussione non valido', code: 'INVALID_DISCUSSION_ID' });
        return;
      }

      const discussion = await ForumDiscussion.findOne({ _id: discussionId, isDeleted: false });
      if (!discussion) {
        res.status(404).json({ success: false, error: 'Discussione non trovata', code: 'DISCUSSION_NOT_FOUND' });
        return;
      }

      const posts = await ForumPost.find({ discussionId: discussion._id, isDeleted: false }).select('_id').lean();
      const postCount = posts.length;

      try {
        const { publishForumPostDeletedEvent } = await import('../../../shared/services/EmbeddingEventPublisher');
        await Promise.allSettled(posts.map(p => publishForumPostDeletedEvent(p._id.toString())));
      } catch {
        // Non-blocking
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      const characterContext = auditInfo
        ? await resolveAdminCharacterSelectionContext(req, auditInfo.adminId)
        : undefined;

      await ForumDiscussion.updateOne({ _id: discussion._id }, {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          ...(characterContext ? { deletedByCharacterId: new mongoose.Types.ObjectId(characterContext.characterId) } : {}),
        }
      });

      await ForumTopic.updateOne({ _id: discussion.topicId }, {
        $inc: { discussionCount: -1, postCount: -postCount }
      });
      await recalculateTopicLastPost(discussion.topicId);

      res.json(deleteResponse('Discussione eliminata con successo', getRequestId(req)));

      logger.info('Admin soft-deleted forum discussion', { ...auditInfo, discussionId, deletedPosts: postCount });
    } catch (error: unknown) {
      logger.error('Error deleting forum discussion:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile eliminare la discussione',
        'DELETE_FORUM_DISCUSSION_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * POST /admin/forum-discussions/:discussionId/restore
   */
  static async restoreDiscussion(req: Request, res: Response): Promise<void> {
    try {
      const discussionId = Array.isArray(req.params.discussionId) ? req.params.discussionId[0] : req.params.discussionId;
      if (!discussionId || !mongoose.Types.ObjectId.isValid(discussionId)) {
        res.status(400).json({ success: false, error: 'ID discussione non valido', code: 'INVALID_DISCUSSION_ID' });
        return;
      }

      const discussion = await ForumDiscussion.findOne({ _id: discussionId, isDeleted: true });
      if (!discussion) {
        res.status(404).json({ success: false, error: 'Discussione eliminata non trovata', code: 'DISCUSSION_NOT_FOUND' });
        return;
      }

      await ForumDiscussion.updateOne({ _id: discussion._id }, {
        $set: { isDeleted: false },
        $unset: { deletedAt: '', deletedByCharacterId: '' }
      });

      const restoredPosts = await ForumPost.find({ discussionId: discussion._id, isDeleted: false }).lean();

      await ForumTopic.updateOne({ _id: discussion.topicId }, {
        $inc: { discussionCount: 1, postCount: restoredPosts.length }
      });
      await recalculateTopicLastPost(discussion.topicId);

      try {
        const { publishForumPostEvent } = await import('../../../shared/services/EmbeddingEventPublisher');
        await Promise.allSettled(restoredPosts.map(p => publishForumPostEvent('created', {
          _id: p._id.toString(),
          content: p.content,
          topicSlug: p.topicSlug,
          discussionSlug: p.discussionSlug,
          authorCharacterId: p.author.characterId.toString(),
          authorCharacterName: p.author.characterName
        })));
      } catch {
        // Non-blocking
      }

      res.json(successResponse({ restored: true }, 'Discussione ripristinata con successo', getRequestId(req)));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin restored forum discussion', { ...auditInfo, discussionId, restoredPosts: restoredPosts.length });
    } catch (error: unknown) {
      logger.error('Error restoring forum discussion:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile ripristinare la discussione',
        'RESTORE_FORUM_DISCUSSION_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }
}
