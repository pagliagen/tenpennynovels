import { Schema, Document, model, models, type QueryFilter } from 'mongoose';

export interface IMessageReport extends Document {
  // Reported message information
  messageId: Schema.Types.ObjectId;
  messageType: 'location' | 'ongame' | 'offgame';
  messageCollection: string;
  
  // Message snapshot (for audit trail)
  messageSnapshot: {
    content: string;
    senderId: Schema.Types.ObjectId;
    senderName: string;
    timestamp: Date;
    locationId?: Schema.Types.ObjectId; // For location messages
    chatId?: Schema.Types.ObjectId; // For offgame messages
    recipients?: Schema.Types.ObjectId[]; // For ongame messages
  };
  
  // Reporter information
  reportedBy: Schema.Types.ObjectId; // Character who reported
  reporterName: string;
  reporterUserId: Schema.Types.ObjectId;
  
  // Report details
  reportReason: 'harassment' | 'inappropriate_content' | 'spam' | 'offensive_language' | 'threat' | 'explicit_content' | 'other';
  reportDescription: string;
  reportCategory: 'gameplay' | 'ooc' | 'technical' | 'rules_violation';
  
  // Additional context
  additionalContext?: string;
  relatedMessageIds?: Schema.Types.ObjectId[]; // For context or pattern reports
  
  // Report status
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed' | 'escalated';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  
  // Review information
  reviewedBy?: Schema.Types.ObjectId; // Moderator who reviewed
  reviewerName?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  
  // Resolution
  resolution?: 'no_action' | 'warning_issued' | 'content_removed' | 'user_banned' | 'content_edited' | 'escalated_further';
  resolutionNotes?: string;
  moderationActionIds: Schema.Types.ObjectId[]; // References to ChatModerationAction documents
  
  // Escalation
  escalatedAt?: Date;
  escalationReason?: string;
  escalatedTo?: Schema.Types.ObjectId; // Higher authority
  
  // Automatic analysis
  automaticFlags?: {
    toxicityScore?: number;
    profanityDetected?: boolean;
    spamLikelihood?: number;
    languageFlags?: string[];
  };
  
  // Similar reports tracking
  similarReportIds: Schema.Types.ObjectId[];
  isPartOfPattern: boolean;
  patternId?: string; // Groups related reports
  
  // Timeline tracking
  reportedAt: Date;
  acknowledgedAt?: Date; // When moderator first saw it
  responseTime?: number; // Minutes from report to first action
  
  createdAt: Date;
  updatedAt: Date;
}

const MessageReportSchema = new Schema<IMessageReport>({
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
  
  messageSnapshot: {
    content: {
      type: String,
      required: true,
      maxlength: 10000
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'Character',
      required: true
    },
    senderName: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      required: true
    },
    locationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location'
    },
    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'OffGameChat'
    },
    recipients: [{
      type: Schema.Types.ObjectId,
      ref: 'Character'
    }]
  },
  
  reportedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true,
    index: true
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
  
  reportReason: {
    type: String,
    enum: ['harassment', 'inappropriate_content', 'spam', 'offensive_language', 'threat', 'explicit_content', 'other'],
    required: true,
    index: true
  },
  reportDescription: {
    type: String,
    required: true,
    maxlength: 2000
  },
  reportCategory: {
    type: String,
    enum: ['gameplay', 'ooc', 'technical', 'rules_violation'],
    required: true,
    index: true
  },
  
  additionalContext: {
    type: String,
    maxlength: 2000
  },
  relatedMessageIds: [{
    type: Schema.Types.ObjectId
  }],
  
  status: {
    type: String,
    enum: ['pending', 'under_review', 'resolved', 'dismissed', 'escalated'],
    default: 'pending',
    required: true,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    required: true,
    index: true
  },
  
  reviewedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    index: true
  },
  reviewerName: String,
  reviewedAt: {
    type: Date,
    index: true
  },
  reviewNotes: {
    type: String,
    maxlength: 2000
  },
  
  resolution: {
    type: String,
    enum: ['no_action', 'warning_issued', 'content_removed', 'user_banned', 'content_edited', 'escalated_further'],
    index: true
  },
  resolutionNotes: {
    type: String,
    maxlength: 2000
  },
  moderationActionIds: [{
    type: Schema.Types.ObjectId,
    ref: 'ChatModerationAction'
  }],
  
  escalatedAt: Date,
  escalationReason: {
    type: String,
    maxlength: 1000
  },
  escalatedTo: {
    type: Schema.Types.ObjectId,
    ref: 'Character'
  },
  
  automaticFlags: {
    toxicityScore: {
      type: Number,
      min: 0,
      max: 100
    },
    profanityDetected: Boolean,
    spamLikelihood: {
      type: Number,
      min: 0,
      max: 100
    },
    languageFlags: [String]
  },
  
  similarReportIds: [{
    type: Schema.Types.ObjectId,
    ref: 'MessageReport'
  }],
  isPartOfPattern: {
    type: Boolean,
    default: false,
    index: true
  },
  patternId: {
    type: String,
    index: true
  },
  
  reportedAt: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  acknowledgedAt: Date,
  responseTime: Number // in minutes
}, {
  timestamps: true,
  collection: 'message_reports'
});

// Compound indexes for efficient querying
MessageReportSchema.index({ status: 1, priority: -1, reportedAt: -1 });
MessageReportSchema.index({ messageType: 1, reportReason: 1 });
MessageReportSchema.index({ reportedBy: 1, reportedAt: -1 });
MessageReportSchema.index({ 'messageSnapshot.senderId': 1, reportedAt: -1 });
MessageReportSchema.index({ reviewedBy: 1, reviewedAt: -1 });
MessageReportSchema.index({ patternId: 1, isPartOfPattern: 1 });

// Virtual for days since reported
MessageReportSchema.virtual('daysSinceReported').get(function() {
  return Math.floor((Date.now() - this.reportedAt.getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual for response time in human readable format
MessageReportSchema.virtual('responseTimeFormatted').get(function() {
  if (!this.responseTime) return 'Not yet responded';
  
  const hours = Math.floor(this.responseTime / 60);
  const minutes = this.responseTime % 60;
  
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

// Pre-save middleware to calculate response time
MessageReportSchema.pre('save', async function() {
  if (this.acknowledgedAt && !this.responseTime) {
    this.responseTime = Math.round((this.acknowledgedAt.getTime() - this.reportedAt.getTime()) / (1000 * 60));
  }
});

// Method to acknowledge report
MessageReportSchema.methods.acknowledge = function(reviewerId: string, reviewerName: string): Promise<IMessageReport> {
  this.reviewedBy = reviewerId;
  this.reviewerName = reviewerName;
  this.acknowledgedAt = new Date();
  this.status = 'under_review';
  
  // Calculate response time
  this.responseTime = Math.round((this.acknowledgedAt.getTime() - this.reportedAt.getTime()) / (1000 * 60));
  
  return this.save();
};

// Method to resolve report
MessageReportSchema.methods.resolve = function(
  resolution: string,
  notes: string,
  moderationActionIds: string[] = []
): Promise<IMessageReport> {
  this.resolution = resolution;
  this.resolutionNotes = notes;
  this.moderationActionIds = moderationActionIds;
  this.status = 'resolved';
  
  return this.save();
};

// Method to escalate report
MessageReportSchema.methods.escalate = function(
  reason: string,
  escalatedTo: string
): Promise<IMessageReport> {
  this.escalatedAt = new Date();
  this.escalationReason = reason;
  this.escalatedTo = escalatedTo;
  this.status = 'escalated';
  this.priority = 'urgent';
  
  return this.save();
};

// Static method to find pending reports by priority
MessageReportSchema.statics.findPending = function(priority?: string) {
  const filter: any = { status: 'pending' };
  if (priority) filter.priority = priority;
  
  return this.find(filter).sort({ priority: -1, reportedAt: 1 });
};

// Static method to find reports by pattern
MessageReportSchema.statics.findByPattern = function(patternId: string) {
  return this.find({ patternId, isPartOfPattern: true }).sort({ reportedAt: -1 });
};

// Static method to find reports about a specific sender
MessageReportSchema.statics.findBySender = function(senderId: string) {
  return this.find({ 'messageSnapshot.senderId': senderId } as unknown as QueryFilter<IMessageReport>).sort({ reportedAt: -1 });
};

export const MessageReport = models.MessageReport || model<IMessageReport>('MessageReport', MessageReportSchema);