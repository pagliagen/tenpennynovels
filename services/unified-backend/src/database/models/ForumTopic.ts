import mongoose, { Schema, Document, model, models } from 'mongoose';

/**
 * ForumTopic Model
 *
 * Top-level forum category with flexible access rules.
 * Identity: 100% character-based (no userId/username).
 */

export type AccessRuleType = 'public' | 'authenticated' | 'corporation' | 'gameplayRole';

export interface TopicAccessRule {
  type: AccessRuleType;
  corporationId?: mongoose.Types.ObjectId;
  gameplayRole?: string;
  label?: string;
}

export interface IForumTopic extends Document {
  slug: string;
  title: string;
  description?: string;
  sortOrder: number;
  accessRules: TopicAccessRule[];
  isVisible: boolean;
  isLocked: boolean;
  isPinned: boolean;
  discussionCount: number;
  postCount: number;
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
  color?: string;
  icon?: string;
  moderatorIds?: mongoose.Types.ObjectId[];
  categoryId?: mongoose.Types.ObjectId;
  categorySlug?: string;
  accessRulesOverride: boolean;
}

export const AccessRuleSchema = new Schema({
  type: {
    type: String,
    enum: ['public', 'authenticated', 'corporation', 'gameplayRole'],
    required: true
  },
  corporationId: { type: Schema.Types.ObjectId, ref: 'Corporation' },
  gameplayRole: { type: String, enum: ['player', 'master', 'moderatore'] },
  label: { type: String, maxlength: 100 }
}, { _id: false });

const CharacterRefSchema = new Schema({
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
  characterName: { type: String, required: true }
}, { _id: false });

const ForumTopicSchema = new Schema<IForumTopic>({
  slug: {
    type: String,
    required: [true, 'Topic slug is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens']
  },
  title: {
    type: String,
    required: [true, 'Topic title is required'],
    trim: true,
    minlength: [3, 'Title must be at least 3 characters'],
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  accessRules: {
    type: [AccessRuleSchema],
    default: [{ type: 'public' }]
  },
  isVisible: { type: Boolean, default: true },
  isLocked: { type: Boolean, default: false },
  isPinned: { type: Boolean, default: false },
  postCount: { type: Number, default: 0, min: 0 },
  discussionCount: { type: Number, default: 0, min: 0 },
  lastPostAt: Date,
  lastPostBy: CharacterRefSchema,
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: CharacterRefSchema, required: true },
  color: {
    type: String,
    match: [/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code']
  },
  icon: String,
  moderatorIds: [{ type: Schema.Types.ObjectId, ref: 'Character' }],
  categoryId: { type: Schema.Types.ObjectId, ref: 'ForumCategory' },
  categorySlug: { type: String, lowercase: true },
  // If false (default), effective access rules are inherited from the parent
  // ForumCategory's defaultAccessRules (when categoryId is set). If true, this
  // topic's own accessRules are used regardless of category. See canAccessTopic
  // in ForumController.ts.
  accessRulesOverride: { type: Boolean, default: false }
}, {
  collection: 'forum_topics',
  timestamps: false
});

// slug index is already created via { unique: true } in field definition
ForumTopicSchema.index({ sortOrder: 1, isPinned: -1, lastPostAt: -1 });
ForumTopicSchema.index({ isVisible: 1 });
ForumTopicSchema.index({ 'accessRules.corporationId': 1 });
ForumTopicSchema.index({ categoryId: 1 });

export const ForumTopic = models.ForumTopic || model<IForumTopic>('ForumTopic', ForumTopicSchema);
