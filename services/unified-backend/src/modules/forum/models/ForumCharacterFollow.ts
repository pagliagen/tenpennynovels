import mongoose, { Document, Schema } from 'mongoose';

/**
 * ForumCharacterFollow Model
 * Junction table for character-to-character follows
 * Enables seeing forum activity of followed characters
 */

export interface IForumCharacterFollow extends Document {
  followerId: mongoose.Types.ObjectId; // Character doing the following
  followedId: mongoose.Types.ObjectId; // Character being followed
  createdAt: Date;
}

const ForumCharacterFollowSchema = new Schema<IForumCharacterFollow>({
  followerId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: [true, 'Follower character ID is required']
  },
  followedId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: [true, 'Followed character ID is required']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'forum_character_follows',
  timestamps: false // Using manual createdAt
});

// Indexes
ForumCharacterFollowSchema.index({ followerId: 1, followedId: 1 }, { unique: true }); // Compound unique: can't follow same character twice
ForumCharacterFollowSchema.index({ followedId: 1 }); // For counting followers (reverse lookup)
ForumCharacterFollowSchema.index({ followerId: 1, createdAt: -1 }); // For listing who a character follows

// Validation: Prevent self-follows
ForumCharacterFollowSchema.pre('save', function() {
  if (this.followerId.equals(this.followedId)) {
    throw new Error('Cannot follow yourself');
  }
});

export const ForumCharacterFollow = mongoose.model<IForumCharacterFollow>('ForumCharacterFollow', ForumCharacterFollowSchema);
