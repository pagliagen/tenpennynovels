import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ForumCharacterFollow } from '@database/models';
import { Character } from '@database/models/Character';
import { NotificationService } from '../services/NotificationService';
import { successResponse, errorResponse } from '../utils/apiResponse';

/**
 * ForumFollowController
 * Handles character-to-character follow functionality
 */

export class ForumFollowController {
  /**
   * POST /forum/characters/:characterId/follow
   * Follow a character
   */
  static async follow(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId: targetCharacterId } = req.params;
      const followerCharacterId = (req as any).character?._id;
      const followerCharacterName = (req as any).character?.name;

      if (!followerCharacterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      // Convert to ObjectId
      const targetId = new mongoose.Types.ObjectId(targetCharacterId);

      // Check if trying to follow self
      if (followerCharacterId.equals(targetId)) {
        res.status(400).json(errorResponse('Cannot follow yourself', 'CANNOT_FOLLOW_SELF'));
        return;
      }

      // Check if target character exists
      const targetCharacter = await Character.findById(targetId);
      if (!targetCharacter) {
        res.status(404).json(errorResponse('Character not found', 'TARGET_NOT_FOUND'));
        return;
      }

      // Check if already following
      const existing = await ForumCharacterFollow.findOne({
        followerId: followerCharacterId,
        followedId: targetId
      });

      if (existing) {
        res.status(400).json(errorResponse('Already following this character', 'ALREADY_FOLLOWING'));
        return;
      }

      // Create follow relationship
      await ForumCharacterFollow.create({
        followerId: followerCharacterId,
        followedId: targetId,
        createdAt: new Date()
      });

      // Update denormalized counts atomically
      await Promise.all([
        Character.findByIdAndUpdate(followerCharacterId, {
          $inc: { 'forumStats.followingCount': 1 }
        }),
        Character.findByIdAndUpdate(targetId, {
          $inc: { 'forumStats.followerCount': 1 }
        })
      ]);

      // Trigger notification
      await NotificationService.notifyCharacterFollowed({
        followedCharacterId: targetId,
        followerCharacterId: followerCharacterId,
        followerCharacterName: followerCharacterName || 'Unknown'
      });

      // Get updated count
      const updatedTarget = await Character.findById(targetId);
      const followerCount = updatedTarget?.forumStats?.followerCount || 1;

      res.status(200).json(successResponse({
        following: true,
        followerCount
      }, 'Now following character'));
    } catch (error: any) {
      console.error('[ForumFollowController] Follow error:', error);
      res.status(500).json(errorResponse('Failed to follow character', 'FOLLOW_ERROR'));
    }
  }

  /**
   * DELETE /forum/characters/:characterId/follow
   * Unfollow a character
   */
  static async unfollow(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId: targetCharacterId } = req.params;
      const followerCharacterId = (req as any).character?._id;

      if (!followerCharacterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      const targetId = new mongoose.Types.ObjectId(targetCharacterId);

      // Delete follow relationship
      const result = await ForumCharacterFollow.deleteOne({
        followerId: followerCharacterId,
        followedId: targetId
      });

      if (result.deletedCount === 0) {
        res.status(404).json(errorResponse('Not following this character', 'NOT_FOLLOWING'));
        return;
      }

      // Update denormalized counts atomically
      await Promise.all([
        Character.findByIdAndUpdate(followerCharacterId, {
          $inc: { 'forumStats.followingCount': -1 }
        }),
        Character.findByIdAndUpdate(targetId, {
          $inc: { 'forumStats.followerCount': -1 }
        })
      ]);

      // Get updated count
      const updatedTarget = await Character.findById(targetId);
      const followerCount = Math.max(0, updatedTarget?.forumStats?.followerCount || 0);

      res.status(200).json(successResponse({
        following: false,
        followerCount
      }, 'Unfollowed character'));
    } catch (error: any) {
      console.error('[ForumFollowController] Unfollow error:', error);
      res.status(500).json(errorResponse('Failed to unfollow character', 'UNFOLLOW_ERROR'));
    }
  }

  /**
   * GET /forum/characters/:characterId/followers
   * Get list of followers for a character
   */
  static async getFollowers(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const targetId = new mongoose.Types.ObjectId(characterId);

      // Fetch followers with character details
      const followers = await ForumCharacterFollow.aggregate([
        { $match: { followedId: targetId } },
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
      }));
    } catch (error: any) {
      console.error('[ForumFollowController] Get followers error:', error);
      res.status(500).json(errorResponse('Failed to fetch followers', 'GET_FOLLOWERS_ERROR'));
    }
  }

  /**
   * GET /forum/characters/:characterId/following
   * Get list of characters this character follows
   */
  static async getFollowing(req: Request<{ characterId: string }>, res: Response): Promise<void> {
    try {
      const { characterId } = req.params;
      const followerId = new mongoose.Types.ObjectId(characterId);

      // Fetch following with character details
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
      }));
    } catch (error: any) {
      console.error('[ForumFollowController] Get following error:', error);
      res.status(500).json(errorResponse('Failed to fetch following', 'GET_FOLLOWING_ERROR'));
    }
  }

  /**
   * GET /forum/my-follows
   * Get both followers and following for authenticated character
   */
  static async getMyFollows(req: Request, res: Response): Promise<void> {
    try {
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      // Fetch both followers and following in parallel
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

      // Get counts from Character model (denormalized)
      const character = await Character.findById(characterId);

      res.status(200).json(successResponse({
        followers,
        following,
        followerCount: character?.forumStats?.followerCount || followers.length,
        followingCount: character?.forumStats?.followingCount || following.length
      }));
    } catch (error: any) {
      console.error('[ForumFollowController] Get my follows error:', error);
      res.status(500).json(errorResponse('Failed to fetch follows', 'GET_MY_FOLLOWS_ERROR'));
    }
  }
}
