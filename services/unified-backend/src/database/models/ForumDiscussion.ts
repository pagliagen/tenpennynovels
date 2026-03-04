import { Schema, Document, model, models } from 'mongoose';

/**
 * ForumDiscussion Model
 * Represents a discussion thread within a topic (e.g., "How to create a character?")
 */

export interface IForumDiscussion extends Document {
  slug: string;
  topicSlug: string;
  title: string;
  isPinned: boolean;
  isLocked: boolean;
  isVisible: boolean;
  postCount: number;
  subscriberCount: number; // Denormalized count for performance
  viewCount: number;
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
    characterName?: string;
    characterId?: string;
  };
  tags?: string[];
}

const ForumDiscussionSchema = new Schema<IForumDiscussion>({
  slug: {
    type: String,
    required: [true, 'Discussion slug is required'],
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens']
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
  isPinned: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  postCount: {
    type: Number,
    default: 0,
    min: [0, 'Post count cannot be negative']
  },
  subscriberCount: {
    type: Number,
    default: 0,
    min: [0, 'Subscriber count cannot be negative']
  },
  viewCount: {
    type: Number,
    default: 0,
    min: [0, 'View count cannot be negative']
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
    username: { type: String, required: true },
    characterName: String,
    characterId: String
  },
  tags: [String]
}, {
  collection: 'forum_discussions',
  timestamps: false // Using manual createdAt
});

// Indexes
ForumDiscussionSchema.index({ topicSlug: 1, slug: 1 }, { unique: true }); // Compound unique index
ForumDiscussionSchema.index({ topicSlug: 1, isPinned: -1, lastPostAt: -1 }); // For listing discussions (pinned first, then by activity)
ForumDiscussionSchema.index({ lastPostAt: -1 }); // For recent discussions
ForumDiscussionSchema.index({ tags: 1 }); // For filtering by tags

export const ForumDiscussion = models.ForumDiscussion || model<IForumDiscussion>('ForumDiscussion', ForumDiscussionSchema);
