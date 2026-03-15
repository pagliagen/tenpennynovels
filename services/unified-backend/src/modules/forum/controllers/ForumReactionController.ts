import { Request, Response } from 'express';
import mongoose from 'mongoose';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '../utils/apiResponse';

import { ForumReaction } from '@database/models/ForumReaction';
import { ForumPost } from '@database/models/ForumPost';
import { NotificationService } from '../services/NotificationService';
import { logger } from '../logger';

const REACTION_TYPES = ['like', 'love', 'laugh', 'think'] as const;

export class ForumReactionController {
  static async create(req: Request<{ postId: string }>, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json({ success: false, error: 'Personaggio non trovato', code: 'CHARACTER_NOT_FOUND' });
        return;
      }

      const { postId } = req.params;
      const { reactionType } = req.body;

      if (!reactionType || !REACTION_TYPES.includes(reactionType)) {
        res.status(400).json({ success: false, error: 'Tipo di reazione non valido (deve essere: like, love, laugh, think)', code: 'INVALID_REACTION_TYPE' });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json({ success: false, error: 'ID post non valido', code: 'INVALID_POST_ID' });
        return;
      }

      const characterId = new mongoose.Types.ObjectId(character.characterId);
      const postObjectId = new mongoose.Types.ObjectId(postId);

      const post = await ForumPost.findById(postObjectId);
      if (!post) {
        res.status(404).json({ success: false, error: 'Post non trovato', code: 'POST_NOT_FOUND' });
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
          }, 'Reazione rimossa', getRequestId(req)));
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
          }, 'Reazione aggiornata', getRequestId(req)));
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
        }, 'Reazione aggiunta', getRequestId(req)));
      }
    } catch (error: unknown) {
      logger.error('[ForumReactionController] Create error:', error);
      res.status(500).json({ success: false, error: 'Impossibile attivare/disattivare la reazione', code: 'CREATE_REACTION_ERROR' });
    }
  }

  static async list(req: Request<{ postId: string }>, res: Response): Promise<void> {
    try {
      const { postId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(postId)) {
        res.status(400).json({ success: false, error: 'ID post non valido', code: 'INVALID_POST_ID' });
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
      logger.error('[ForumReactionController] List error:', error);
      res.status(500).json({ success: false, error: 'Impossibile recuperare le reazioni', code: 'LIST_REACTIONS_ERROR' });
    }
  }
}
