import { Schema, Document, model, models, Types } from 'mongoose';

/**
 * UserReport Model
 * User-submitted reports for chat moderation (collection: user_reports)
 */

export interface IUserReport extends Document {
  // Report identification
  reportId: string; // Unique report ID
  messageId: Types.ObjectId;
  messageType: 'location' | 'ongame' | 'offgame';
  messageCollection: string;

  // Reporter information
  reporterId: Types.ObjectId; // Character ID
  reporterName: string;
  reporterUserId: Types.ObjectId; // User ID

  // Reported user information
  reportedCharacterId: Types.ObjectId;
  reportedCharacterName: string;
  reportedUserId?: Types.ObjectId;

  // Report details
  category: 'harassment' | 'spam' | 'inappropriate_content' | 'cheating' | 'other';
  reason: string; // Detailed explanation
  severity: 'low' | 'medium' | 'high' | 'urgent';

  // Message context
  messageContent: string; // Copy of the reported message
  messageTimestamp: Date;
  locationId?: Types.ObjectId; // For location messages
  chatId?: Types.ObjectId; // For offgame messages

  // Report status
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  assignedTo?: Types.ObjectId; // Admin/Moderator ID
  assignedUsername?: string;

  // Processing information
  actionTaken?: Types.ObjectId; // Reference to ChatModerationAction

  // Priority scoring
  priorityScore: number; // 1-10, calculated based on severity, reporter history, etc.
  isUrgent: boolean;

  // Follow-up
  adminNotes?: string;
  resolution?: string;
  resolvedAt?: Date;
  resolvedBy?: Schema.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const UserReportSchema = new Schema<IUserReport>({
  reportId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  messageId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  messageType: {
    type: String,
    enum: ['location', 'ongame', 'offgame'],
    required: true
  },
  messageCollection: {
    type: String,
    required: true
  },

  reporterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  reporterName: {
    type: String,
    required: true
  },
  reporterUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  reportedCharacterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  reportedCharacterName: {
    type: String,
    required: true
  },
  reportedUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  category: {
    type: String,
    enum: ['harassment', 'spam', 'inappropriate_content', 'cheating', 'other'],
    required: true
  },
  reason: {
    type: String,
    required: true,
    maxlength: 2000
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    required: true
  },

  messageContent: {
    type: String,
    required: true
  },
  messageTimestamp: {
    type: Date,
    required: true
  },
  locationId: {
    type: Schema.Types.ObjectId,
    ref: 'Location'
  },
  chatId: {
    type: Schema.Types.ObjectId
  },

  status: {
    type: String,
    enum: ['pending', 'investigating', 'resolved', 'dismissed'],
    default: 'pending'
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'Character'
  },
  assignedUsername: {
    type: String
  },

  actionTaken: {
    type: Schema.Types.ObjectId,
    ref: 'ChatModerationAction'
  },

  priorityScore: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  isUrgent: {
    type: Boolean,
    default: false
  },

  adminNotes: {
    type: String,
    maxlength: 2000
  },
  resolution: {
    type: String,
    maxlength: 1000
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character'
  }
}, {
  timestamps: true,
  collection: 'user_reports'
});

// Indexes for performance
UserReportSchema.index({ status: 1, priorityScore: -1 });
UserReportSchema.index({ reportedCharacterId: 1, createdAt: -1 });
UserReportSchema.index({ reporterId: 1, createdAt: -1 });
UserReportSchema.index({ assignedTo: 1, status: 1 });
UserReportSchema.index({ category: 1, severity: 1 });

export const UserReport = models.UserReport || model<IUserReport>('UserReport', UserReportSchema);
