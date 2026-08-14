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
    characterAvatar?: string;
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
  // Settable by the author only when the parent topic is in 'ON' mode. Display-only:
  // the real author identity is NEVER removed from `author` below - masking happens
  // only in the API response serialization for viewers without moderation access
  // (see ForumSerializer.ts). Staff can always see the real author.
  isAnonymous?: boolean;
  // At most one pinned post per discussion, enforced in the controller (unpins
  // the previous one), not in the schema.
  isPinned?: boolean;
  pinnedAt?: Date;
  pinnedByCharacterId?: mongoose.Types.ObjectId;
  // Snapshot (not a live reference) of the quoted post, taken at quote time -
  // stays stable even if the original is later edited/deleted, same rationale
  // as editHistory below.
  quotedContent?: {
    postId: mongoose.Types.ObjectId;
    authorCharacterName: string;
    excerptHtml: string;
  };
  moderationScore?: number;
  moderationLabel?: string;
  moderationModel?: string;
  moderationProcessedAt?: Date;
}

const CharacterRefSchema = new Schema({
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
  characterName: { type: String, required: true },
  characterAvatar: String
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
    // Raised from 10000: this is now sanitized HTML (see ForumContentSanitizer),
    // which carries markup overhead over the same amount of visible text.
    maxlength: [20000, 'Content cannot exceed 20000 characters']
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
  isAnonymous: { type: Boolean, default: false },
  isPinned: { type: Boolean, default: false },
  pinnedAt: Date,
  pinnedByCharacterId: { type: Schema.Types.ObjectId, ref: 'Character' },
  quotedContent: {
    postId: { type: Schema.Types.ObjectId, ref: 'ForumPost' },
    authorCharacterName: String,
    excerptHtml: String
  },
  moderationScore: { type: Number, min: 0, max: 1 },
  moderationLabel: { type: String, enum: ['toxic', 'not-toxic'] },
  moderationModel: String,
  moderationProcessedAt: Date
}, {
  collection: 'forum_posts',
  timestamps: false
});

const newDocuments = new WeakSet<Document>();

ForumPostSchema.pre('save', function() {
  if (this.isNew) newDocuments.add(this);
});

ForumPostSchema.post('save', async function(doc) {
  if (doc.isDeleted) return;
  try {
    const { publishForumPostEvent } = await import('@shared/services/EmbeddingEventPublisher');
    const { stripToPlainText } = await import('../services/ForumContentSanitizer');
    const action = newDocuments.has(doc) ? 'created' : 'updated';
    newDocuments.delete(doc);
    await publishForumPostEvent(action, {
      _id: doc._id.toString(),
      // content is sanitized HTML at this point (see ForumContentSanitizer) -
      // the embedding index wants clean text, not markup.
      content: stripToPlainText(doc.content),
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
    const { publishForumPostEvent } = await import('@shared/services/EmbeddingEventPublisher');
    const { stripToPlainText } = await import('../services/ForumContentSanitizer');
    await publishForumPostEvent('updated', {
      _id: doc._id.toString(),
      content: stripToPlainText(doc.content),
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
ForumPostSchema.index({ discussionId: 1, isPinned: -1 });

export const ForumPost = models.ForumPost || model<IForumPost>('ForumPost', ForumPostSchema);
