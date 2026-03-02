import mongoose, { Document, Schema } from 'mongoose';

/**
 * ForumPost Model
 * Represents a single post/reply within a discussion thread
 */

export interface IForumPost extends Document {
  topicSlug: string;
  discussionSlug: string;
  content: string;
  authorUserId: string;
  authorUsername: string;
  authorCharacterName?: string;
  authorCharacterId?: string;
  createdAt: Date;
  updatedAt?: Date;
  isEdited: boolean;
  editHistory?: {
    editedAt: Date;
    editedBy: string;
    reason?: string;
  }[];
  isPinned?: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  replyToPostId?: mongoose.Types.ObjectId;
  reactionCounts: {
    like: number;
    love: number;
    laugh: number;
    think: number;
  };
}

const ForumPostSchema = new Schema<IForumPost>({
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
  authorUserId: {
    type: String,
    required: [true, 'Author user ID is required']
  },
  authorUsername: {
    type: String,
    required: [true, 'Author username is required']
  },
  authorCharacterName: String,
  authorCharacterId: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date,
  isEdited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    editedAt: { type: Date, required: true },
    editedBy: { type: String, required: true },
    reason: String
  }],
  isPinned: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: String,
  replyToPostId: {
    type: Schema.Types.ObjectId,
    ref: 'ForumPost'
  },
  reactionCounts: {
    type: {
      like: { type: Number, default: 0, min: 0 },
      love: { type: Number, default: 0, min: 0 },
      laugh: { type: Number, default: 0, min: 0 },
      think: { type: Number, default: 0, min: 0 }
    },
    default: { like: 0, love: 0, laugh: 0, think: 0 }
  }
}, {
  collection: 'forum_posts',
  timestamps: false // Using manual createdAt/updatedAt
});

// Indexes
ForumPostSchema.index({ topicSlug: 1, discussionSlug: 1, createdAt: 1 }); // For listing posts in order
ForumPostSchema.index({ authorCharacterId: 1, createdAt: -1 }); // For character activity feed
ForumPostSchema.index({ replyToPostId: 1 }); // For finding replies to a post
ForumPostSchema.index({ isDeleted: 1 }); // For filtering deleted posts

export const ForumPost = mongoose.model<IForumPost>('ForumPost', ForumPostSchema);
