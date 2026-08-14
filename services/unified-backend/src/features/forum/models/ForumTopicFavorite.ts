import mongoose, { Schema, Document, model, models } from 'mongoose';

/**
 * ForumTopicFavorite Model
 * Junction table for character's favorite topics
 */

export interface IForumTopicFavorite extends Document {
  characterId: mongoose.Types.ObjectId;
  topicId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ForumTopicFavoriteSchema = new Schema<IForumTopicFavorite>({
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: [true, 'Character ID is required']
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
  collection: 'forum_topic_favorites',
  timestamps: false // Using manual createdAt
});

// Indexes
ForumTopicFavoriteSchema.index({ characterId: 1, topicId: 1 }, { unique: true }); // Compound unique: one favorite per character per topic
ForumTopicFavoriteSchema.index({ topicId: 1 }); // For counting favorites on a topic
ForumTopicFavoriteSchema.index({ characterId: 1, createdAt: -1 }); // For listing character's favorites

export const ForumTopicFavorite = models.ForumTopicFavorite || model<IForumTopicFavorite>('ForumTopicFavorite', ForumTopicFavoriteSchema);
