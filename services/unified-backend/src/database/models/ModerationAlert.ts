import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IModerationAlert extends Document {
  source: 'chat' | 'forum';
  chatId?: string;
  forumPostId?: string;
  characterId: string;
  characterName: string;
  locationId?: string;
  locationName?: string;
  locationSlug?: string;
  topicSlug?: string;
  discussionSlug?: string;
  content: string;
  toxicityScore: number;
  moderationLabel: string;
  moderationModel: string;

  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned';
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  actionTaken?: string;

  createdAt: Date;
  updatedAt: Date;
}

const ModerationAlertSchema = new Schema<IModerationAlert>({
  source: {
    type: String,
    required: true,
    enum: ['chat', 'forum'],
    default: 'chat'
  },
  chatId: {
    type: String,
    required: false,
    index: true
  },
  forumPostId: {
    type: String,
    required: false,
    index: true
  },
  characterId: {
    type: String,
    required: true
  },
  characterName: {
    type: String,
    required: true
  },
  locationId: {
    type: String,
    required: false
  },
  locationName: {
    type: String,
    required: false
  },
  locationSlug: {
    type: String,
    required: false
  },
  topicSlug: {
    type: String,
    required: false
  },
  discussionSlug: {
    type: String,
    required: false
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  toxicityScore: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  moderationLabel: {
    type: String,
    required: true,
    enum: ['toxic', 'not-toxic']
  },
  moderationModel: {
    type: String,
    required: true
  },

  status: {
    type: String,
    required: true,
    enum: ['pending', 'reviewed', 'dismissed', 'actioned'],
    default: 'pending'
  },
  reviewedBy: {
    type: String,
    required: false
  },
  reviewedAt: {
    type: Date,
    required: false
  },
  reviewNotes: {
    type: String,
    required: false,
    maxlength: 1000
  },
  actionTaken: {
    type: String,
    required: false,
    enum: ['warning', 'message_hidden', 'message_deleted', 'none']
  }
}, {
  timestamps: true,
  collection: 'moderation_alerts'
});

ModerationAlertSchema.index({ source: 1, status: 1, createdAt: -1 });
ModerationAlertSchema.index({ characterId: 1, createdAt: -1 });
ModerationAlertSchema.index({ locationId: 1, createdAt: -1 });

export const ModerationAlert: Model<IModerationAlert> = mongoose.models.ModerationAlert ||
  mongoose.model<IModerationAlert>('ModerationAlert', ModerationAlertSchema);

export default ModerationAlert;
