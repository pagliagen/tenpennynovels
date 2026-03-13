import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { successResponse, errorResponse, createResponse, getRequestId } from '../utils/apiResponse';
import { ForumDiscussionSubscription } from '@database/models/ForumDiscussionSubscription';
import { ForumDiscussion } from '@database/models/ForumDiscussion';

export class ForumSubscriptionController {

  static async subscribe(req: Request<{ topicSlug: string; discussionSlug: string }>, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND', undefined, 401, getRequestId(req)));
        return;
      }

      const { topicSlug, discussionSlug } = req.params;
      const characterId = new mongoose.Types.ObjectId(character.characterId);

      const discussion = await ForumDiscussion.findOne({ topicSlug, slug: discussionSlug });
      if (!discussion) {
        res.status(404).json(errorResponse('Discussion not found', 'DISCUSSION_NOT_FOUND', undefined, 404, getRequestId(req)));
        return;
      }

      const existing = await ForumDiscussionSubscription.findOne({
        characterId,
        discussionId: discussion._id
      });

      if (existing) {
        await ForumDiscussionSubscription.deleteOne({ _id: existing._id });
        await ForumDiscussion.findByIdAndUpdate(discussion._id, { $inc: { subscriberCount: -1 } });
        const updated = await ForumDiscussion.findById(discussion._id);
        res.status(200).json(successResponse({
          subscribed: false,
          subscriberCount: Math.max(0, updated?.subscriberCount ?? 0)
        }, 'Unsubscribed from discussion', getRequestId(req)));
      } else {
        await ForumDiscussionSubscription.create({
          characterId,
          discussionId: discussion._id,
          topicId: discussion.topicId
        });
        await ForumDiscussion.findByIdAndUpdate(discussion._id, { $inc: { subscriberCount: 1 } });
        const updated = await ForumDiscussion.findById(discussion._id);
        res.status(201).json(createResponse({
          subscribed: true,
          subscriberCount: updated?.subscriberCount ?? 1
        }, 'Subscribed to discussion', getRequestId(req)));
      }
    } catch (error: unknown) {
      console.error('[ForumSubscriptionController] Subscribe error:', error);
      res.status(500).json(errorResponse('Failed to subscribe', 'SUBSCRIBE_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  static async getSubscriptions(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json(errorResponse('Character not found', 'CHARACTER_NOT_FOUND', undefined, 401, getRequestId(req)));
        return;
      }

      const characterId = new mongoose.Types.ObjectId(character.characterId);

      const subscriptions = await ForumDiscussionSubscription.aggregate([
        { $match: { characterId } },
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
            localField: 'discussion.topicId',
            foreignField: '_id',
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
      }, undefined, getRequestId(req)));
    } catch (error: unknown) {
      console.error('[ForumSubscriptionController] Get subscriptions error:', error);
      res.status(500).json(errorResponse('Failed to fetch subscriptions', 'GET_SUBSCRIPTIONS_ERROR', undefined, 500, getRequestId(req)));
    }
  }
}
