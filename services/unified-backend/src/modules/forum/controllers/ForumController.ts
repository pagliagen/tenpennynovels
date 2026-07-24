import { Request, Response } from 'express';
import mongoose from 'mongoose';
import slugify from 'slugify';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '@shared/utils/apiResponse';

import { ForumTopic, type IForumTopic } from '@database/models/ForumTopic';
import { ForumCategory } from '@database/models/ForumCategory';
import { ForumDiscussion, type DiscussionVisibilityType } from '@database/models/ForumDiscussion';
import { ForumPost } from '@database/models/ForumPost';
import { ForumTopicFavorite } from '@database/models/ForumTopicFavorite';
import { ForumNotification } from '@database/models/ForumNotification';
import { Character } from '@database/models/Character';
import { escapeRegex } from '@shared/utils/validation';
import { EmbeddingService } from '@modules/documents/services/EmbeddingService';
import { logger } from '@shared/utils/logger';
import { AdminPermissions, hasAdminPermission, type AdminPermission } from '@config/permissions/admin';
import {
  canAccessTopic,
  matchesDiscussionVisibility,
  buildDiscussionVisibilityFilter,
  evaluateDiscussionVisibility,
  evaluateTopicPermissions,
  type ForumCharacterContext
} from '../services/ForumAccessService';
import { serializePostAuthor } from '../services/ForumSerializer';

const EDIT_WINDOW_MS = 15 * 60 * 1000;

const createSlug = (title: string): string => {
  return slugify(title, { lower: true, strict: true, locale: 'it', trim: true }).slice(0, 100);
};

/**
 * Checks moderation/admin access for the forum ('forum.manage' by default).
 * Uses hasAdminPermission (role-derived + explicit grant/deny), NOT a raw
 * string lookup in req.user.adminPermissions: the previous implementation
 * only matched explicit grants and silently ignored role-derived permissions
 * (e.g. a 'master' whose FORUM_MANAGE comes from AdminRolePermissions, not an
 * explicit per-user grant, would incorrectly fail this check).
 */
const hasPermission = (req: Request, permission: AdminPermission = AdminPermissions.FORUM_MANAGE): boolean => {
  const user = req.user;
  if (!user) return false;
  return hasAdminPermission(
    user.gameplayRoles ?? [],
    user.adminPermissions ?? [],
    user.isGestore ?? false,
    permission
  );
};

/** Builds the character context object consumed by ForumAccessService from req.character. */
function toCharCtx(character: Request['character']): ForumCharacterContext | undefined {
  if (!character) return undefined;
  return {
    characterId: character.characterId,
    gameplayRoles: character.gameplayRoles,
    isGestore: character.isGestore,
    isApproved: character.isApproved
  };
}

const DISCUSSION_VISIBILITY_TYPES: DiscussionVisibilityType[] = ['public', 'staff', 'corporation', 'characterList', 'private'];

/** Parses/validates a discussion visibility payload from a request body. */
function parseVisibilityInput(input: unknown): { visibility?: Record<string, unknown>; error?: string } {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object') return { error: 'Visibilità non valida' };

  const { type, corporationId, characterIds } = input as Record<string, unknown>;
  if (typeof type !== 'string' || !DISCUSSION_VISIBILITY_TYPES.includes(type as DiscussionVisibilityType)) {
    return { error: 'Tipo di visibilità non valido' };
  }

  if (type === 'corporation') {
    if (typeof corporationId !== 'string' || !mongoose.Types.ObjectId.isValid(corporationId)) {
      return { error: 'corporationId richiesto per il tipo corporation' };
    }
    return { visibility: { type, corporationId: new mongoose.Types.ObjectId(corporationId) } };
  }

  if (type === 'characterList') {
    const ids = Array.isArray(characterIds)
      ? characterIds.filter((id): id is string => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id))
      : [];
    if (ids.length === 0) {
      return { error: 'characterIds richiesto per il tipo characterList' };
    }
    return { visibility: { type, characterIds: ids.map((id) => new mongoose.Types.ObjectId(id)) } };
  }

  return { visibility: { type } };
}

function characterRef(req: Request) {
  const c = req.character;
  if (!c) return null;
  return {
    characterId: new mongoose.Types.ObjectId(c.characterId),
    characterName: c.characterName
  };
}

/**
 * Recompute a discussion's denormalized lastPostAt/lastPostBy from its
 * non-deleted posts. Call after soft-deleting or restoring a post.
 */
async function recalculateDiscussionLastPost(discussionId: mongoose.Types.ObjectId): Promise<void> {
  const latest = await ForumPost.findOne({ discussionId, isDeleted: false })
    .sort({ createdAt: -1 })
    .select('createdAt author')
    .lean();

  if (latest) {
    await ForumDiscussion.updateOne({ _id: discussionId }, {
      $set: { lastPostAt: latest.createdAt, lastPostBy: latest.author }
    });
  } else {
    await ForumDiscussion.updateOne({ _id: discussionId }, {
      $unset: { lastPostAt: '', lastPostBy: '' }
    });
  }
}

/**
 * Recompute a topic's denormalized lastPostAt/lastPostBy from its
 * non-deleted, visible discussions. Call after soft-deleting or restoring
 * a discussion (or a post whose parent discussion's lastPost may have changed).
 */
async function recalculateTopicLastPost(topicId: mongoose.Types.ObjectId): Promise<void> {
  const latest = await ForumDiscussion.findOne({ topicId, isDeleted: false, isVisible: true })
    .sort({ lastPostAt: -1 })
    .select('lastPostAt lastPostBy')
    .lean();

  if (latest) {
    await ForumTopic.updateOne({ _id: topicId }, {
      $set: { lastPostAt: latest.lastPostAt, lastPostBy: latest.lastPostBy }
    });
  } else {
    await ForumTopic.updateOne({ _id: topicId }, {
      $unset: { lastPostAt: '', lastPostBy: '' }
    });
  }
}

export class ForumController {

  static async getForumInit(req: Request, res: Response) {
    try {
      const totalDiscussions = await ForumDiscussion.countDocuments({ isVisible: true });
      const totalPosts = await ForumPost.countDocuments({ isDeleted: false });

      const character = req.character;
      const authContext = {
        isAuthenticated: !!character,
        character: character ? {
          characterId: character.characterId,
          characterName: character.characterName,
          gameplayRoles: character.gameplayRoles || []
        } : null
      };

      res.json(successResponse({ totalDiscussions, totalPosts, authContext }, undefined, getRequestId(req)));
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile recuperare le statistiche del forum', code: 'GET_FORUM_INIT_ERROR' });
    }
  }

  // ========== CATEGORIES (read-only, CRUD via /admin/forum-categories) ==========

  static async getCategories(req: Request, res: Response) {
    try {
      const categories = await ForumCategory.find({ isVisible: true })
        .sort({ sortOrder: 1 })
        .lean();

      res.json(successResponse(categories.map(c => ({
        id: c._id,
        slug: c.slug,
        title: c.title,
        description: c.description,
        sortOrder: c.sortOrder,
        color: c.color,
        icon: c.icon
      })), undefined, getRequestId(req)));
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile recuperare le categorie', code: 'GET_CATEGORIES_ERROR' });
    }
  }

  // ========== TOPICS ==========

  static async getTopics(req: Request, res: Response) {
    try {
      const topics = await ForumTopic.find({ isVisible: true })
        .sort({ sortOrder: 1, isPinned: -1, lastPostAt: -1 })
        .lean();

      const character = req.character;
      const accessible: typeof topics = [];
      for (const topic of topics) {
        if (await canAccessTopic(topic as IForumTopic, toCharCtx(character))) {
          accessible.push(topic);
        }
      }

      res.json(successResponse(accessible.map(t => ({
        id: t._id,
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
        categoryId: t.categoryId,
        categorySlug: t.categorySlug,
        mode: t.mode
      })), undefined, getRequestId(req)));
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile recuperare i topic', code: 'GET_TOPICS_ERROR' });
    }
  }

  static async getTopic(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const topic = await ForumTopic.findOne({ slug, isVisible: true });
      if (!topic) {
        return res.status(404).json({ success: false, error: 'Topic non trovato', code: 'TOPIC_NOT_FOUND' });
      }

      const character = req.character;
      if (!(await evaluateTopicPermissions(topic, toCharCtx(character))).view) {
        return res.status(403).json({ success: false, error: 'Accesso negato', code: 'ACCESS_DENIED' });
      }

      res.json(successResponse({
        id: topic._id, slug: topic.slug, title: topic.title, description: topic.description,
        sortOrder: topic.sortOrder, accessRules: topic.accessRules,
        isVisible: topic.isVisible, isLocked: topic.isLocked, isPinned: topic.isPinned,
        discussionCount: topic.discussionCount, postCount: topic.postCount,
        lastPostAt: topic.lastPostAt, lastPostBy: topic.lastPostBy,
        createdAt: topic.createdAt, createdBy: topic.createdBy,
        color: topic.color, icon: topic.icon, moderatorIds: topic.moderatorIds,
        categoryId: topic.categoryId, categorySlug: topic.categorySlug,
        mode: topic.mode
      }, undefined, getRequestId(req)));
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile recuperare il topic', code: 'GET_TOPIC_ERROR' });
    }
  }

  // ========== DISCUSSIONS ==========

  static async getDiscussions(req: Request, res: Response) {
    try {
      const { topicSlug } = req.params;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const topic = await ForumTopic.findOne({ slug: topicSlug, isVisible: true });
      if (!topic) {
        return res.status(404).json({ success: false, error: 'Topic non trovato', code: 'TOPIC_NOT_FOUND' });
      }

      const character = req.character;
      const charCtx = toCharCtx(character);
      if (!(await canAccessTopic(topic, charCtx))) {
        return res.status(403).json({ success: false, error: 'Accesso negato', code: 'ACCESS_DENIED' });
      }

      const visibilityFilter = await buildDiscussionVisibilityFilter(charCtx);
      const filter = { topicSlug, isVisible: true, isDeleted: false, ...visibilityFilter };
      const [discussions, total] = await Promise.all([
        ForumDiscussion.find(filter).sort({ isPinned: -1, lastPostAt: -1 }).skip(skip).limit(limit).lean(),
        ForumDiscussion.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(total / limit);
      res.json(listResponse(discussions.map(d => ({
        id: d._id, slug: d.slug, topicSlug: d.topicSlug, title: d.title,
        isPinned: d.isPinned, isLocked: d.isLocked, postCount: d.postCount,
        viewCount: d.viewCount, subscriberCount: d.subscriberCount,
        lastPostAt: d.lastPostAt, lastPostBy: d.lastPostBy,
        createdAt: d.createdAt, createdBy: d.createdBy, tags: d.tags || [],
        visibility: d.visibility, excludedCharacterIds: d.excludedCharacterIds
      })), { currentPage: page, pageSize: limit, totalItems: total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 }, undefined, getRequestId(req)));
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile recuperare le discussioni', code: 'GET_DISCUSSIONS_ERROR' });
    }
  }

  static async getDiscussion(req: Request, res: Response) {
    try {
      const { topicSlug, discussionSlug } = req.params;

      const topic = await ForumTopic.findOne({ slug: topicSlug, isVisible: true });
      if (!topic) {
        return res.status(404).json({ success: false, error: 'Topic non trovato', code: 'TOPIC_NOT_FOUND' });
      }

      const character = req.character;
      const charCtx = toCharCtx(character);
      if (!(await evaluateTopicPermissions(topic, charCtx)).view) {
        return res.status(403).json({ success: false, error: 'Accesso negato', code: 'ACCESS_DENIED' });
      }

      const discussion = await ForumDiscussion.findOne({ topicSlug, slug: discussionSlug, isVisible: true, isDeleted: false });
      if (!discussion) {
        return res.status(404).json({ success: false, error: 'Discussione non trovata', code: 'DISCUSSION_NOT_FOUND' });
      }

      if (!(await matchesDiscussionVisibility(discussion, charCtx))) {
        return res.status(403).json({ success: false, error: 'Accesso negato', code: 'ACCESS_DENIED' });
      }

      await ForumDiscussion.updateOne({ _id: discussion._id }, { $inc: { viewCount: 1 } });

      res.json(successResponse({
        id: discussion._id, slug: discussion.slug, topicSlug: discussion.topicSlug,
        topicId: discussion.topicId, title: discussion.title,
        isPinned: discussion.isPinned, isLocked: discussion.isLocked,
        postCount: discussion.postCount, viewCount: (discussion.viewCount || 0) + 1,
        subscriberCount: discussion.subscriberCount,
        lastPostAt: discussion.lastPostAt, lastPostBy: discussion.lastPostBy,
        createdAt: discussion.createdAt, createdBy: discussion.createdBy,
        tags: discussion.tags || [],
        visibility: discussion.visibility, excludedCharacterIds: discussion.excludedCharacterIds
      }, undefined, getRequestId(req)));
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile recuperare la discussione', code: 'GET_DISCUSSION_ERROR' });
    }
  }

  static async createDiscussion(req: Request, res: Response) {
    try {
      const { topicSlug } = req.params;
      const { title, content, tags, visibility: visibilityInput, isAnonymous } = req.body;
      const author = characterRef(req);
      if (!author) {
        return res.status(400).json({ success: false, error: 'Personaggio richiesto', code: 'CHARACTER_REQUIRED' });
      }

      const topic = await ForumTopic.findOne({ slug: topicSlug, isVisible: true });
      if (!topic) {
        return res.status(404).json({ success: false, error: 'Topic non trovato', code: 'TOPIC_NOT_FOUND' });
      }

      const permissions = await evaluateTopicPermissions(topic, toCharCtx(req.character));
      if (!permissions.openThread) {
        return res.status(403).json({ success: false, error: 'Non hai il permesso di aprire una discussione in questa bacheca', code: 'ACCESS_DENIED' });
      }

      if (topic.isLocked && !hasPermission(req, 'forum.manage')) {
        return res.status(403).json({ success: false, error: 'Il topic è bloccato', code: 'TOPIC_LOCKED' });
      }

      if (!title || !content || title.trim().length < 3 || content.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'Titolo e contenuto sono obbligatori', code: 'VALIDATION_ERROR' });
      }

      const { visibility, error: visibilityError } = parseVisibilityInput(visibilityInput);
      if (visibilityError) {
        return res.status(400).json({ success: false, error: visibilityError, code: 'VALIDATION_ERROR' });
      }

      const slug = createSlug(title);
      if (await ForumDiscussion.findOne({ topicSlug, slug })) {
        return res.status(409).json({ success: false, error: 'Esiste già una discussione con questo titolo', code: 'DUPLICATE_DISCUSSION' });
      }

      const now = new Date();
      const discussion = await ForumDiscussion.create({
        slug,
        topicId: topic._id,
        topicSlug,
        title: title.trim(),
        isPinned: false, isLocked: false, isVisible: true,
        postCount: 1, viewCount: 0, subscriberCount: 0,
        lastPostAt: now, lastPostBy: author,
        createdAt: now, createdBy: author,
        tags: Array.isArray(tags) ? tags.filter((t: string) => t?.trim()) : [],
        visibility
      });

      await ForumPost.create({
        topicId: topic._id, discussionId: discussion._id,
        topicSlug, discussionSlug: slug,
        content: content.trim(),
        author,
        createdAt: now, isEdited: false, isDeleted: false,
        isAnonymous: topic.mode === 'ON' && !!isAnonymous
      });

      await ForumTopic.updateOne({ _id: topic._id }, {
        $inc: { discussionCount: 1, postCount: 1 },
        $set: { lastPostAt: now, lastPostBy: author }
      });

      res.status(201).json(createResponse({ id: discussion._id, slug: discussion.slug }, undefined, getRequestId(req)));
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile creare la discussione', code: 'CREATE_DISCUSSION_ERROR' });
    }
  }

  static async updateDiscussion(req: Request, res: Response) {
    try {
      const { topicSlug, discussionSlug } = req.params;
      const { title, tags, isPinned, isLocked, isVisible } = req.body;
      const character = req.character;
      if (!character) {
        return res.status(400).json({ success: false, error: 'Personaggio richiesto', code: 'CHARACTER_REQUIRED' });
      }

      const discussion = await ForumDiscussion.findOne({ topicSlug, slug: discussionSlug, isDeleted: false });
      if (!discussion) {
        return res.status(404).json({ success: false, error: 'Discussione non trovata', code: 'DISCUSSION_NOT_FOUND' });
      }

      const isAuthor = discussion.createdBy.characterId.toString() === character.characterId;
      const isAdmin = hasPermission(req, 'forum.manage');
      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ success: false, error: 'Non autorizzato', code: 'ACCESS_DENIED' });
      }

      // Title edit window: 15 minutes for the author, always for staff. Applies
      // regardless of topic mode (spec ties this only to the title, unlike the
      // reply-content edit window which is ON-only).
      if (title !== undefined && isAuthor && !isAdmin) {
        const withinEditWindow = (Date.now() - discussion.createdAt.getTime()) < EDIT_WINDOW_MS;
        if (!withinEditWindow) {
          return res.status(403).json({ success: false, error: 'Tempo per la modifica del titolo scaduto (15 minuti)', code: 'EDIT_WINDOW_EXPIRED' });
        }
      }

      const update: Record<string, unknown> = {};
      if (title !== undefined && (isAuthor || isAdmin)) update.title = title.trim();
      if (tags !== undefined && (isAuthor || isAdmin)) update.tags = tags;
      if (isPinned !== undefined && isAdmin) update.isPinned = isPinned;
      if (isLocked !== undefined && isAdmin) update.isLocked = isLocked;
      if (isVisible !== undefined && isAdmin) update.isVisible = isVisible;

      await ForumDiscussion.updateOne({ _id: discussion._id }, { $set: update });
      res.json({ success: true, data: { updated: true } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile aggiornare la discussione', code: 'UPDATE_DISCUSSION_ERROR' });
    }
  }

  /**
   * Update a discussion's visibility (5-tier model). The `type` itself can be
   * set by the author (their own thread) or staff. `excludedCharacterIds` is
   * staff-only: per spec, excluding a specific character from an otherwise
   * visible thread ("anche se è staff") is a moderation action, not an
   * authoring right.
   */
  static async updateDiscussionVisibility(req: Request, res: Response) {
    try {
      const { topicSlug, discussionSlug } = req.params;
      const { visibility: visibilityInput, excludedCharacterIds } = req.body;
      const character = req.character;
      if (!character) {
        return res.status(400).json({ success: false, error: 'Personaggio richiesto', code: 'CHARACTER_REQUIRED' });
      }

      const discussion = await ForumDiscussion.findOne({ topicSlug, slug: discussionSlug, isDeleted: false });
      if (!discussion) {
        return res.status(404).json({ success: false, error: 'Discussione non trovata', code: 'DISCUSSION_NOT_FOUND' });
      }

      const isAuthor = discussion.createdBy.characterId.toString() === character.characterId;
      const isAdmin = hasPermission(req, 'forum.manage');
      if (!isAuthor && !isAdmin) {
        return res.status(403).json({ success: false, error: 'Non autorizzato', code: 'ACCESS_DENIED' });
      }

      const update: Record<string, unknown> = {};

      if (visibilityInput !== undefined) {
        const { visibility, error: visibilityError } = parseVisibilityInput(visibilityInput);
        if (visibilityError) {
          return res.status(400).json({ success: false, error: visibilityError, code: 'VALIDATION_ERROR' });
        }
        update.visibility = visibility;
      }

      if (excludedCharacterIds !== undefined) {
        if (!isAdmin) {
          return res.status(403).json({ success: false, error: 'Solo lo staff può escludere personaggi specifici', code: 'ACCESS_DENIED' });
        }
        update.excludedCharacterIds = Array.isArray(excludedCharacterIds)
          ? excludedCharacterIds
              .filter((id: unknown): id is string => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id))
              .map((id: string) => new mongoose.Types.ObjectId(id))
          : [];
      }

      if (Object.keys(update).length === 0) {
        return res.status(400).json({ success: false, error: 'Nessuna modifica specificata', code: 'VALIDATION_ERROR' });
      }

      await ForumDiscussion.updateOne({ _id: discussion._id }, { $set: update });
      res.json({ success: true, data: { updated: true } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile aggiornare la visibilità della discussione', code: 'UPDATE_VISIBILITY_ERROR' });
    }
  }

  /**
   * Broadcast a discussion link to every approved character ("segnalare").
   * Only available in OFF boards, staff-only. Delivered as an in-app forum
   * notification (not the postal MP system) - a deliberate simplification to
   * keep this self-contained; wiring it into the OffGame postal system is a
   * possible future enhancement if literal "posta" delivery is required.
   */
  static async broadcastDiscussion(req: Request, res: Response) {
    try {
      const { topicSlug, discussionSlug } = req.params;
      const character = req.character;
      if (!character) {
        return res.status(400).json({ success: false, error: 'Personaggio richiesto', code: 'CHARACTER_REQUIRED' });
      }

      if (!hasPermission(req, 'forum.manage')) {
        return res.status(403).json({ success: false, error: 'Non autorizzato', code: 'ACCESS_DENIED' });
      }

      const topic = await ForumTopic.findOne({ slug: topicSlug, isVisible: true });
      if (!topic) {
        return res.status(404).json({ success: false, error: 'Topic non trovato', code: 'TOPIC_NOT_FOUND' });
      }

      if (topic.mode !== 'OFF') {
        return res.status(403).json({
          success: false,
          error: 'La segnalazione è disponibile solo nelle bacheche OFF',
          code: 'BROADCAST_NOT_ALLOWED_ON_BOARD'
        });
      }

      const discussion = await ForumDiscussion.findOne({ topicSlug, slug: discussionSlug, isDeleted: false });
      if (!discussion) {
        return res.status(404).json({ success: false, error: 'Discussione non trovata', code: 'DISCUSSION_NOT_FOUND' });
      }

      const recipients = await Character.find({ playerStatus: 'approved' }).select('_id').lean();
      const now = new Date();
      const notifications = recipients
        .filter((r) => r._id.toString() !== character.characterId)
        .map((r) => ({
          characterId: r._id,
          type: 'staff_announcement' as const,
          title: `Annuncio: ${discussion.title}`,
          message: `${character.characterName} ha segnalato un thread nella bacheca "${topic.title}"`,
          relatedDiscussionId: discussion._id,
          topicSlug: discussion.topicSlug,
          discussionSlug: discussion.slug,
          triggeredByCharacterId: new mongoose.Types.ObjectId(character.characterId),
          triggeredByCharacterName: character.characterName,
          isRead: false,
          createdAt: now
        }));

      if (notifications.length > 0) {
        await ForumNotification.insertMany(notifications, { ordered: false });
      }

      res.json({ success: true, data: { broadcasted: true, recipientCount: notifications.length } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile inviare la segnalazione', code: 'BROADCAST_ERROR' });
    }
  }

  /**
   * Soft-delete a discussion: the discussion is hidden (isDeleted: true), its posts
   * are left untouched in their collection and become reachable again automatically
   * on restore. Only staff can restore (see restoreDiscussion), author or staff can delete.
   */
  static async deleteDiscussion(req: Request, res: Response) {
    try {
      const { topicSlug, discussionSlug } = req.params;
      const character = req.character;
      if (!character) {
        return res.status(400).json({ success: false, error: 'Personaggio richiesto', code: 'CHARACTER_REQUIRED' });
      }

      const discussion = await ForumDiscussion.findOne({ topicSlug, slug: discussionSlug, isDeleted: false });
      if (!discussion) {
        return res.status(404).json({ success: false, error: 'Discussione non trovata', code: 'DISCUSSION_NOT_FOUND' });
      }

      const isAuthor = discussion.createdBy.characterId.toString() === character.characterId;
      if (!isAuthor && !hasPermission(req, 'forum.manage')) {
        return res.status(403).json({ success: false, error: 'Non autorizzato', code: 'ACCESS_DENIED' });
      }

      const posts = await ForumPost.find({ discussionId: discussion._id, isDeleted: false }).select('_id').lean();
      const postCount = posts.length;

      try {
        const { publishForumPostDeletedEvent } = await import('../../../shared/services/EmbeddingEventPublisher');
        await Promise.allSettled(posts.map(p => publishForumPostDeletedEvent(p._id.toString())));
      } catch {
        // Non-blocking
      }

      const now = new Date();
      await ForumDiscussion.updateOne({ _id: discussion._id }, {
        $set: {
          isDeleted: true,
          deletedAt: now,
          deletedByCharacterId: new mongoose.Types.ObjectId(character.characterId)
        }
      });

      await ForumTopic.updateOne({ _id: discussion.topicId }, {
        $inc: { discussionCount: -1, postCount: -postCount }
      });
      await recalculateTopicLastPost(discussion.topicId);

      res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile eliminare la discussione', code: 'DELETE_DISCUSSION_ERROR' });
    }
  }

  /**
   * Restore a soft-deleted discussion. Staff-only (no author bypass): restoring
   * a removed thread is an administrative action, not an authoring right.
   */
  static async restoreDiscussion(req: Request, res: Response) {
    try {
      const { topicSlug, discussionSlug } = req.params;
      const character = req.character;
      if (!character) {
        return res.status(400).json({ success: false, error: 'Personaggio richiesto', code: 'CHARACTER_REQUIRED' });
      }

      if (!hasPermission(req, 'forum.manage')) {
        return res.status(403).json({ success: false, error: 'Non autorizzato', code: 'ACCESS_DENIED' });
      }

      const discussion = await ForumDiscussion.findOne({ topicSlug, slug: discussionSlug, isDeleted: true });
      if (!discussion) {
        return res.status(404).json({ success: false, error: 'Discussione eliminata non trovata', code: 'DISCUSSION_NOT_FOUND' });
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

      res.json({ success: true, data: { restored: true } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile ripristinare la discussione', code: 'RESTORE_DISCUSSION_ERROR' });
    }
  }

  // ========== POSTS ==========

  static async getPosts(req: Request, res: Response) {
    try {
      const { topicSlug, discussionSlug } = req.params;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      const topic = await ForumTopic.findOne({ slug: topicSlug, isVisible: true });
      if (!topic) {
        return res.status(404).json({ success: false, error: 'Topic non trovato', code: 'TOPIC_NOT_FOUND' });
      }

      const character = req.character;
      const charCtx = toCharCtx(character);
      if (!(await evaluateTopicPermissions(topic, charCtx)).view) {
        return res.status(403).json({ success: false, error: 'Accesso negato', code: 'ACCESS_DENIED' });
      }

      const discussion = await ForumDiscussion.findOne({ topicSlug, slug: discussionSlug, isVisible: true, isDeleted: false });
      if (!discussion) {
        return res.status(404).json({ success: false, error: 'Discussione non trovata', code: 'DISCUSSION_NOT_FOUND' });
      }

      if (!(await matchesDiscussionVisibility(discussion, charCtx))) {
        return res.status(403).json({ success: false, error: 'Accesso negato', code: 'ACCESS_DENIED' });
      }

      const filter = { discussionId: discussion._id };
      const [posts, total] = await Promise.all([
        ForumPost.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
        ForumPost.countDocuments(filter)
      ]);

      const viewerHasModerationAccess = hasPermission(req, 'forum.manage');
      const totalPages = Math.ceil(total / limit);
      res.json(listResponse(posts.map(p => {
        // Computed BEFORE masking: an anonymous post's author must still be able
        // to edit/delete their own post even though `author` is hidden from them
        // in the response below (they know it's theirs; other non-staff viewers don't).
        const isOwnPost = !!character && p.author.characterId.toString() === character.characterId;
        const serialized = serializePostAuthor(p, viewerHasModerationAccess || isOwnPost);
        return {
          id: p._id, topicSlug: p.topicSlug, discussionSlug: p.discussionSlug,
          content: p.isDeleted ? '' : p.content,
          author: serialized.author,
          isAnonymous: p.isAnonymous,
          isOwnPost,
          createdAt: p.createdAt, updatedAt: p.updatedAt,
          isEdited: p.isEdited, isDeleted: p.isDeleted,
          replyToPostId: p.replyToPostId
        };
      }), { currentPage: page, pageSize: limit, totalItems: total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 }, undefined, getRequestId(req)));
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile recuperare i post', code: 'GET_POSTS_ERROR' });
    }
  }

  static async createPost(req: Request, res: Response) {
    try {
      const { topicSlug, discussionSlug } = req.params;
      const { content, replyToPostId, isAnonymous } = req.body;
      const author = characterRef(req);
      if (!author) {
        return res.status(400).json({ success: false, error: 'Personaggio richiesto', code: 'CHARACTER_REQUIRED' });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'Il contenuto è obbligatorio', code: 'VALIDATION_ERROR' });
      }

      const topic = await ForumTopic.findOne({ slug: topicSlug, isVisible: true });
      if (!topic) {
        return res.status(404).json({ success: false, error: 'Topic non trovato', code: 'TOPIC_NOT_FOUND' });
      }

      const charCtx = toCharCtx(req.character);
      const permissions = await evaluateTopicPermissions(topic, charCtx);
      if (!permissions.reply) {
        return res.status(403).json({ success: false, error: 'Non hai il permesso di rispondere in questa bacheca', code: 'ACCESS_DENIED' });
      }

      const discussion = await ForumDiscussion.findOne({ topicSlug, slug: discussionSlug, isVisible: true, isDeleted: false });
      if (!discussion) {
        return res.status(404).json({ success: false, error: 'Discussione non trovata', code: 'DISCUSSION_NOT_FOUND' });
      }

      if (!(await matchesDiscussionVisibility(discussion, charCtx))) {
        return res.status(403).json({ success: false, error: 'Accesso negato', code: 'ACCESS_DENIED' });
      }

      if ((topic.isLocked || discussion.isLocked) && !hasPermission(req, 'forum.manage')) {
        return res.status(403).json({ success: false, error: 'La discussione è bloccata', code: 'DISCUSSION_LOCKED' });
      }

      const now = new Date();
      const post = await ForumPost.create({
        topicId: topic._id, discussionId: discussion._id,
        topicSlug, discussionSlug,
        content: content.trim(),
        author,
        createdAt: now, isEdited: false, isDeleted: false,
        replyToPostId: replyToPostId ? new mongoose.Types.ObjectId(replyToPostId) : undefined,
        // Anonymous posting is only an ON-board feature (spec: "possibilità di
        // postare in modo anonimo" is listed under BACHECA ON, absent from OFF).
        isAnonymous: topic.mode === 'ON' && !!isAnonymous
      });

      await ForumDiscussion.updateOne({ _id: discussion._id }, {
        $inc: { postCount: 1 },
        $set: { lastPostAt: now, lastPostBy: author }
      });

      await ForumTopic.updateOne({ _id: topic._id }, {
        $inc: { postCount: 1 },
        $set: { lastPostAt: now, lastPostBy: author }
      });

      res.status(201).json({ success: true, data: { id: post._id } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile creare il post', code: 'CREATE_POST_ERROR' });
    }
  }

  static async updatePost(req: Request, res: Response) {
    try {
      const postIdStr = (Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId) as string;
      const { content } = req.body;
      const character = req.character;
      if (!character) {
        return res.status(400).json({ success: false, error: 'Personaggio richiesto', code: 'CHARACTER_REQUIRED' });
      }

      if (!postIdStr || !mongoose.Types.ObjectId.isValid(postIdStr)) {
        return res.status(400).json({ success: false, error: 'ID post non valido', code: 'INVALID_ID' });
      }
      const post = await ForumPost.findById(new mongoose.Types.ObjectId(postIdStr));
      if (!post || post.isDeleted) {
        return res.status(404).json({ success: false, error: 'Post non trovato', code: 'POST_NOT_FOUND' });
      }

      if (post.author.characterId.toString() !== character.characterId) {
        return res.status(403).json({ success: false, error: 'Non autorizzato', code: 'ACCESS_DENIED' });
      }

      // Reply edit window: unlimited for the author in OFF boards, 15 minutes in
      // ON boards (spec: "possibilità di modificare una risposta entro 15 min",
      // listed only under BACHECA ON - OFF has no such limit).
      const topic = await ForumTopic.findById(post.topicId).select('mode').lean();
      const withinEditWindow = topic?.mode === 'OFF' || (Date.now() - post.createdAt.getTime()) < EDIT_WINDOW_MS;
      if (!withinEditWindow) {
        return res.status(403).json({ success: false, error: 'Tempo per la modifica scaduto (15 minuti)', code: 'EDIT_WINDOW_EXPIRED' });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'Il contenuto è obbligatorio', code: 'VALIDATION_ERROR' });
      }

      const now = new Date();
      await ForumPost.findOneAndUpdate({ _id: post._id }, {
        $set: {
          content: content.trim(),
          updatedAt: now,
          isEdited: true
        },
        $push: {
          editHistory: {
            editedAt: now,
            previousContent: post.content
          }
        }
      }, { new: true });

      res.json({ success: true, data: { updated: true } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile modificare il post', code: 'UPDATE_POST_ERROR' });
    }
  }

  static async deletePost(req: Request, res: Response) {
    try {
      const postIdStr = (Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId) as string;
      const character = req.character;
      if (!character) {
        return res.status(400).json({ success: false, error: 'Personaggio richiesto', code: 'CHARACTER_REQUIRED' });
      }

      if (!postIdStr || !mongoose.Types.ObjectId.isValid(postIdStr)) {
        return res.status(400).json({ success: false, error: 'ID post non valido', code: 'INVALID_ID' });
      }
      const post = await ForumPost.findById(new mongoose.Types.ObjectId(postIdStr));
      if (!post || post.isDeleted) {
        return res.status(404).json({ success: false, error: 'Post non trovato', code: 'POST_NOT_FOUND' });
      }

      const isAuthor = post.author.characterId.toString() === character.characterId;
      if (!isAuthor && !hasPermission(req, 'forum.manage')) {
        return res.status(403).json({ success: false, error: 'Non autorizzato', code: 'ACCESS_DENIED' });
      }

      const now = new Date();
      await ForumPost.findOneAndUpdate({ _id: post._id }, {
        $set: {
          isDeleted: true,
          deletedAt: now,
          deletedByCharacterId: new mongoose.Types.ObjectId(character.characterId)
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

      res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile eliminare il post', code: 'DELETE_POST_ERROR' });
    }
  }

  /**
   * Restore a soft-deleted post. Staff-only (no author bypass), symmetric to deletePost.
   */
  static async restorePost(req: Request, res: Response) {
    try {
      const postIdStr = (Array.isArray(req.params.postId) ? req.params.postId[0] : req.params.postId) as string;
      const character = req.character;
      if (!character) {
        return res.status(400).json({ success: false, error: 'Personaggio richiesto', code: 'CHARACTER_REQUIRED' });
      }

      if (!hasPermission(req, 'forum.manage')) {
        return res.status(403).json({ success: false, error: 'Non autorizzato', code: 'ACCESS_DENIED' });
      }

      if (!postIdStr || !mongoose.Types.ObjectId.isValid(postIdStr)) {
        return res.status(400).json({ success: false, error: 'ID post non valido', code: 'INVALID_ID' });
      }
      const post = await ForumPost.findOne({ _id: new mongoose.Types.ObjectId(postIdStr), isDeleted: true });
      if (!post) {
        return res.status(404).json({ success: false, error: 'Post eliminato non trovato', code: 'POST_NOT_FOUND' });
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

      res.json({ success: true, data: { restored: true } });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile ripristinare il post', code: 'RESTORE_POST_ERROR' });
    }
  }

  // ========== FAVORITES ==========

  static async getUserFavoriteTopics(req: Request, res: Response) {
    try {
      const character = req.character;
      if (!character) {
        return res.status(400).json({ success: false, error: 'Personaggio richiesto', code: 'CHARACTER_REQUIRED' });
      }

      const favorites = await ForumTopicFavorite.find({
        characterId: new mongoose.Types.ObjectId(character.characterId)
      }).lean();

      if (favorites.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const topicIds = favorites.map(f => f.topicId);
      const topics = await ForumTopic.find({ _id: { $in: topicIds }, isVisible: true }).lean();

      const accessible: typeof topics = [];
      for (const topic of topics) {
        if (await canAccessTopic(topic as IForumTopic, toCharCtx(character))) {
          accessible.push(topic);
        }
      }

      res.json(successResponse(accessible.map(t => ({
        id: t._id, slug: t.slug, title: t.title, description: t.description,
        postCount: t.postCount, discussionCount: t.discussionCount,
        lastPostAt: t.lastPostAt, color: t.color, icon: t.icon,
        isFavorite: true
      })), undefined, getRequestId(req)));
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile recuperare i preferiti', code: 'GET_FAVORITES_ERROR' });
    }
  }

  static async toggleTopicFavorite(req: Request, res: Response) {
    try {
      const { slug } = req.params;
      const character = req.character;
      if (!character) {
        return res.status(400).json({ success: false, error: 'Personaggio richiesto', code: 'CHARACTER_REQUIRED' });
      }

      const topic = await ForumTopic.findOne({ slug, isVisible: true });
      if (!topic) {
        return res.status(404).json({ success: false, error: 'Topic non trovato', code: 'TOPIC_NOT_FOUND' });
      }

      const charId = new mongoose.Types.ObjectId(character.characterId);
      const existing = await ForumTopicFavorite.findOne({ characterId: charId, topicId: topic._id });

      if (existing) {
        await ForumTopicFavorite.deleteOne({ _id: existing._id });
        res.json({ success: true, data: { isFavorite: false } });
      } else {
        await ForumTopicFavorite.create({ characterId: charId, topicId: topic._id });
        res.json({ success: true, data: { isFavorite: true } });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile aggiornare i preferiti', code: 'TOGGLE_FAVORITE_ERROR' });
    }
  }

  // ========== RECENT / POPULAR ==========

  static async getRecentDiscussions(req: Request, res: Response) {
    try {
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const character = req.character;

      const charCtx = toCharCtx(character);
      const topics = await ForumTopic.find({ isVisible: true }).lean();
      const accessibleSlugs: string[] = [];
      for (const t of topics) {
        if (await canAccessTopic(t as IForumTopic, charCtx)) {
          accessibleSlugs.push(t.slug);
        }
      }

      const visibilityFilter = await buildDiscussionVisibilityFilter(charCtx);
      const discussions = await ForumDiscussion.find({ topicSlug: { $in: accessibleSlugs }, isVisible: true, isDeleted: false, ...visibilityFilter })
        .sort({ lastPostAt: -1 }).limit(limit).lean();

      res.json(successResponse(discussions.map(d => ({
        id: d._id, slug: d.slug, topicSlug: d.topicSlug, title: d.title,
        postCount: d.postCount, viewCount: d.viewCount,
        lastPostAt: d.lastPostAt, lastPostBy: d.lastPostBy,
        createdAt: d.createdAt, createdBy: d.createdBy, tags: d.tags || []
      })), undefined, getRequestId(req)));
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile recuperare le discussioni recenti', code: 'GET_RECENT_ERROR' });
    }
  }

  static async getPopularDiscussions(req: Request, res: Response) {
    try {
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const timeframe = req.query.timeframe as string || 'week';
      const character = req.character;

      const now = new Date();
      let cutoffDate: Date;
      switch (timeframe) {
        case 'month': cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        case 'all': cutoffDate = new Date(0); break;
        default: cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      }

      const charCtx = toCharCtx(character);
      const topics = await ForumTopic.find({ isVisible: true }).lean();
      const accessibleSlugs: string[] = [];
      for (const t of topics) {
        if (await canAccessTopic(t as IForumTopic, charCtx)) {
          accessibleSlugs.push(t.slug);
        }
      }

      const visibilityFilter = await buildDiscussionVisibilityFilter(charCtx);
      const discussions = await ForumDiscussion.aggregate([
        { $match: { topicSlug: { $in: accessibleSlugs }, isVisible: true, isDeleted: false, createdAt: { $gte: cutoffDate }, ...visibilityFilter } },
        { $addFields: { popularityScore: { $add: [{ $ifNull: ['$viewCount', 0] }, { $multiply: [{ $ifNull: ['$postCount', 0] }, 3] }] } } },
        { $sort: { popularityScore: -1 } },
        { $limit: limit }
      ]);

      res.json(successResponse(discussions.map(d => ({
        id: d._id, slug: d.slug, topicSlug: d.topicSlug, title: d.title,
        postCount: d.postCount, viewCount: d.viewCount,
        lastPostAt: d.lastPostAt, createdAt: d.createdAt, tags: d.tags || [],
        popularityScore: d.popularityScore
      })), undefined, getRequestId(req)));
    } catch (error) {
      res.status(500).json({ success: false, error: 'Impossibile recuperare le discussioni popolari', code: 'GET_POPULAR_ERROR' });
    }
  }

  // ========== SEARCH (placeholder - will use EmbeddingService) ==========

  static async searchForum(req: Request, res: Response) {
    try {
      const { q: query, topicSlug, discussionSlug, authorCharacterId } = req.query;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'La query di ricerca è obbligatoria', code: 'MISSING_QUERY' });
      }

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const skip = (page - 1) * limit;

      let posts: any[] = [];
      let total = 0;
      let searchMethod = 'semantic';

      // Build filters object
      const filters: Record<string, any> = {};
      if (topicSlug && typeof topicSlug === 'string') filters.topicSlug = topicSlug;
      if (discussionSlug && typeof discussionSlug === 'string') filters.discussionSlug = discussionSlug;
      if (authorCharacterId && typeof authorCharacterId === 'string') filters.authorCharacterId = authorCharacterId;

      // Try semantic search first (with timeout)
      try {
        const semanticResults = await Promise.race([
          EmbeddingService.semanticSearch(query.trim(), undefined, limit * 3, 0.3, 'forum', filters),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);

        if (semanticResults && semanticResults.length > 0) {
          const forumPostIds = semanticResults
            .map((r: any) => r.postId)
            .slice(skip, skip + limit);

          if (forumPostIds.length > 0) {
            posts = await ForumPost.find({
              _id: { $in: forumPostIds },
              isDeleted: false
            }).lean();

            // Re-order by semantic score
            const scoreMap = new Map(semanticResults.map((r: any) => [r.postId, r.score]));
            posts.sort((a: any, b: any) => (scoreMap.get(b._id.toString()) || 0) - (scoreMap.get(a._id.toString()) || 0));

            total = posts.length;

            logger.info(`[ForumSearch] Semantic: ${posts.length} results for "${query}" with filters ${JSON.stringify(filters)}`);
          }
        }
      } catch (semanticError) {
        logger.warn('[ForumSearch] Semantic failed, fallback to regex:', semanticError);
        searchMethod = 'regex_fallback';
      }

      // Fallback to regex if semantic search failed or returned no results
      if (posts.length === 0) {
        // Posts aren't touched when their parent discussion is soft-deleted (they stay
        // isDeleted: false), so the regex path needs an explicit exclusion here. The
        // semantic path doesn't need this: deleted discussions already unpublish their
        // posts from the embedding index (see deleteDiscussion).
        const deletedDiscussionIds = await ForumDiscussion.find({ isDeleted: true }).distinct('_id');

        const filter: Record<string, unknown> = { isDeleted: false };
        if (deletedDiscussionIds.length > 0) filter.discussionId = { $nin: deletedDiscussionIds };
        if (topicSlug && typeof topicSlug === 'string') filter.topicSlug = topicSlug;
        if (discussionSlug && typeof discussionSlug === 'string') filter.discussionSlug = discussionSlug;
        if (authorCharacterId && typeof authorCharacterId === 'string') {
          filter['author.characterId'] = authorCharacterId;
        }

        const escapedQuery = escapeRegex(query.trim());

        posts = await ForumPost.find({
          ...filter,
          content: { $regex: escapedQuery, $options: 'i' }
        }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

        total = await ForumPost.countDocuments({
          ...filter,
          content: { $regex: escapedQuery, $options: 'i' }
        });

        searchMethod = 'regex';
        logger.info(`[ForumSearch] Regex: ${posts.length} results for "${query}" with filters ${JSON.stringify(filters)}`);
      }

      // Safety net: neither the semantic index nor the regex path above are aware of
      // per-discussion visibility (staff/corporation/characterList/private, exclusion
      // lists) - only of soft-deletion. Without this, search could surface posts from
      // a restricted or private thread to a character who couldn't otherwise see it.
      // This re-checks each result's parent discussion+topic before returning it, at
      // the cost of `total`/pagination becoming approximate for restricted content.
      if (posts.length > 0) {
        const charCtx = toCharCtx(req.character);
        const discussionIds = [...new Set(posts.map((p) => p.discussionId.toString()))];
        const [relevantDiscussions, relevantTopics] = await Promise.all([
          ForumDiscussion.find({ _id: { $in: discussionIds } }).lean(),
          ForumTopic.find({ topicSlug: { $in: [...new Set(posts.map((p) => p.topicSlug))] } }).lean()
        ]);
        const discussionById = new Map(relevantDiscussions.map((d) => [d._id.toString(), d]));
        const topicBySlug = new Map(relevantTopics.map((t) => [t.slug, t]));

        const visiblePosts = [];
        for (const p of posts) {
          const discussion = discussionById.get(p.discussionId.toString());
          const topic = discussion ? topicBySlug.get(discussion.topicSlug) : undefined;
          if (discussion && topic && await evaluateDiscussionVisibility(discussion, topic as IForumTopic, charCtx)) {
            visiblePosts.push(p);
          }
        }
        posts = visiblePosts;
        total = posts.length;
      }

      const searchViewerHasModerationAccess = hasPermission(req, 'forum.manage');
      const totalPages = Math.ceil(total / limit);
      const response = {
        ...listResponse(
          posts.map(p => {
            const serialized = serializePostAuthor(p, searchViewerHasModerationAccess);
            return {
              id: p._id,
              topicSlug: p.topicSlug,
              discussionSlug: p.discussionSlug,
              content: p.content,
              author: serialized.author,
              createdAt: p.createdAt
            };
          }),
          {
            currentPage: page,
            pageSize: limit,
            totalItems: total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
          },
          undefined,
          getRequestId(req)
        ),
        searchMethod,
      };

      res.json(response);
    } catch (error) {
      logger.error('[ForumSearch] Error:', error);
      res.status(500).json({ success: false, error: 'Impossibile effettuare la ricerca', code: 'SEARCH_ERROR' });
    }
  }
}
