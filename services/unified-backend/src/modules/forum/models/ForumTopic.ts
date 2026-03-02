import mongoose, { Document, Schema } from 'mongoose';

/**
 * ForumTopic Model
 * Represents a top-level forum category (e.g., "General", "Off-Topic", "Game Discussion")
 */

export interface IForumTopic extends Document {
  slug: string;
  title: string;
  description?: string;
  isPublic: boolean;
  isVisible: boolean;
  isLocked: boolean;
  isPinned: boolean;
  postCount: number;
  discussionCount: number;
  lastPostAt?: Date;
  lastPostBy?: {
    userId: string;
    username: string;
    characterName?: string;
    characterId?: string;
  };
  createdAt: Date;
  createdBy: {
    userId: string;
    username: string;
  };
  color?: string;
  icon?: string;
  moderators?: string[]; // User IDs who can moderate this topic
}

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
  isPublic: {
    type: Boolean,
    default: true
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  postCount: {
    type: Number,
    default: 0,
    min: [0, 'Post count cannot be negative']
  },
  discussionCount: {
    type: Number,
    default: 0,
    min: [0, 'Discussion count cannot be negative']
  },
  lastPostAt: Date,
  lastPostBy: {
    userId: String,
    username: String,
    characterName: String,
    characterId: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    userId: { type: String, required: true },
    username: { type: String, required: true }
  },
  color: {
    type: String,
    match: [/^#[0-9A-F]{6}$/i, 'Color must be a valid hex code']
  },
  icon: String,
  moderators: [String]
}, {
  collection: 'forum_topics',
  timestamps: false // Using manual createdAt
});

// Indexes
ForumTopicSchema.index({ slug: 1 }, { unique: true });
ForumTopicSchema.index({ isPinned: -1, lastPostAt: -1 }); // For listing topics (pinned first, then by activity)
ForumTopicSchema.index({ isVisible: 1, isPublic: 1 }); // For filtering visible/public topics

export const ForumTopic = mongoose.model<IForumTopic>('ForumTopic', ForumTopicSchema);
