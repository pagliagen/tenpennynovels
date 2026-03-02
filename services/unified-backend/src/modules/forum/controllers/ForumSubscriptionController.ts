import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ForumDiscussionSubscription } from '../models/ForumDiscussionSubscription';
import { ForumDiscussion } from '../models/ForumDiscussion';
import { ForumTopic } from '../models/ForumTopic';
import { Character } from '@database/models/Character';
import { successResponse, errorResponse } from '../utils/apiResponse';

/**
 * ForumSubscriptionController
 * Handles discussion subscription endpoints (follow specific threads for notifications)
 */

export class ForumSubscriptionController {
  /**
   * POST /forum/topics/:topicSlug/discussions/:discussionSlug/subscribe
   * Subscribe to a discussion (receive notifications on new posts)
   */
  static async subscribe(req: Request<{ topicSlug: string, discussionSlug: string }>, res: Response): Promise<void> {
    try {
      const { topicSlug, discussionSlug } = req.params;
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      // Find the discussion
      const discussion = await ForumDiscussion.findOne({ topicSlug, slug: discussionSlug });
      if (!discussion) {
        res.status(404).json(errorResponse('Discussion not found', 'DISCUSSION_NOT_FOUND'));
        return;
      }

      // Check if already subscribed
      const existing = await ForumDiscussionSubscription.findOne({
        characterId,
        discussionId: discussion._id
      });

      if (existing) {
        res.status(400).json(errorResponse('Already subscribed to this discussion', 'ALREADY_SUBSCRIBED'));
        return;
      }

      // Create subscription
      await ForumDiscussionSubscription.create({
        characterId,
        discussionId: discussion._id,
        topicSlug,
        discussionSlug,
        createdAt: new Date()
      });

      // Increment subscriberCount atomically
      await ForumDiscussion.findByIdAndUpdate(
        discussion._id,
        { $inc: { subscriberCount: 1 } }
      );

      // Get updated count
      const updated = await ForumDiscussion.findById(discussion._id);
      const subscriberCount = updated?.subscriberCount || 1;

      res.status(200).json(successResponse({
        subscribed: true,
        subscriberCount
      }, 'Subscribed to discussion'));
    } catch (error: any) {
      console.error('[ForumSubscriptionController] Subscribe error:', error);
      res.status(500).json(errorResponse('Failed to subscribe', 'SUBSCRIBE_ERROR'));
    }
  }

  /**
   * DELETE /forum/topics/:topicSlug/discussions/:discussionSlug/subscribe
   * Unsubscribe from a discussion
   */
  static async unsubscribe(req: Request<{ topicSlug: string, discussionSlug: string }>, res: Response): Promise<void> {
    try {
      const { topicSlug, discussionSlug } = req.params;
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      // Find the discussion
      const discussion = await ForumDiscussion.findOne({ topicSlug, slug: discussionSlug });
      if (!discussion) {
        res.status(404).json(errorResponse('Discussion not found', 'DISCUSSION_NOT_FOUND'));
        return;
      }

      // Delete subscription
      const result = await ForumDiscussionSubscription.deleteOne({
        characterId,
        discussionId: discussion._id
      });

      if (result.deletedCount === 0) {
        res.status(404).json(errorResponse('Not subscribed to this discussion', 'NOT_SUBSCRIBED'));
        return;
      }

      // Decrement subscriberCount atomically
      await ForumDiscussion.findByIdAndUpdate(
        discussion._id,
        { $inc: { subscriberCount: -1 } }
      );

      // Get updated count
      const updated = await ForumDiscussion.findById(discussion._id);
      const subscriberCount = Math.max(0, updated?.subscriberCount || 0);

      res.status(200).json(successResponse({
        subscribed: false,
        subscriberCount
      }, 'Unsubscribed from discussion'));
    } catch (error: any) {
      console.error('[ForumSubscriptionController] Unsubscribe error:', error);
      res.status(500).json(errorResponse('Failed to unsubscribe', 'UNSUBSCRIBE_ERROR'));
    }
  }

  /**
   * GET /forum/subscriptions
   * Get all subscriptions for the authenticated character
   */
  static async getSubscriptions(req: Request, res: Response): Promise<void> {
    try {
      const characterId = (req as any).character?._id;

      if (!characterId) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND'));
        return;
      }

      // Fetch subscriptions with populated discussion details
      const subscriptions = await ForumDiscussionSubscription.aggregate([
        { $match: { characterId: new mongoose.Types.ObjectId(characterId) } },
        {
          $lookup: {
            from: 'forum_discussions',
            localField: 'discussionId',
            foreignField: '_id',
            as: 'discussion'
          }
        },
        { $unwind: '$discussion' },
        {
          $lookup: {
            from: 'forum_topics',
            localField: 'discussion.topicSlug',
            foreignField: 'slug',
            as: 'topic'
          }
        },
        { $unwind: '$topic' },
        {
          $project: {
            _id: 1,
            subscribedAt: '$createdAt',
            discussion: {
              _id: '$discussion._id',
              title: '$discussion.title',
              slug: '$discussion.slug',
              topicSlug: '$discussion.topicSlug',
              postCount: '$discussion.postCount',
              lastPostAt: '$discussion.lastPostAt'
            },
            topic: {
              title: '$topic.title',
              slug: '$topic.slug'
            }
          }
        },
        { $sort: { subscribedAt: -1 } }
      ]);

      res.status(200).json(successResponse({
        subscriptions,
        totalCount: subscriptions.length
      }));
    } catch (error: any) {
      console.error('[ForumSubscriptionController] Get subscriptions error:', error);
      res.status(500).json(errorResponse('Failed to fetch subscriptions', 'GET_SUBSCRIPTIONS_ERROR'));
    }
  }

  /**
   * GET /forum/topics/:topicSlug/discussions/:discussionSlug/subscribers
   * Get list of subscribers for a discussion (character details)
   */
  static async getSubscribers(req: Request<{ topicSlug: string, discussionSlug: string }>, res: Response): Promise<void> {
    try {
      const { topicSlug, discussionSlug } = req.params;

      // Find the discussion
      const discussion = await ForumDiscussion.findOne({ topicSlug, slug: discussionSlug });
      if (!discussion) {
        res.status(404).json(errorResponse('Discussion not found', 'DISCUSSION_NOT_FOUND'));
        return;
      }

      // Fetch subscribers with character details
      const subscribers = await ForumDiscussionSubscription.aggregate([
        { $match: { discussionId: discussion._id } },
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
            subscribedAt: '$createdAt'
          }
        },
        { $sort: { subscribedAt: -1 } }
      ]);

      res.status(200).json(successResponse({
        subscribers,
        count: subscribers.length
      }));
    } catch (error: any) {
      console.error('[ForumSubscriptionController] Get subscribers error:', error);
      res.status(500).json(errorResponse('Failed to fetch subscribers', 'GET_SUBSCRIBERS_ERROR'));
    }
  }
}
