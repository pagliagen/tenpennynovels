import { Schema, Document, model, models } from 'mongoose';

export interface IBroadcastMessage extends Document {
  // Message content
  message: string;
  type: 'info' | 'warning' | 'emergency';
  urgent: boolean;

  // Target audience
  targetAudience: 'all' | 'online' | 'role_specific';
  targetRoles?: string[];
  targetCount: number; // Number of users who received the message

  // Sender information
  sentBy: {
    userId?: Schema.Types.ObjectId;
    characterId?: Schema.Types.ObjectId;
    username: string;
    characterName?: string;
    userRoles: string[];
  };

  // Timestamps
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BroadcastMessageSchema = new Schema<IBroadcastMessage>({
  message: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 5000
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'emergency'],
    default: 'info',
    required: true,
    index: true
  },
  urgent: {
    type: Boolean,
    default: false
  },
  targetAudience: {
    type: String,
    enum: ['all', 'online', 'role_specific'],
    default: 'all',
    required: true,
    index: true
  },
  targetRoles: {
    type: [String],
    default: []
  },
  targetCount: {
    type: Number,
    default: 0,
    required: true
  },
  sentBy: {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    characterId: {
      type: Schema.Types.ObjectId,
      ref: 'Character'
    },
    username: {
      type: String,
      required: true
    },
    characterName: String,
    userRoles: {
      type: [String],
      default: []
    }
  },
  sentAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'broadcast_messages'
});

// Indexes for efficient querying
BroadcastMessageSchema.index({ sentAt: -1 }); // Most recent first
BroadcastMessageSchema.index({ type: 1, sentAt: -1 }); // Filter by type
BroadcastMessageSchema.index({ 'sentBy.userId': 1, sentAt: -1 }); // Messages by user
BroadcastMessageSchema.index({ targetAudience: 1, sentAt: -1 }); // Filter by audience

// Export the model
export const BroadcastMessage = models.BroadcastMessage || model<IBroadcastMessage>('BroadcastMessage', BroadcastMessageSchema);
