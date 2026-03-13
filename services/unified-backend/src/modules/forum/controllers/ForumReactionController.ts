import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { successResponse, errorResponse, getRequestId } from '../utils/apiResponse';
import { ForumReaction } from '@database/models/ForumReaction';
import { ForumPost } from '@database/models/ForumPost';
import { NotificationService } from '../services/NotificationService';

const REACTION_TYPES = ['like', 'love', 'laugh', 'think'] as const;

export class ForumReactionController {
  static async create(req: Request<{ postId: string }>, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND', undefined, 401, getRequestId(req)));
        return;
      }

      const { postId } = req.params;
      const { reactionType } = req.body;

      if (!reactionType || !REACTION_TYPES.includes(reactionType)) {
        res.status(400).json(errorResponse('Invalid reactionType (must be: like, love, laugh, think)', 'INVALID_REACTION_TYPE', undefined, 400, getRequestId(req)));
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json(errorResponse('Invalid post ID', 'INVALID_POST_ID', undefined, 400, getRequestId(req)));
        return;
      }

      const characterId = new mongoose.Types.ObjectId(character.characterId);
      const postObjectId = new mongoose.Types.ObjectId(postId);

      const post = await ForumPost.findById(postObjectId);
      if (!post) {
        res.status(404).json(errorResponse('Post not found', 'POST_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      const existingReaction = await ForumReaction.findOne({
        postId: postObjectId,
        characterId
      });

      if (existingReaction) {
        if (existingReaction.reactionType === reactionType) {
          await ForumReaction.deleteOne({ _id: existingReaction._id });
          await ForumPost.findByIdAndUpdate(postObjectId, {
            $inc: { [`reactionCounts.${reactionType}`]: -1 }
          });
          const updatedPost = await ForumPost.findById(postObjectId);
          res.status(200).json(successResponse({
            reacted: false,
            reactionType: null,
            reactionCounts: updatedPost?.reactionCounts ?? { like: 0, love: 0, laugh: 0, think: 0 }
          }, 'Reaction removed', getRequestId(req)));
        } else {
          const oldType = existingReaction.reactionType;
          await ForumReaction.findByIdAndUpdate(existingReaction._id, {
            reactionType,
            createdAt: new Date()
          });
          await ForumPost.findByIdAndUpdate(postObjectId, {
            $inc: {
              [`reactionCounts.${oldType}`]: -1,
              [`reactionCounts.${reactionType}`]: 1
            }
          });
          const postAuthorId = new mongoose.Types.ObjectId(post.author.characterId);
          if (!postAuthorId.equals(characterId)) {
            await NotificationService.notifyReactionOnPost({
              postId: postObjectId,
              postAuthorCharacterId: postAuthorId,
              reactorCharacterId: characterId,
              reactorCharacterName: character.characterName,
              reactionType
            });
          }
          const updatedPost = await ForumPost.findById(postObjectId);
          res.status(200).json(successResponse({
            reacted: true,
            reactionType,
            reactionCounts: updatedPost?.reactionCounts ?? { like: 0, love: 0, laugh: 0, think: 0 }
          }, 'Reaction updated', getRequestId(req)));
        }
      } else {
        await ForumReaction.create({
          postId: postObjectId,
          characterId,
          reactionType,
          createdAt: new Date()
        });
        await ForumPost.findByIdAndUpdate(postObjectId, {
          $inc: { [`reactionCounts.${reactionType}`]: 1 }
        });
        const postAuthorId = new mongoose.Types.ObjectId(post.author.characterId);
        if (!postAuthorId.equals(characterId)) {
          await NotificationService.notifyReactionOnPost({
            postId: postObjectId,
            postAuthorCharacterId: postAuthorId,
            reactorCharacterId: characterId,
            reactorCharacterName: character.characterName,
            reactionType
          });
        }
        const updatedPost = await ForumPost.findById(postObjectId);
        res.status(201).json(successResponse({
          reacted: true,
          reactionType,
          reactionCounts: updatedPost?.reactionCounts ?? { like: 0, love: 0, laugh: 0, think: 0 }
        }, 'Reaction added', getRequestId(req)));
      }
    } catch (error: unknown) {
      console.error('[ForumReactionController] Create error:', error);
      res.status(500).json(errorResponse('Failed to toggle reaction', 'CREATE_REACTION_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  static async list(req: Request<{ postId: string }>, res: Response): Promise<void> {
    try {
      const { postId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json(errorResponse('Invalid post ID', 'INVALID_POST_ID', undefined, 400, getRequestId(req)));
        return;
      }

      const postObjectId = new mongoose.Types.ObjectId(postId);
      const characterId = req.character ? new mongoose.Types.ObjectId(req.character.characterId) : null;

      const reactions = await ForumReaction.aggregate([
        { $match: { postId: postObjectId } },
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

      const myReaction = characterId
        ? reactions.find(r => r.characterId && new mongoose.Types.ObjectId(r.characterId).equals(characterId))
        : null;

      const post = await ForumPost.findById(postObjectId);
      const counts = post?.reactionCounts ?? { like: 0, love: 0, laugh: 0, think: 0 };

      res.status(200).json(successResponse({
        reactions,
        counts,
        myReaction: myReaction ? { reactionType: myReaction.reactionType, characterId: myReaction.characterId } : null
      }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      console.error('[ForumReactionController] List error:', error);
      res.status(500).json(errorResponse('Failed to fetch reactions', 'LIST_REACTIONS_ERROR', undefined, 500, getRequestId(req)));
    }
  }
}
