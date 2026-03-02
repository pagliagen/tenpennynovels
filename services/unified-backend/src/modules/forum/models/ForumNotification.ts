import mongoose, { Document, Schema } from 'mongoose';

/**
 * ForumNotification Model
 * In-app notifications for forum events
 * TTL index auto-expires notifications after 90 days
 */

export type ForumNotificationType =
  | 'new_post_in_subscribed_discussion'
  | 'character_followed_you'
  | 'reaction_on_your_post'
  | 'reply_to_your_post';

export interface IForumNotification extends Document {
  characterId: mongoose.Types.ObjectId;
  type: ForumNotificationType;
  title: string;
  message: string;
  relatedDiscussionId?: mongoose.Types.ObjectId;
  relatedPostId?: mongoose.Types.ObjectId;
  triggeredByCharacterId?: mongoose.Types.ObjectId;
  triggeredByCharacterName?: string;
  isRead: boolean;
  createdAt: Date;
}

const ForumNotificationSchema = new Schema<IForumNotification>({
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: [true, 'Character ID is required']
  },
  type: {
    type: String,
    enum: {
      values: [
        'new_post_in_subscribed_discussion',
        'character_followed_you',
        'reaction_on_your_post',
        'reply_to_your_post'
      ],
      message: 'Invalid notification type'
    },
    required: [true, 'Notification type is required']
  },
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  relatedDiscussionId: {
    type: Schema.Types.ObjectId,
    ref: 'ForumDiscussion'
  },
  relatedPostId: {
    type: Schema.Types.ObjectId,
    ref: 'ForumPost'
  },
  triggeredByCharacterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character'
  },
  triggeredByCharacterName: String,
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'forum_notifications',
  timestamps: false // Using manual createdAt
});

// Indexes
ForumNotificationSchema.index({ characterId: 1, isRead: 1, createdAt: -1 }); // For listing unread notifications (most common query)
ForumNotificationSchema.index({ characterId: 1, createdAt: -1 }); // For listing all notifications
ForumNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // TTL index: auto-delete after 90 days (7776000 seconds)

// Static method to get unread count for a character
ForumNotificationSchema.statics.getUnreadCount = async function(characterId: mongoose.Types.ObjectId): Promise<number> {
  return this.countDocuments({ characterId, isRead: false });
};

// Static method to mark all as read for a character
ForumNotificationSchema.statics.markAllAsRead = async function(characterId: mongoose.Types.ObjectId): Promise<number> {
  const result = await this.updateMany(
    { characterId, isRead: false },
    { $set: { isRead: true } }
  );
  return result.modifiedCount;
};

export const ForumNotification = mongoose.model<IForumNotification>('ForumNotification', ForumNotificationSchema);
