import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ForumBookmark, BookmarkItemType } from '../models/ForumBookmark';
import { ForumDiscussion } from '../models/ForumDiscussion';
import { ForumPost } from '../models/ForumPost';
import { successResponse, errorResponse } from '../utils/apiResponse';

/**
 * ForumBookmarkController
 * Handles granular bookmarks for discussions and posts
 */

export class ForumBookmarkController {
  /**
   * POST /forum/bookmarks
   * Create a bookmark (discussion or post)
   * Body: { itemType: 'discussion' | 'post', itemId: ObjectId }
   */
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const { itemType, itemId } = req.body;
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      // Validate input
      if (!itemType || !['discussion', 'post'].includes(itemType)) {
        res.status(400).json(errorResponse('Invalid itemType (must be "discussion" or "post")', 'INVALID_ITEM_TYPE'));
        return;
      }

      if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
        res.status(400).json(errorResponse('Invalid itemId', 'INVALID_ITEM_ID'));
        return;
      }

      const objectId = new mongoose.Types.ObjectId(itemId);

      // Check if item exists and get denormalized fields
      let topicSlug: string | undefined;
      let discussionSlug: string | undefined;

      if (itemType === 'discussion') {
        const discussion = await ForumDiscussion.findById(objectId);
        if (!discussion) {
          res.status(404).json(errorResponse('Discussion not found', 'DISCUSSION_NOT_FOUND'));
          return;
        }
        topicSlug = discussion.topicSlug;
        discussionSlug = discussion.slug;
      } else {
        const post = await ForumPost.findById(objectId);
        if (!post) {
          res.status(404).json(errorResponse('Post not found', 'POST_NOT_FOUND'));
          return;
        }
        topicSlug = post.topicSlug;
        discussionSlug = post.discussionSlug;
      }

      // Check if already bookmarked
      const existing = await ForumBookmark.findOne({
        characterId,
        itemType,
        itemId: objectId
      });

      if (existing) {
        res.status(400).json(errorResponse('Already bookmarked', 'ALREADY_BOOKMARKED'));
        return;
      }

      // Create bookmark
      await ForumBookmark.create({
        characterId,
        itemType,
        itemId: objectId,
        topicSlug,
        discussionSlug,
        createdAt: new Date()
      });

      res.status(200).json(successResponse({
        bookmarked: true
      }, 'Bookmark created'));
    } catch (error: any) {
      console.error('[ForumBookmarkController] Create error:', error);
      res.status(500).json(errorResponse('Failed to create bookmark', 'CREATE_BOOKMARK_ERROR'));
    }
  }

  /**
   * DELETE /forum/bookmarks/:bookmarkId
   * Delete a bookmark by ID
   */
  static async delete(req: Request<{ bookmarkId: string }>, res: Response): Promise<void> {
    try {
      const { bookmarkId } = req.params;
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(bookmarkId)) {
        res.status(400).json(errorResponse('Invalid bookmark ID', 'INVALID_BOOKMARK_ID'));
        return;
      }

      const objectId = new mongoose.Types.ObjectId(bookmarkId);

      // Delete bookmark (only if owned by character)
      const result = await ForumBookmark.deleteOne({
        _id: objectId,
        characterId
      });

      if (result.deletedCount === 0) {
        res.status(404).json(errorResponse('Bookmark not found', 'BOOKMARK_NOT_FOUND'));
        return;
      }

      res.status(200).json(successResponse({
        bookmarked: false
      }, 'Bookmark deleted'));
    } catch (error: any) {
      console.error('[ForumBookmarkController] Delete error:', error);
      res.status(500).json(errorResponse('Failed to delete bookmark', 'DELETE_BOOKMARK_ERROR'));
    }
  }

  /**
   * GET /forum/bookmarks
   * Get all bookmarks for authenticated character
   * Query: ?itemType=discussion (optional filter)
   */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      const characterId = (req as any).character?._id;
      const { itemType } = req.query;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      // Build filter
      const filter: any = { characterId };
      if (itemType && ['discussion', 'post'].includes(itemType as string)) {
        filter.itemType = itemType;
      }

      // Fetch bookmarks
      const bookmarks = await ForumBookmark.find(filter).sort({ createdAt: -1 }).lean();

      // Populate item details
      const discussionIds = bookmarks.filter(b => b.itemType === 'discussion').map(b => b.itemId);
      const postIds = bookmarks.filter(b => b.itemType === 'post').map(b => b.itemId);

      const [discussions, posts] = await Promise.all([
        ForumDiscussion.find({ _id: { $in: discussionIds } }).lean(),
        ForumPost.find({ _id: { $in: postIds } }).lean()
      ]);

      // Map item details
      const discussionMap = new Map(discussions.map(d => [d._id.toString(), d]));
      const postMap = new Map(posts.map(p => [p._id.toString(), p]));

      const result = bookmarks.map(bookmark => ({
        _id: bookmark._id,
        itemType: bookmark.itemType,
        itemId: bookmark.itemId,
        createdAt: bookmark.createdAt,
        discussion: bookmark.itemType === 'discussion' ? discussionMap.get(bookmark.itemId.toString()) : undefined,
        post: bookmark.itemType === 'post' ? postMap.get(bookmark.itemId.toString()) : undefined
      }));

      res.status(200).json(successResponse({
        bookmarks: result,
        totalCount: result.length
      }));
    } catch (error: any) {
      console.error('[ForumBookmarkController] List error:', error);
      res.status(500).json(errorResponse('Failed to fetch bookmarks', 'LIST_BOOKMARKS_ERROR'));
    }
  }

  /**
   * GET /forum/bookmarks/check
   * Check if an item is bookmarked
   * Query: ?itemType=discussion&itemId=123
   */
  static async check(req: Request, res: Response): Promise<void> {
    try {
      const { itemType, itemId } = req.query;
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      if (!itemType || !['discussion', 'post'].includes(itemType as string)) {
        res.status(400).json(errorResponse('Invalid itemType', 'INVALID_ITEM_TYPE'));
        return;
      }

      if (!itemId || !mongoose.Types.ObjectId.isValid(itemId as string)) {
        res.status(400).json(errorResponse('Invalid itemId', 'INVALID_ITEM_ID'));
        return;
      }

      const objectId = new mongoose.Types.ObjectId(itemId as string);

      // Check if bookmarked
      const bookmark = await ForumBookmark.findOne({
        characterId,
        itemType,
        itemId: objectId
      });

      res.status(200).json(successResponse({
        bookmarked: !!bookmark,
        bookmarkId: bookmark?._id
      }));
    } catch (error: any) {
      console.error('[ForumBookmarkController] Check error:', error);
      res.status(500).json(errorResponse('Failed to check bookmark', 'CHECK_BOOKMARK_ERROR'));
    }
  }

  /**
   * POST /forum/bookmarks/toggle
   * Toggle bookmark (add if not exists, remove if exists)
   * Body: { itemType: 'discussion' | 'post', itemId: ObjectId }
   */
  static async toggle(req: Request, res: Response): Promise<void> {
    try {
      const { itemType, itemId } = req.body;
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      // Validate input
      if (!itemType || !['discussion', 'post'].includes(itemType)) {
        res.status(400).json(errorResponse('Invalid itemType', 'INVALID_ITEM_TYPE'));
        return;
      }

      if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
        res.status(400).json(errorResponse('Invalid itemId', 'INVALID_ITEM_ID'));
        return;
      }

      const objectId = new mongoose.Types.ObjectId(itemId);

      // Check if already bookmarked
      const existing = await ForumBookmark.findOne({
        characterId,
        itemType,
        itemId: objectId
      });

      if (existing) {
        // Remove
        await ForumBookmark.deleteOne({ _id: existing._id });
        res.status(200).json(successResponse({
          bookmarked: false
        }, 'Bookmark removed'));
      } else {
        // Add - get denormalized fields
        let topicSlug: string | undefined;
        let discussionSlug: string | undefined;

        if (itemType === 'discussion') {
          const discussion = await ForumDiscussion.findById(objectId);
          if (!discussion) {
            res.status(404).json(errorResponse('Discussion not found', 'DISCUSSION_NOT_FOUND'));
            return;
          }
          topicSlug = discussion.topicSlug;
          discussionSlug = discussion.slug;
        } else {
          const post = await ForumPost.findById(objectId);
          if (!post) {
            res.status(404).json(errorResponse('Post not found', 'POST_NOT_FOUND'));
            return;
          }
          topicSlug = post.topicSlug;
          discussionSlug = post.discussionSlug;
        }

        await ForumBookmark.create({
          characterId,
          itemType,
          itemId: objectId,
          topicSlug,
          discussionSlug,
          createdAt: new Date()
        });

        res.status(200).json(successResponse({
          bookmarked: true
        }, 'Bookmark added'));
      }
    } catch (error: any) {
      console.error('[ForumBookmarkController] Toggle error:', error);
      res.status(500).json(errorResponse('Failed to toggle bookmark', 'TOGGLE_BOOKMARK_ERROR'));
    }
  }
}
