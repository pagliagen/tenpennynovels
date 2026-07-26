import mongoose, { Schema, Document, model, models } from 'mongoose';

/**
 * ForumDiscussion Model
 *
 * Discussion thread within a topic.
 * Identity: 100% character-based (no userId/username).
 * Uses topicId (ObjectId) as primary FK + topicSlug denormalized for routing.
 */

export type DiscussionVisibilityType = 'public' | 'staff' | 'corporation' | 'characterList' | 'private';

export interface DiscussionVisibility {
  type: DiscussionVisibilityType;
  corporationId?: mongoose.Types.ObjectId; // required when type === 'corporation'
  characterIds?: mongoose.Types.ObjectId[]; // required when type === 'characterList'
}

export interface IForumDiscussion extends Document {
  slug: string;
  topicId: mongoose.Types.ObjectId;
  topicSlug: string;
  title: string;
  isPinned: boolean;
  isLocked: boolean;
  isVisible: boolean;
  postCount: number;
  subscriberCount: number;
  viewCount: number;
  lastPostAt?: Date;
  lastPostBy?: {
    characterId: mongoose.Types.ObjectId;
    characterName: string;
  };
  createdAt: Date;
  createdBy: {
    characterId: mongoose.Types.ObjectId;
    characterName: string;
  };
  tags?: string[];
  isDeleted: boolean;
  deletedAt?: Date;
  deletedByCharacterId?: mongoose.Types.ObjectId;
  // Absent = inherits fully from the topic (no additional restriction beyond
  // what the bacheca already allows). See ForumAccessService.evaluateDiscussionVisibility
  // for how this combines with the topic's own access rules (AND, never wider).
  visibility?: DiscussionVisibility;
  // Always applied on top of `visibility`, regardless of type (including 'staff'
  // and 'private') - lets staff hide one specific thread from one specific
  // character even if they'd otherwise qualify. Gestore always bypasses this.
  excludedCharacterIds?: mongoose.Types.ObjectId[];
}

const CharacterRefSchema = new Schema({
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
  characterName: { type: String, required: true }
}, { _id: false });

const DiscussionVisibilitySchema = new Schema({
  type: {
    type: String,
    enum: ['public', 'staff', 'corporation', 'characterList', 'private'],
    required: true
  },
  corporationId: { type: Schema.Types.ObjectId, ref: 'Corporation' },
  characterIds: [{ type: Schema.Types.ObjectId, ref: 'Character' }]
}, { _id: false });

const ForumDiscussionSchema = new Schema<IForumDiscussion>({
  slug: {
    type: String,
    required: [true, 'Discussion slug is required'],
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens']
  },
  topicId: {
    type: Schema.Types.ObjectId,
    ref: 'ForumTopic',
    required: [true, 'Topic ID is required']
  },
  topicSlug: {
    type: String,
    required: [true, 'Topic slug is required'],
    lowercase: true
  },
  title: {
    type: String,
    required: [true, 'Discussion title is required'],
    trim: true,
    minlength: [3, 'Title must be at least 3 characters'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  isPinned: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
  isVisible: { type: Boolean, default: true },
  postCount: { type: Number, default: 0, min: 0 },
  subscriberCount: { type: Number, default: 0, min: 0 },
  viewCount: { type: Number, default: 0, min: 0 },
  lastPostAt: Date,
  lastPostBy: CharacterRefSchema,
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: CharacterRefSchema, required: true },
  tags: [String],
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedByCharacterId: { type: Schema.Types.ObjectId, ref: 'Character' },
  visibility: DiscussionVisibilitySchema,
  excludedCharacterIds: [{ type: Schema.Types.ObjectId, ref: 'Character' }]
}, {
  collection: 'forum_discussions',
  timestamps: false
});

ForumDiscussionSchema.index({ topicId: 1, slug: 1 }, { unique: true });
ForumDiscussionSchema.index({ topicSlug: 1, isPinned: -1, lastPostAt: -1 });
ForumDiscussionSchema.index({ lastPostAt: -1 });
ForumDiscussionSchema.index({ tags: 1 });
ForumDiscussionSchema.index({ isDeleted: 1 });
ForumDiscussionSchema.index({ 'visibility.corporationId': 1 });

export const ForumDiscussion = models.ForumDiscussion || model<IForumDiscussion>('ForumDiscussion', ForumDiscussionSchema);
