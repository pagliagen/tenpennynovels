import { Request, Response } from 'express';
import mongoose from 'mongoose';
import slugify from 'slugify';
import { ForumTopic } from '@database/models/ForumTopic';
import { ForumDiscussion } from '@database/models/ForumDiscussion';
import { ForumPost } from '@database/models/ForumPost';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { listResponse, successResponse, errorResponse, createResponse, updateResponse, deleteResponse, getRequestId } from '../utils/apiResponse';
import { escapeRegex } from '@shared/utils/validation';

function createSlug(title: string): string {
  return slugify(title, { lower: true, strict: true, locale: 'it' });
}

export class ForumTopicManagementController {

  /**
   * GET /admin/forum-topics
   */
  static async getTopics(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 25;
      const search = req.query.search as string;
      const sortBy = (req.query.sortBy as string) || 'sortOrder';
      const sortOrder = (req.query.sortOrder as string) === 'desc' ? -1 : 1;
      const isVisible = req.query.isVisible as string;
      const isLocked = req.query.isLocked as string;

      const filter: Record<string, unknown> = {};
      if (search) {
        const escapedSearch = escapeRegex(search as string);
        filter.$or = [
          { title: { $regex: escapedSearch, $options: 'i' } },
          { description: { $regex: escapedSearch, $options: 'i' } },
          { slug: { $regex: escapedSearch, $options: 'i' } },
        ];
      }
      if (isVisible === 'true' || isVisible === 'false') filter.isVisible = isVisible === 'true';
      if (isLocked === 'true' || isLocked === 'false') filter.isLocked = isLocked === 'true';

      const [topics, total] = await Promise.all([
        ForumTopic.find(filter)
          .sort({ [sortBy]: sortOrder })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ForumTopic.countDocuments(filter),
      ]);

      const pagination = {
        page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        pageSize: limit,
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      };

      res.json(listResponse(
        topics.map(t => ({
          _id: t._id,
          slug: t.slug,
          title: t.title,
          description: t.description,
          sortOrder: t.sortOrder,
          accessRules: t.accessRules,
          isVisible: t.isVisible,
          isLocked: t.isLocked,
          isPinned: t.isPinned,
          discussionCount: t.discussionCount,
          postCount: t.postCount,
          lastPostAt: t.lastPostAt,
          lastPostBy: t.lastPostBy,
          createdAt: t.createdAt,
          createdBy: t.createdBy,
          color: t.color,
          icon: t.icon,
          moderatorIds: t.moderatorIds,
        })),
        pagination,
        undefined,
        getRequestId(req),
      ));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed forum topics list', {
        ...auditInfo,
        filters: { search, isVisible, isLocked },
        page,
        pageSize: limit,
        totalResults: total,
      });
    } catch (error: unknown) {
      logger.error('Error fetching forum topics:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile recuperare gli argomenti del forum',
        'FETCH_FORUM_TOPICS_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * GET /admin/forum-topics/:topicId
   */
  static async getTopicDetails(req: Request, res: Response): Promise<void> {
    try {
      const topicId = Array.isArray(req.params.topicId) ? req.params.topicId[0] : req.params.topicId;

      if (!topicId || !mongoose.Types.ObjectId.isValid(topicId)) {
        res.status(400).json(errorResponse('ID argomento non valido', 'INVALID_TOPIC_ID', undefined, 400, getRequestId(req)));
        return;
      }

      const topic = await ForumTopic.findById(topicId).lean();
      if (!topic) {
        res.status(404).json(errorResponse('Argomento non trovato', 'TOPIC_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      res.json(successResponse(topic, undefined, getRequestId(req)));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed forum topic details', { ...auditInfo, topicId });
    } catch (error: unknown) {
      logger.error('Error fetching forum topic details:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile recuperare i dettagli dell\'argomento',
        'FETCH_FORUM_TOPIC_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * POST /admin/forum-topics
   */
  static async createTopic(req: Request, res: Response): Promise<void> {
    try {
      const { title, description, sortOrder, accessRules, isVisible, isLocked, isPinned, color, icon, moderatorIds } = req.body;

      if (!title || title.trim().length < 3) {
        res.status(400).json(errorResponse('Il titolo deve avere almeno 3 caratteri', 'VALIDATION_ERROR', undefined, 400, getRequestId(req)));
        return;
      }

      const slug = createSlug(title);
      const existing = await ForumTopic.findOne({ slug });
      if (existing) {
        res.status(409).json(errorResponse('Esiste già un argomento con questo titolo', 'DUPLICATE_TOPIC', undefined, 409, getRequestId(req)));
        return;
      }

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);

      const topic = await ForumTopic.create({
        slug,
        title: title.trim(),
        description: description?.trim(),
        sortOrder: sortOrder ?? 0,
        accessRules: Array.isArray(accessRules) && accessRules.length > 0 ? accessRules : [{ type: 'public' }],
        isVisible: isVisible ?? true,
        isLocked: isLocked ?? false,
        isPinned: isPinned ?? false,
        color,
        icon,
        moderatorIds: Array.isArray(moderatorIds) ? moderatorIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id)) : [],
        discussionCount: 0,
        postCount: 0,
        createdAt: new Date(),
        createdBy: {
          characterId: new mongoose.Types.ObjectId(auditInfo?.adminId || 'system'),
          characterName: auditInfo?.adminCharacterName || auditInfo?.adminUsername || 'Admin',
        },
      });

      res.status(201).json(createResponse(
        {
          _id: topic._id,
          slug: topic.slug,
          title: topic.title,
        },
        'Argomento creato con successo',
        getRequestId(req),
      ));

      logger.info('Admin created forum topic', { ...auditInfo, topicId: topic._id, slug: topic.slug });
    } catch (error: unknown) {
      logger.error('Error creating forum topic:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile creare l\'argomento',
        'CREATE_FORUM_TOPIC_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * PUT /admin/forum-topics/:topicId
   */
  static async updateTopic(req: Request, res: Response): Promise<void> {
    try {
      const topicId = Array.isArray(req.params.topicId) ? req.params.topicId[0] : req.params.topicId;
      const { title, description, sortOrder, accessRules, isVisible, isLocked, isPinned, color, icon, moderatorIds } = req.body;

      if (!topicId || !mongoose.Types.ObjectId.isValid(topicId)) {
        res.status(400).json(errorResponse('ID argomento non valido', 'INVALID_TOPIC_ID', undefined, 400, getRequestId(req)));
        return;
      }

      const topic = await ForumTopic.findById(topicId);
      if (!topic) {
        res.status(404).json(errorResponse('Argomento non trovato', 'TOPIC_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      const update: Record<string, unknown> = {};
      if (title !== undefined) {
        const trimmedTitle = title.trim();
        if (trimmedTitle.length < 3) {
          res.status(400).json(errorResponse('Il titolo deve avere almeno 3 caratteri', 'VALIDATION_ERROR', undefined, 400, getRequestId(req)));
          return;
        }
        update.title = trimmedTitle;
        const newSlug = createSlug(trimmedTitle);
        if (newSlug !== topic.slug) {
          const slugExists = await ForumTopic.findOne({ slug: newSlug, _id: { $ne: topic._id } });
          if (slugExists) {
            res.status(409).json(errorResponse('Esiste già un argomento con questo titolo', 'DUPLICATE_SLUG', undefined, 409, getRequestId(req)));
            return;
          }
          update.slug = newSlug;
        }
      }
      if (description !== undefined) update.description = description?.trim();
      if (sortOrder !== undefined) update.sortOrder = sortOrder;
      if (accessRules !== undefined) update.accessRules = accessRules;
      if (isVisible !== undefined) update.isVisible = isVisible;
      if (isLocked !== undefined) update.isLocked = isLocked;
      if (isPinned !== undefined) update.isPinned = isPinned;
      if (color !== undefined) update.color = color;
      if (icon !== undefined) update.icon = icon;
      if (moderatorIds !== undefined) {
        update.moderatorIds = Array.isArray(moderatorIds)
          ? moderatorIds.filter((id: string) => mongoose.Types.ObjectId.isValid(id))
          : [];
      }

      const updated = await ForumTopic.findByIdAndUpdate(topicId, { $set: update }, { new: true }).lean();

      if (!updated) {
        res.status(404).json(errorResponse('Argomento non trovato dopo aggiornamento', 'TOPIC_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      res.json(updateResponse(
        {
          _id: updated._id,
          slug: updated.slug,
          title: updated.title,
        },
        'Argomento aggiornato con successo',
        getRequestId(req),
      ));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin updated forum topic', { ...auditInfo, topicId, changes: Object.keys(update) });
    } catch (error: unknown) {
      logger.error('Error updating forum topic:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile aggiornare l\'argomento',
        'UPDATE_FORUM_TOPIC_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }

  /**
   * DELETE /admin/forum-topics/:topicId
   */
  static async deleteTopic(req: Request, res: Response): Promise<void> {
    try {
      const topicId = Array.isArray(req.params.topicId) ? req.params.topicId[0] : req.params.topicId;

      if (!topicId || !mongoose.Types.ObjectId.isValid(topicId)) {
        res.status(400).json(errorResponse('ID argomento non valido', 'INVALID_TOPIC_ID', undefined, 400, getRequestId(req)));
        return;
      }

      const topic = await ForumTopic.findById(topicId);
      if (!topic) {
        res.status(404).json(errorResponse('Argomento non trovato', 'TOPIC_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      const [posts, discussions] = await Promise.all([
        ForumPost.find({ topicId: topic._id }).select('_id').lean(),
        ForumDiscussion.find({ topicId: topic._id }).select('_id').lean(),
      ]);

      try {
        const { publishForumPostDeletedEvent } = await import('../../../shared/services/EmbeddingEventPublisher');
        await Promise.allSettled(posts.map(p => publishForumPostDeletedEvent(p._id.toString())));
      } catch {
        // Non-blocking
      }

      await Promise.all([
        ForumPost.deleteMany({ topicId: topic._id }),
        ForumDiscussion.deleteMany({ topicId: topic._id }),
        ForumTopic.deleteOne({ _id: topic._id }),
      ]);

      res.json(deleteResponse('Argomento e tutto il contenuto associato eliminati con successo', getRequestId(req)));

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin deleted forum topic', {
        ...auditInfo,
        topicId,
        slug: topic.slug,
        deletedDiscussions: discussions.length,
        deletedPosts: posts.length,
      });
    } catch (error: unknown) {
      logger.error('Error deleting forum topic:', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(errorResponse(
        'Impossibile eliminare l\'argomento',
        'DELETE_FORUM_TOPIC_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }
}
