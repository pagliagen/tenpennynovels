import { Schema, Document, model, models, type QueryFilter } from 'mongoose';

export interface IChatModerationAction extends Document {
  // Target message identification
  messageId: Schema.Types.ObjectId;
  messageType: 'location' | 'ongame' | 'offgame';
  messageCollection: string; // Collection name for reference
  
  // Original message data (snapshot for audit)
  originalMessage: {
    content: string;
    sender: {
      characterId: Schema.Types.ObjectId;
      characterName: string;
      userId?: Schema.Types.ObjectId;
    };
    recipients?: Schema.Types.ObjectId[]; // For ongame messages
    locationId?: Schema.Types.ObjectId; // For location messages
    chatId?: Schema.Types.ObjectId; // For offgame messages
    timestamp: Date;
  };
  
  // Action details
  action: 'hide' | 'delete' | 'warn_sender' | 'ban_sender' | 'edit_content' | 'flag_inappropriate' | 'restore';
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  // Modified content (for edit actions)
  modifiedContent?: string;
  
  // Moderation context
  moderatorId: Schema.Types.ObjectId; // Admin/Moderator character
  moderatorUsername: string;
  moderatorUserRoles: string[];
  moderatorCharacterRoles: string[];
  actionTakenAt: Date;
  
  // Target user information
  targetCharacterId: Schema.Types.ObjectId;
  targetCharacterName: string;
  targetUserId?: Schema.Types.ObjectId;
  
  // Duration (for temporary actions)
  duration?: number; // in minutes
  expiresAt?: Date;
  
  // Action results and status
  isActive: boolean;
  wasAppealed: boolean;
  appealedAt?: Date;
  appealReason?: string;
  appealResolvedAt?: Date;
  appealResolution?: string;
  appealResolvedBy?: Schema.Types.ObjectId;
  
  // Escalation tracking
  escalatedAt?: Date;
  escalatedBy?: Schema.Types.ObjectId;
  escalationReason?: string;
  escalationLevel: 'none' | 'supervisor' | 'admin' | 'owner';
  
  // Related actions
  parentActionId?: Schema.Types.ObjectId; // For follow-up actions
  relatedActionIds: Schema.Types.ObjectId[]; // For bulk actions
  
  // Automation flags
  isAutomaticAction: boolean;
  automaticRule?: string;
  automaticScore?: number; // Toxicity/inappropriateness score
  
  createdAt: Date;
  updatedAt: Date;
}

const ChatModerationActionSchema = new Schema<IChatModerationAction>({
  messageId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  messageType: {
    type: String,
    enum: ['location', 'ongame', 'offgame'],
    required: true,
    index: true
  },
  messageCollection: {
    type: String,
    required: true
  },
  
  originalMessage: {
    content: {
      type: String,
      required: true,
      maxlength: 10000
    },
    sender: {
      characterId: {
        type: Schema.Types.ObjectId,
        ref: 'Character',
        required: true
      },
      characterName: {
        type: String,
        required: true
      },
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    },
    recipients: [{
      type: Schema.Types.ObjectId,
      ref: 'Character'
    }],
    locationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location'
    },
    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'OffGameChat'
    },
    timestamp: {
      type: Date,
      required: true
    }
  },
  
  action: {
    type: String,
    enum: ['hide', 'delete', 'warn_sender', 'ban_sender', 'edit_content', 'flag_inappropriate', 'restore'],
    required: true,
    index: true
  },
  reason: {
    type: String,
    required: true,
    maxlength: 1000
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    index: true
  },
  
  modifiedContent: {
    type: String,
    maxlength: 10000
  },
  
  moderatorId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true,
    index: true
  },
  moderatorUsername: {
    type: String,
    required: true
  },
  moderatorUserRoles: [{
    type: String
  }],
  moderatorCharacterRoles: [{
    type: String
  }],
  actionTakenAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  targetCharacterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true,
    index: true
  },
  targetCharacterName: {
    type: String,
    required: true
  },
  targetUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  
  duration: {
    type: Number,
    min: 1,
    max: 525600 // 1 year in minutes
  },
  expiresAt: {
    type: Date,
    index: true
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  wasAppealed: {
    type: Boolean,
    default: false,
    index: true
  },
  appealedAt: Date,
  appealReason: {
    type: String,
    maxlength: 1000
  },
  appealResolvedAt: Date,
  appealResolution: {
    type: String,
    maxlength: 1000
  },
  appealResolvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character'
  },
  
  escalatedAt: Date,
  escalatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character'
  },
  escalationReason: {
    type: String,
    maxlength: 1000
  },
  escalationLevel: {
    type: String,
    enum: ['none', 'supervisor', 'admin', 'owner'],
    default: 'none',
    index: true
  },
  
  parentActionId: {
    type: Schema.Types.ObjectId,
    ref: 'ChatModerationAction'
  },
  relatedActionIds: [{
    type: Schema.Types.ObjectId,
    ref: 'ChatModerationAction'
  }],
  
  isAutomaticAction: {
    type: Boolean,
    default: false,
    index: true
  },
  automaticRule: String,
  automaticScore: {
    type: Number,
    min: 0,
    max: 100
  }
}, {
  timestamps: true,
  collection: 'chat_moderation_actions'
});

// Compound indexes for efficient querying
ChatModerationActionSchema.index({ messageType: 1, actionTakenAt: -1 });
ChatModerationActionSchema.index({ targetCharacterId: 1, actionTakenAt: -1 });
ChatModerationActionSchema.index({ moderatorId: 1, actionTakenAt: -1 });
ChatModerationActionSchema.index({ action: 1, severity: 1 });
ChatModerationActionSchema.index({ isActive: 1, expiresAt: 1 });
ChatModerationActionSchema.index({ escalationLevel: 1, actionTakenAt: -1 });

// Virtual for time until expiration
ChatModerationActionSchema.virtual('timeUntilExpiry').get(function() {
  if (!this.expiresAt) return null;
  return Math.max(0, this.expiresAt.getTime() - Date.now());
});

// Virtual for duration in human readable format
ChatModerationActionSchema.virtual('durationFormatted').get(function() {
  if (!this.duration) return 'Permanent';
  
  const hours = Math.floor(this.duration / 60);
  const minutes = this.duration % 60;
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
});

// Pre-save middleware to set expiration date
ChatModerationActionSchema.pre('save', async function() {
  if (this.duration && !this.expiresAt) {
    this.expiresAt = new Date(this.actionTakenAt.getTime() + (this.duration * 60 * 1000));
  }
});

// Method to check if action has expired
ChatModerationActionSchema.methods.hasExpired = function(): boolean {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

// Method to expire the action
ChatModerationActionSchema.methods.expire = function(): Promise<IChatModerationAction> {
  this.isActive = false;
  return this.save();
};

// Method to escalate the action
ChatModerationActionSchema.methods.escalate = function(
  escalatedBy: string,
  reason: string,
  level: 'supervisor' | 'admin' | 'owner'
): Promise<IChatModerationAction> {
  this.escalatedAt = new Date();
  this.escalatedBy = escalatedBy;
  this.escalationReason = reason;
  this.escalationLevel = level;
  return this.save();
};

// Static method to find active actions by message
ChatModerationActionSchema.statics.findActiveByMessage = function(messageId: string, messageType: string) {
  return this.find({
    messageId,
    messageType,
    isActive: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  } as unknown as QueryFilter<IChatModerationAction>);
};

// Static method to find actions by target character
ChatModerationActionSchema.statics.findByTargetCharacter = function(characterId: string) {
  return this.find({ targetCharacterId: characterId } as unknown as QueryFilter<IChatModerationAction>).sort({ actionTakenAt: -1 });
};

export const ChatModerationAction = models.ChatModerationAction || model<IChatModerationAction>('ChatModerationAction', ChatModerationActionSchema);