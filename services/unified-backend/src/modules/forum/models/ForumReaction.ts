import mongoose, { Document, Schema } from 'mongoose';

/**
 * ForumReaction Model
 * Individual reactions to forum posts
 * Each character can only have ONE reaction per post (compound unique index)
 * Updates ForumPost.reactionCounts denormalized field atomically
 */

export type ReactionType = 'like' | 'love' | 'laugh' | 'think';

export interface IForumReaction extends Document {
  postId: mongoose.Types.ObjectId;
  characterId: mongoose.Types.ObjectId;
  reactionType: ReactionType;
  createdAt: Date;
}

const ForumReactionSchema = new Schema<IForumReaction>({
  postId: {
    type: Schema.Types.ObjectId,
    ref: 'ForumPost',
    required: [true, 'Post ID is required']
  },
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: [true, 'Character ID is required']
  },
  reactionType: {
    type: String,
    enum: {
      values: ['like', 'love', 'laugh', 'think'],
      message: 'Reaction type must be one of: like, love, laugh, think'
    },
    required: [true, 'Reaction type is required']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'forum_reactions',
  timestamps: false // Using manual createdAt
});

// Indexes
ForumReactionSchema.index({ postId: 1, characterId: 1 }, { unique: true }); // Compound unique: one reaction per character per post
ForumReactionSchema.index({ postId: 1, reactionType: 1 }); // For counting reactions by type
ForumReactionSchema.index({ characterId: 1, createdAt: -1 }); // For listing character's reactions

// Static method to get reaction counts for a post
ForumReactionSchema.statics.getCountsForPost = async function(postId: mongoose.Types.ObjectId) {
  const counts = await this.aggregate([
    { $match: { postId } },
    {
      $group: {
        _id: '$reactionType',
        count: { $sum: 1 }
      }
    }
  ]);

  // Convert to { like: 5, love: 2, laugh: 0, think: 1 } format
  const result = { like: 0, love: 0, laugh: 0, think: 0 };
  counts.forEach((item: any) => {
    result[item._id as ReactionType] = item.count;
  });

  return result;
};

export const ForumReaction = mongoose.model<IForumReaction>('ForumReaction', ForumReactionSchema);
