import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { successResponse, createResponse, errorResponse, getRequestId } from '@shared/utils/apiResponse';

import { ForumDiscussionSubscription } from '../models/ForumDiscussionSubscription';
import { ForumDiscussion } from '../models/ForumDiscussion';
import { logger } from '../utils/logger';

export class ForumSubscriptionController {

  static async subscribe(req: Request<{ topicSlug: string; discussionSlug: string }>, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json({ success: false, error: 'Personaggio non trovato', code: 'CHARACTER_NOT_FOUND' });
        return;
      }

      const { topicSlug, discussionSlug } = req.params;
      const characterId = new mongoose.Types.ObjectId(character.characterId);

      const discussion = await ForumDiscussion.findOne({ topicSlug, slug: discussionSlug, isDeleted: false });
      if (!discussion) {
        res.status(404).json({ success: false, error: 'Discussione non trovata', code: 'DISCUSSION_NOT_FOUND' });
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
        }, 'Iscrizione alla discussione annullata', getRequestId(req)));
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
        }, 'Iscrizione alla discussione effettuata', getRequestId(req)));
      }
    } catch (error: unknown) {
      logger.error('[ForumSubscriptionController] Subscribe error:', error);
      res.status(500).json(errorResponse('Impossibile effettuare l\'iscrizione', 'SUBSCRIBE_ERROR', undefined, 500, getRequestId(req)));
    }
  }

  static async getSubscriptions(req: Request, res: Response): Promise<void> {
    try {
      const character = req.character;
      if (!character) {
        res.status(401).json({ success: false, error: 'Personaggio non trovato', code: 'CHARACTER_NOT_FOUND' });
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
        { $match: { 'discussion.isDeleted': false } },
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
      logger.error('[ForumSubscriptionController] Get subscriptions error:', error);
      res.status(500).json({ success: false, error: 'Impossibile recuperare le iscrizioni', code: 'GET_SUBSCRIPTIONS_ERROR' });
    }
  }
}
