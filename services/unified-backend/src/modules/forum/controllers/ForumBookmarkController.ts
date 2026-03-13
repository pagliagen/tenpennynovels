import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { successResponse, errorResponse, createResponse, getRequestId } from '../utils/apiResponse';
import { ForumBookmark } from '@database/models/ForumBookmark';
import { ForumPost } from '@database/models/ForumPost';
import { ForumDiscussion } from '@database/models/ForumDiscussion';

export class ForumBookmarkController {
  static async toggleBookmark(req: Request<{ postId: string }>, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND', undefined, 401, getRequestId(req)));
        return;
      }

      const { postId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json(errorResponse('Invalid post ID', 'INVALID_POST_ID', undefined, 400, getRequestId(req)));
        return;
      }

      const characterId = new mongoose.Types.ObjectId(character.characterId);
      const itemId = new mongoose.Types.ObjectId(postId);

      const post = await ForumPost.findById(itemId);
      if (!post) {
        res.status(404).json(errorResponse('Post not found', 'POST_NOT_FOUND', undefined, 404, getRequestId(req)));
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
        }, 'Bookmark removed', getRequestId(req)));
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
        }, 'Bookmark added', getRequestId(req)));
      }
    } catch (error: unknown) {
      console.error('[ForumBookmarkController] Toggle bookmark error:', error);
      res.status(500).json(errorResponse('Failed to toggle bookmark', 'TOGGLE_BOOKMARK_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  static async getBookmarks(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND', undefined, 401, getRequestId(req)));
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
      console.error('[ForumBookmarkController] Get bookmarks error:', error);
      res.status(500).json(errorResponse('Failed to fetch bookmarks', 'GET_BOOKMARKS_ERROR', undefined, 500, getRequestId(req)));
    }
  }
}
