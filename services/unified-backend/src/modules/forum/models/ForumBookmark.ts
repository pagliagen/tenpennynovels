import mongoose, { Document, Schema } from 'mongoose';

/**
 * ForumBookmark Model
 * Granular bookmarks for discussions and posts
 * More specific than topic favorites
 */

export type BookmarkItemType = 'discussion' | 'post';

export interface IForumBookmark extends Document {
  characterId: mongoose.Types.ObjectId;
  itemType: BookmarkItemType;
  itemId: mongoose.Types.ObjectId; // discussionId or postId
  // Denormalized fields for easy querying
  topicSlug?: string;
  discussionSlug?: string;
  createdAt: Date;
}

const ForumBookmarkSchema = new Schema<IForumBookmark>({
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: [true, 'Character ID is required']
  },
  itemType: {
    type: String,
    enum: {
      values: ['discussion', 'post'],
      message: 'Item type must be either "discussion" or "post"'
    },
    required: [true, 'Item type is required']
  },
  itemId: {
    type: Schema.Types.ObjectId,
    required: [true, 'Item ID is required'],
    refPath: 'itemTypeRef' // Dynamic ref based on itemType
  },
  topicSlug: {
    type: String,
    lowercase: true
  },
  discussionSlug: {
    type: String,
    lowercase: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'forum_bookmarks',
  timestamps: false // Using manual createdAt
});

// Virtual for dynamic ref
ForumBookmarkSchema.virtual('itemTypeRef').get(function() {
  return this.itemType === 'discussion' ? 'ForumDiscussion' : 'ForumPost';
});

// Indexes
ForumBookmarkSchema.index({ characterId: 1, itemType: 1, itemId: 1 }, { unique: true }); // Compound unique: can't bookmark same item twice
ForumBookmarkSchema.index({ characterId: 1, createdAt: -1 }); // For listing character's bookmarks
ForumBookmarkSchema.index({ itemType: 1, itemId: 1 }); // For checking if item is bookmarked

export const ForumBookmark = mongoose.model<IForumBookmark>('ForumBookmark', ForumBookmarkSchema);
