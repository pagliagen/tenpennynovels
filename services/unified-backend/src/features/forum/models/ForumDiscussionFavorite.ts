import mongoose, { Schema, Document, model, models } from 'mongoose';

/**
 * ForumDiscussionFavorite Model
 *
 * Junction table for character's favorite THREADS (as opposed to
 * ForumTopicFavorite, which is bacheca-level, and ForumBookmark, which is
 * post-level). This is the granularity the spec actually asks for
 * ("macrocategoria preferiti sotto la quale appaiono i thread") - kept as a
 * separate concept from ForumDiscussionSubscription (notifications), per
 * explicit product decision: preferiti and subscription stay distinct.
 */

export interface IForumDiscussionFavorite extends Document {
  characterId: mongoose.Types.ObjectId;
  discussionId: mongoose.Types.ObjectId;
  topicId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ForumDiscussionFavoriteSchema = new Schema<IForumDiscussionFavorite>({
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: [true, 'Character ID is required'] },
  discussionId: { type: Schema.Types.ObjectId, ref: 'ForumDiscussion', required: [true, 'Discussion ID is required'] },
  topicId: { type: Schema.Types.ObjectId, ref: 'ForumTopic', required: [true, 'Topic ID is required'] },
  createdAt: { type: Date, default: Date.now }
}, {
  collection: 'forum_discussion_favorites',
  timestamps: false
});

ForumDiscussionFavoriteSchema.index({ characterId: 1, discussionId: 1 }, { unique: true });
ForumDiscussionFavoriteSchema.index({ discussionId: 1 });
ForumDiscussionFavoriteSchema.index({ characterId: 1, createdAt: -1 });

export const ForumDiscussionFavorite = models.ForumDiscussionFavorite
  || model<IForumDiscussionFavorite>('ForumDiscussionFavorite', ForumDiscussionFavoriteSchema);
