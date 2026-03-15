import { Request, Response } from 'express';
import mongoose from 'mongoose';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '../utils/apiResponse';

import { ForumBookmark } from '@database/models/ForumBookmark';
import { ForumPost } from '@database/models/ForumPost';
import { ForumDiscussion } from '@database/models/ForumDiscussion';
import { logger } from '../logger';

export class ForumBookmarkController {
  static async toggleBookmark(req: Request<{ postId: string }>, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json({ success: false, error: 'Personaggio non trovato', code: 'CHARACTER_NOT_FOUND' });
        return;
      }

      const { postId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json({ success: false, error: 'ID post non valido', code: 'INVALID_POST_ID' });
        return;
      }

      const characterId = new mongoose.Types.ObjectId(character.characterId);
      const itemId = new mongoose.Types.ObjectId(postId);

      const post = await ForumPost.findById(itemId);
      if (!post) {
        res.status(404).json({ success: false, error: 'Post non trovato', code: 'POST_NOT_FOUND' });
        return;
      }

      const existing = await ForumBookmark.findOne({
        characterId,
        itemType: 'post',
        itemId
      });

      if (existing) {
        await ForumBookmark.deleteOne({ _id: existing._id });
        res.status(200).json(successResponse({
          bookmarked: false
        }, 'Segnalibro rimosso', getRequestId(req)));
      } else {
        await ForumBookmark.create({
          characterId,
          itemType: 'post',
          itemId,
          topicSlug: post.topicSlug,
          discussionSlug: post.discussionSlug,
          createdAt: new Date()
        });
        res.status(201).json(createResponse({
          bookmarked: true
        }, 'Segnalibro aggiunto', getRequestId(req)));
      }
    } catch (error: unknown) {
      logger.error('[ForumBookmarkController] Toggle bookmark error:', error);
      res.status(500).json({ success: false, error: 'Impossibile attivare/disattivare il segnalibro', code: 'TOGGLE_BOOKMARK_ERROR' });
    }
  }

  static async getBookmarks(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json({ success: false, error: 'Personaggio non trovato', code: 'CHARACTER_NOT_FOUND' });
        return;
      }

      const { itemType } = req.query;
      const characterId = new mongoose.Types.ObjectId(character.characterId);

      const filter: Record<string, unknown> = { characterId };
      if (itemType && (itemType === 'discussion' || itemType === 'post')) {
        filter.itemType = itemType;
      }

      const bookmarks = await ForumBookmark.find(filter).sort({ createdAt: -1 }).lean();

      const discussionIds = bookmarks.filter(b => b.itemType === 'discussion').map(b => b.itemId);
      const postIds = bookmarks.filter(b => b.itemType === 'post').map(b => b.itemId);

      const [discussions, posts] = await Promise.all([
        ForumDiscussion.find({ _id: { $in: discussionIds } }).lean(),
        ForumPost.find({ _id: { $in: postIds } }).lean()
      ]);

      const discussionMap = new Map(discussions.map(d => [d._id.toString(), d]));
      const postMap = new Map(posts.map(p => [p._id.toString(), p]));

      const items = bookmarks.map(bookmark => ({
        _id: bookmark._id,
        itemType: bookmark.itemType,
        itemId: bookmark.itemId,
        topicSlug: bookmark.topicSlug,
        discussionSlug: bookmark.discussionSlug,
        createdAt: bookmark.createdAt,
        discussion: bookmark.itemType === 'discussion' ? discussionMap.get(bookmark.itemId.toString()) : undefined,
        post: bookmark.itemType === 'post' ? postMap.get(bookmark.itemId.toString()) : undefined
      }));

      res.status(200).json(successResponse({
        bookmarks: items,
        totalCount: items.length
      }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('[ForumBookmarkController] Get bookmarks error:', error);
      res.status(500).json({ success: false, error: 'Impossibile recuperare i segnalibri', code: 'GET_BOOKMARKS_ERROR' });
    }
  }
}
