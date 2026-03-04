import mongoose, { Schema, Document, model, models } from 'mongoose';

/**
 * ForumDiscussionSubscription Model
 * Junction table for characters subscribed to specific discussions
 * Enables notifications when new posts are added to followed discussions
 */

export interface IForumDiscussionSubscription extends Document {
  characterId: mongoose.Types.ObjectId;
  discussionId: mongoose.Types.ObjectId;
  topicSlug: string; // Denormalized for easy querying
  discussionSlug: string; // Denormalized for easy querying
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
  topicSlug: {
    type: String,
    required: [true, 'Topic slug is required'],
    lowercase: true
  },
  discussionSlug: {
    type: String,
    required: [true, 'Discussion slug is required'],
    lowercase: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'forum_discussion_subscriptions',
  timestamps: false // Using manual createdAt
});

// Indexes
ForumDiscussionSubscriptionSchema.index({ characterId: 1, discussionId: 1 }, { unique: true }); // Compound unique: one subscription per character per discussion
ForumDiscussionSubscriptionSchema.index({ discussionId: 1 }); // For counting subscribers on a discussion
ForumDiscussionSubscriptionSchema.index({ characterId: 1, createdAt: -1 }); // For listing character's subscriptions

export const ForumDiscussionSubscription = models.ForumDiscussionSubscription || model<IForumDiscussionSubscription>('ForumDiscussionSubscription', ForumDiscussionSubscriptionSchema);
