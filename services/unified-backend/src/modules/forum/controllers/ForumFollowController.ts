import { Request, Response } from 'express';
import mongoose from 'mongoose';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { successResponse, errorResponse, listResponse, createResponse, updateResponse, getRequestId } from '@shared/utils/apiResponse';

import { ForumCharacterFollow } from '@database/models/ForumCharacterFollow';
import { NotificationService } from '../services/NotificationService';
import { logger } from '../logger';

export class ForumFollowController {
  static async follow(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json({ success: false, error: 'Personaggio non trovato', code: 'CHARACTER_NOT_FOUND' });
        return;
      }

      const { characterId: targetCharacterId } = req.params;
      const followerId = new mongoose.Types.ObjectId(character.characterId);
      const followedId = new mongoose.Types.ObjectId(targetCharacterId);

      if (followerId.equals(followedId)) {
        res.status(400).json({ success: false, error: 'Non puoi seguire te stesso', code: 'CANNOT_FOLLOW_SELF' });
        return;
      }

      const existing = await ForumCharacterFollow.findOne({
        followerId,
        followedId
      });

      if (existing) {
        await ForumCharacterFollow.deleteOne({ _id: existing._id });
        res.status(200).json(successResponse({
          following: false
        }, 'Personaggio smesso di seguire', getRequestId(req)));
      } else {
        await ForumCharacterFollow.create({
          followerId,
          followedId,
          createdAt: new Date()
        });
        await NotificationService.notifyCharacterFollowed({
          followedCharacterId: followedId,
          followerCharacterId: followerId,
          followerCharacterName: character.characterName
        });
        res.status(201).json(createResponse({
          following: true
        }, 'Ora segui questo personaggio', getRequestId(req)));
      }
    } catch (error: unknown) {
      logger.error('[ForumFollowController] Follow error:', error);
      res.status(500).json({ success: false, error: 'Impossibile attivare/disattivare il follow', code: 'FOLLOW_ERROR' });
    }
  }

  static async getMyFollows(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json({ success: false, error: 'Personaggio non trovato', code: 'CHARACTER_NOT_FOUND' });
        return;
      }

      const characterId = new mongoose.Types.ObjectId(character.characterId);

      const [followers, following] = await Promise.all([
        ForumCharacterFollow.aggregate([
          { $match: { followedId: characterId } },
          {
            $lookup: {
              from: 'characters',
              localField: 'followerId',
              foreignField: '_id',
              as: 'follower'
            }
          },
          { $unwind: '$follower' },
          {
            $project: {
              characterId: '$follower._id',
              name: '$follower.name',
              surname: '$follower.surname',
              avatar: '$follower.avatar',
              followedAt: '$createdAt'
            }
          },
          { $sort: { followedAt: -1 } }
        ]),
        ForumCharacterFollow.aggregate([
          { $match: { followerId: characterId } },
          {
            $lookup: {
              from: 'characters',
              localField: 'followedId',
              foreignField: '_id',
              as: 'followed'
            }
          },
          { $unwind: '$followed' },
          {
            $project: {
              characterId: '$followed._id',
              name: '$followed.name',
              surname: '$followed.surname',
              avatar: '$followed.avatar',
              followedAt: '$createdAt'
            }
          },
          { $sort: { followedAt: -1 } }
        ])
      ]);

      res.status(200).json(successResponse({
        followers,
        following,
        followerCount: followers.length,
        followingCount: following.length
      }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('[ForumFollowController] Get my follows error:', error);
      res.status(500).json({ success: false, error: 'Impossibile recuperare i follow', code: 'GET_MY_FOLLOWS_ERROR' });
    }
  }

  static async getFollowing(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json({ success: false, error: 'Personaggio non trovato', code: 'CHARACTER_NOT_FOUND' });
        return;
      }

      const followerId = new mongoose.Types.ObjectId(character.characterId);

      const following = await ForumCharacterFollow.aggregate([
        { $match: { followerId } },
        {
          $lookup: {
            from: 'characters',
            localField: 'followedId',
            foreignField: '_id',
            as: 'followed'
          }
        },
        { $unwind: '$followed' },
        {
          $project: {
            characterId: '$followed._id',
            name: '$followed.name',
            surname: '$followed.surname',
            avatar: '$followed.avatar',
            followedAt: '$createdAt'
          }
        },
        { $sort: { followedAt: -1 } }
      ]);

      res.status(200).json(successResponse({
        following,
        count: following.length
      }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('[ForumFollowController] Get following error:', error);
      res.status(500).json({ success: false, error: 'Impossibile recuperare i seguiti', code: 'GET_FOLLOWING_ERROR' });
    }
  }

  static async getFollowers(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json({ success: false, error: 'Personaggio non trovato', code: 'CHARACTER_NOT_FOUND' });
        return;
      }

      const followedId = new mongoose.Types.ObjectId(character.characterId);

      const followers = await ForumCharacterFollow.aggregate([
        { $match: { followedId } },
        {
          $lookup: {
            from: 'characters',
            localField: 'followerId',
            foreignField: '_id',
            as: 'follower'
          }
        },
        { $unwind: '$follower' },
        {
          $project: {
            characterId: '$follower._id',
            name: '$follower.name',
            surname: '$follower.surname',
            avatar: '$follower.avatar',
            followedAt: '$createdAt'
          }
        },
        { $sort: { followedAt: -1 } }
      ]);

      res.status(200).json(successResponse({
        followers,
        count: followers.length
      }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('[ForumFollowController] Get followers error:', error);
      res.status(500).json({ success: false, error: 'Impossibile recuperare i follower', code: 'GET_FOLLOWERS_ERROR' });
    }
  }
}
