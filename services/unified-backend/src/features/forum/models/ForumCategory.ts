import mongoose, { Schema, Document, model, models } from 'mongoose';

import { AccessRuleSchema, type TopicAccessRule } from './ForumTopic';

/**
 * ForumCategory Model
 *
 * Macrocategoria: groups ForumTopic ("bacheca") documents and carries default
 * access rules that a topic inherits unless it sets accessRulesOverride: true.
 * Purely organizational otherwise - it has no discussions/posts of its own.
 */

export interface IForumCategory extends Document {
  slug: string;
  title: string;
  description?: string;
  sortOrder: number;
  isVisible: boolean;
  color?: string;
  defaultAccessRules: TopicAccessRule[];
  createdAt: Date;
  createdBy: {
    characterId: mongoose.Types.ObjectId;
    characterName: string;
  };
}

const CharacterRefSchema = new Schema({
  characterId: { type: Schema.Types.ObjectId, ref: 'Character', required: true },
  characterName: { type: String, required: true }
}, { _id: false });

const ForumCategorySchema = new Schema<IForumCategory>({
  slug: {
    type: String,
    required: [true, 'Category slug is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens']
  },
  title: {
    type: String,
    required: [true, 'Category title is required'],
    trim: true,
    minlength: [3, 'Title must be at least 3 characters'],
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  sortOrder: { type: Number, default: 0 },
  isVisible: { type: Boolean, default: true },
  color: {
    type: String,
    match: [/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code']
  },
  defaultAccessRules: {
    type: [AccessRuleSchema],
    default: [{ type: 'public' }]
  },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: CharacterRefSchema, required: true }
}, {
  collection: 'forum_categories',
  timestamps: false
});

ForumCategorySchema.index({ sortOrder: 1 });
ForumCategorySchema.index({ isVisible: 1 });

export const ForumCategory = models.ForumCategory || model<IForumCategory>('ForumCategory', ForumCategorySchema);
