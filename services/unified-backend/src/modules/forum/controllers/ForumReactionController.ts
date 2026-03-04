import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ForumReaction, ReactionType, ForumPost } from '@database/models';
import { NotificationService } from '../services/NotificationService';
import { successResponse, errorResponse } from '../utils/apiResponse';

/**
 * ForumReactionController
 * Handles post reactions (like, love, laugh, think)
 * Each character can only have ONE reaction per post
 */

export class ForumReactionController {
  /**
   * POST /forum/posts/:postId/reactions
   * Add or update reaction to a post
   * Body: { reactionType: 'like' | 'love' | 'laugh' | 'think' }
   * Behavior: Same reaction = toggle off, different reaction = update
   */
  static async create(req: Request<{ postId: string }>, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const { reactionType } = req.body;
      const characterId = (req as any).character?._id;
      const characterName = (req as any).character?.name;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      // Validate reactionType
      if (!reactionType || !['like', 'love', 'laugh', 'think'].includes(reactionType)) {
        res.status(400).json(errorResponse('Invalid reactionType (must be: like, love, laugh, think)', 'INVALID_REACTION_TYPE'));
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json(errorResponse('Invalid post ID', 'INVALID_POST_ID'));
        return;
      }

      const postObjectId = new mongoose.Types.ObjectId(postId);

      // Check if post exists
      const post = await ForumPost.findById(postObjectId);
      if (!post) {
        res.status(404).json(errorResponse('Post not found', 'POST_NOT_FOUND'));
        return;
      }

      // Check if character already reacted
      const existingReaction = await ForumReaction.findOne({
        postId: postObjectId,
        characterId
      });

      if (existingReaction) {
        // If same reaction type = toggle off (remove)
        if (existingReaction.reactionType === reactionType) {
          await ForumReaction.deleteOne({ _id: existingReaction._id });

          // Decrement count atomically
          await ForumPost.findByIdAndUpdate(postObjectId, {
            $inc: { [`reactionCounts.${reactionType}`]: -1 }
          });

          const updatedPost = await ForumPost.findById(postObjectId);
          res.status(200).json(successResponse({
            reacted: false,
            reactionType: null,
            reactionCounts: updatedPost?.reactionCounts || { like: 0, love: 0, laugh: 0, think: 0 }
          }, 'Reaction removed'));
          return;
        }

        // Different reaction type = update
        const oldType = existingReaction.reactionType;

        // Update reaction type
        await ForumReaction.findByIdAndUpdate(existingReaction._id, {
          reactionType,
          createdAt: new Date() // Update timestamp
        });

        // Update counts atomically (decrement old, increment new)
        await ForumPost.findByIdAndUpdate(postObjectId, {
          $inc: {
            [`reactionCounts.${oldType}`]: -1,
            [`reactionCounts.${reactionType}`]: 1
          }
        });

        // Trigger notification
        await NotificationService.notifyReactionOnPost({
          postId: postObjectId,
          postAuthorCharacterId: new mongoose.Types.ObjectId(post.authorCharacterId),
          reactorCharacterId: characterId,
          reactorCharacterName: characterName || 'Unknown',
          reactionType
        });

        const updatedPost = await ForumPost.findById(postObjectId);
        res.status(200).json(successResponse({
          reacted: true,
          reactionType,
          reactionCounts: updatedPost?.reactionCounts || { like: 0, love: 0, laugh: 0, think: 0 }
        }, 'Reaction updated'));
        return;
      }

      // New reaction - create
      await ForumReaction.create({
        postId: postObjectId,
        characterId,
        reactionType,
        createdAt: new Date()
      });

      // Increment count atomically
      await ForumPost.findByIdAndUpdate(postObjectId, {
        $inc: { [`reactionCounts.${reactionType}`]: 1 }
      });

      // Trigger notification
      await NotificationService.notifyReactionOnPost({
        postId: postObjectId,
        postAuthorCharacterId: new mongoose.Types.ObjectId(post.authorCharacterId),
        reactorCharacterId: characterId,
        reactorCharacterName: characterName || 'Unknown',
        reactionType
      });

      const updatedPost = await ForumPost.findById(postObjectId);
      res.status(200).json(successResponse({
        reacted: true,
        reactionType,
        reactionCounts: updatedPost?.reactionCounts || { like: 0, love: 0, laugh: 0, think: 0 }
      }, 'Reaction added'));
    } catch (error: any) {
      console.error('[ForumReactionController] Create error:', error);
      res.status(500).json(errorResponse('Failed to add reaction', 'CREATE_REACTION_ERROR'));
    }
  }

  /**
   * DELETE /forum/posts/:postId/reactions
   * Remove reaction from a post
   */
  static async delete(req: Request<{ postId: string }>, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json(errorResponse('Invalid post ID', 'INVALID_POST_ID'));
        return;
      }

      const postObjectId = new mongoose.Types.ObjectId(postId);

      // Find and delete reaction
      const reaction = await ForumReaction.findOneAndDelete({
        postId: postObjectId,
        characterId
      });

      if (!reaction) {
        res.status(404).json(errorResponse('Reaction not found', 'REACTION_NOT_FOUND'));
        return;
      }

      // Decrement count atomically
      await ForumPost.findByIdAndUpdate(postObjectId, {
        $inc: { [`reactionCounts.${reaction.reactionType}`]: -1 }
      });

      const updatedPost = await ForumPost.findById(postObjectId);
      res.status(200).json(successResponse({
        reacted: false,
        reactionCounts: updatedPost?.reactionCounts || { like: 0, love: 0, laugh: 0, think: 0 }
      }, 'Reaction removed'));
    } catch (error: any) {
      console.error('[ForumReactionController] Delete error:', error);
      res.status(500).json(errorResponse('Failed to delete reaction', 'DELETE_REACTION_ERROR'));
    }
  }

  /**
   * GET /forum/posts/:postId/reactions
   * Get all reactions for a post (with character details)
   * Query: ?reactionType=like (optional filter)
   */
  static async list(req: Request<{ postId: string }>, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const { reactionType } = req.query;

      if (!mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json(errorResponse('Invalid post ID', 'INVALID_POST_ID'));
        return;
      }

      const postObjectId = new mongoose.Types.ObjectId(postId);

      // Build filter
      const filter: any = { postId: postObjectId };
      if (reactionType && ['like', 'love', 'laugh', 'think'].includes(reactionType as string)) {
        filter.reactionType = reactionType;
      }

      // Fetch reactions with character details
      const reactions = await ForumReaction.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: 'characters',
            localField: 'characterId',
            foreignField: '_id',
            as: 'character'
          }
        },
        { $unwind: '$character' },
        {
          $project: {
            characterId: '$character._id',
            characterName: '$character.name',
            characterSurname: '$character.surname',
            avatar: '$character.avatar',
            reactionType: 1,
            createdAt: 1
          }
        },
        { $sort: { createdAt: -1 } }
      ]);

      // Get counts from post
      const post = await ForumPost.findById(postObjectId);
      const counts = post?.reactionCounts || { like: 0, love: 0, laugh: 0, think: 0 };

      res.status(200).json(successResponse({
        reactions,
        counts
      }));
    } catch (error: any) {
      console.error('[ForumReactionController] List error:', error);
      res.status(500).json(errorResponse('Failed to fetch reactions', 'LIST_REACTIONS_ERROR'));
    }
  }

  /**
   * GET /forum/my-reactions
   * Get all reactions made by authenticated character
   */
  static async getMyReactions(req: Request, res: Response): Promise<void> {
    try {
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      // Fetch reactions with post details
      const reactions = await ForumReaction.aggregate([
        { $match: { characterId } },
        {
          $lookup: {
            from: 'forum_posts',
            localField: 'postId',
            foreignField: '_id',
            as: 'post'
          }
        },
        { $unwind: '$post' },
        {
          $project: {
            _id: 1,
            reactionType: 1,
            createdAt: 1,
            post: {
              _id: '$post._id',
              content: { $substr: ['$post.content', 0, 100] }, // First 100 chars
              topicSlug: '$post.topicSlug',
              discussionSlug: '$post.discussionSlug',
              authorUsername: '$post.authorUsername'
            }
          }
        },
        { $sort: { createdAt: -1 } }
      ]);

      res.status(200).json(successResponse({
        reactions,
        totalCount: reactions.length
      }));
    } catch (error: any) {
      console.error('[ForumReactionController] Get my reactions error:', error);
      res.status(500).json(errorResponse('Failed to fetch reactions', 'GET_MY_REACTIONS_ERROR'));
    }
  }

  /**
   * GET /forum/posts/:postId/reactions/check
   * Check if authenticated character reacted to a post
   */
  static async check(req: Request<{ postId: string }>, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json(errorResponse('Invalid post ID', 'INVALID_POST_ID'));
        return;
      }

      const postObjectId = new mongoose.Types.ObjectId(postId);

      // Check if reacted
      const reaction = await ForumReaction.findOne({
        postId: postObjectId,
        characterId
      });

      res.status(200).json(successResponse({
        reacted: !!reaction,
        reactionType: reaction?.reactionType || null
      }));
    } catch (error: any) {
      console.error('[ForumReactionController] Check error:', error);
      res.status(500).json(errorResponse('Failed to check reaction', 'CHECK_REACTION_ERROR'));
    }
  }
}
