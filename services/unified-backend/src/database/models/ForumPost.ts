import mongoose, { Schema, Document, model, models } from 'mongoose';

/**
 * ForumPost Model
 *
 * Single post/reply within a discussion thread.
 * Identity: 100% character-based (no userId/username).
 * Uses ObjectId refs for topicId/discussionId + denormalized slugs for routing.
 * Embedding lives in Qdrant, NOT on this document.
 * Moderation results saved here for quick lookup.
 */

export interface IForumPost extends Document {
  topicId: mongoose.Types.ObjectId;
  discussionId: mongoose.Types.ObjectId;
  topicSlug: string;
  discussionSlug: string;
  content: string;
  author: {
    characterId: mongoose.Types.ObjectId;
    characterName: string;
  };
  createdAt: Date;
  updatedAt?: Date;
  isEdited: boolean;
  editHistory?: {
    editedAt: Date;
    previousContent: string;
  }[];
  isDeleted: boolean;
  deletedAt?: Date;
  deletedByCharacterId?: mongoose.Types.ObjectId;
  replyToPostId?: mongoose.Types.ObjectId;
  reactionCounts: {
    like: number;
    love: number;
    laugh: number;
    think: number;
  };
  moderationScore?: number;
  moderationLabel?: string;
  moderationModel?: string;
  moderationProcessedAt?: Date;
}

const CharacterRefSchema = new Schema({
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
  characterName: { type: String, required: true }
}, { _id: false });

const ReactionCountsSchema = new Schema({
  like: { type: Number, default: 0, min: 0 },
  love: { type: Number, default: 0, min: 0 },
  laugh: { type: Number, default: 0, min: 0 },
  think: { type: Number, default: 0, min: 0 }
}, { _id: false });

const ForumPostSchema = new Schema<IForumPost>({
  topicId: {
    type: Schema.Types.ObjectId,
    ref: 'ForumTopic',
    required: [true, 'Topic ID is required']
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
  content: {
    type: String,
    required: [true, 'Post content is required'],
    trim: true,
    minlength: [1, 'Content must be at least 1 character'],
    maxlength: [10000, 'Content cannot exceed 10000 characters']
  },
  author: { type: CharacterRefSchema, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
  isEdited: { type: Boolean, default: false },
  editHistory: [{
    editedAt: { type: Date, required: true },
    previousContent: { type: String, required: true },
    _id: false
  }],
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedByCharacterId: { type: Schema.Types.ObjectId, ref: 'Character' },
  replyToPostId: { type: Schema.Types.ObjectId, ref: 'ForumPost' },
  reactionCounts: {
    type: ReactionCountsSchema,
    default: () => ({ like: 0, love: 0, laugh: 0, think: 0 })
  },
  moderationScore: { type: Number, min: 0, max: 1 },
  moderationLabel: { type: String, enum: ['toxic', 'not-toxic'] },
  moderationModel: String,
  moderationProcessedAt: Date
}, {
  collection: 'forum_posts',
  timestamps: false
});

ForumPostSchema.pre('save', function() {
  (this as any)._wasNew = this.isNew;
});

ForumPostSchema.post('save', async function(doc) {
  if (doc.isDeleted) return;
  try {
    const { publishForumPostEvent } = await import('../../shared/services/EmbeddingEventPublisher');
    const action = (doc as any)._wasNew ? 'created' : 'updated';
    await publishForumPostEvent(action, {
      _id: doc._id.toString(),
      content: doc.content,
      topicSlug: doc.topicSlug,
      discussionSlug: doc.discussionSlug,
      authorCharacterId: doc.author.characterId.toString(),
      authorCharacterName: doc.author.characterName,
    });
  } catch {
    // Non-blocking: embedding failure should not prevent post creation
  }
});

ForumPostSchema.post('findOneAndUpdate', async function(doc) {
  if (!doc || doc.isDeleted) return;
  try {
    const { publishForumPostEvent } = await import('../../shared/services/EmbeddingEventPublisher');
    await publishForumPostEvent('updated', {
      _id: doc._id.toString(),
      content: doc.content,
      topicSlug: doc.topicSlug,
      discussionSlug: doc.discussionSlug,
      authorCharacterId: doc.author.characterId.toString(),
      authorCharacterName: doc.author.characterName,
    });
  } catch {
    // Non-blocking
  }
});

ForumPostSchema.index({ discussionId: 1, createdAt: 1 });
ForumPostSchema.index({ topicId: 1, discussionId: 1 });
ForumPostSchema.index({ 'author.characterId': 1, createdAt: -1 });
ForumPostSchema.index({ replyToPostId: 1 });
ForumPostSchema.index({ isDeleted: 1 });

export const ForumPost = models.ForumPost || model<IForumPost>('ForumPost', ForumPostSchema);
