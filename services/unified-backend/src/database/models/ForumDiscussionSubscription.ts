import mongoose, { Schema, Document, model, models } from 'mongoose';

/**
 * ForumDiscussionSubscription Model
 *
 * Junction table for characters subscribed to specific discussions.
 * Enables notifications when new posts are added.
 */

export interface IForumDiscussionSubscription extends Document {
  characterId: mongoose.Types.ObjectId;
  discussionId: mongoose.Types.ObjectId;
  topicId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ForumDiscussionSubscriptionSchema = new Schema<IForumDiscussionSubscription>({
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: [true, 'Character ID is required']
  },
  discussionId: {
    type: Schema.Types.ObjectId,
    ref: 'ForumDiscussion',
    required: [true, 'Discussion ID is required']
  },
  topicId: {
    type: Schema.Types.ObjectId,
    ref: 'ForumTopic',
    required: [true, 'Topic ID is required']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'forum_discussion_subscriptions',
  timestamps: false
});

ForumDiscussionSubscriptionSchema.index({ characterId: 1, discussionId: 1 }, { unique: true });
ForumDiscussionSubscriptionSchema.index({ discussionId: 1 });
ForumDiscussionSubscriptionSchema.index({ characterId: 1, createdAt: -1 });

export const ForumDiscussionSubscription = models.ForumDiscussionSubscription || model<IForumDiscussionSubscription>('ForumDiscussionSubscription', ForumDiscussionSubscriptionSchema);
