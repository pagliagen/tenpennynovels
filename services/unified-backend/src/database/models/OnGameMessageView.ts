import mongoose, { Schema, Document } from 'mongoose';

export interface IOnGameMessageView extends Document {
  messageId: Schema.Types.ObjectId; // Reference to OnGameMessage
  characterId: Schema.Types.ObjectId; // Character who owns this view
  viewType: 'inbox' | 'outbox'; // Inbox for recipients, outbox for sender
  
  // Personal Management (Gmail-style)
  isRead: boolean;
  readAt?: Date;
  isDeleted: boolean; // Soft delete - only affects this view
  isArchived: boolean;
  isStarred: boolean;
  customFolder?: string;
  personalNotes?: string;
  
  // Delivery Status (only for outbox views)
  deliveryStatus?: 'draft' | 'sent' | 'in_transit' | 'delivered' | 'read' | 'failed';
  deliveryAttempts?: number;
  deliveryError?: string;
  
  // Tracking timestamps
  deliveredAt?: Date;
  viewedAt?: Date; // When this character last viewed this message
  
  // System fields
  createdAt: Date;
  updatedAt: Date;
}

const OnGameMessageViewSchema = new Schema<IOnGameMessageView>({
  messageId: {
    type: Schema.Types.ObjectId,
    ref: 'OnGameMessage',
    required: true
  },
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  viewType: {
    type: String,
    enum: ['inbox', 'outbox'],
    required: true
  },
  
  // Personal Management
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isStarred: {
    type: Boolean,
    default: false
  },
  customFolder: {
    type: String,
    maxlength: 50
  },
  personalNotes: {
    type: String,
    maxlength: 500
  },
  
  // Delivery Status (outbox only)
  deliveryStatus: {
    type: String,
    enum: ['draft', 'sent', 'in_transit', 'delivered', 'read', 'failed']
  },
  deliveryAttempts: {
    type: Number,
    default: 0
  },
  deliveryError: {
    type: String
  },
  
  // Tracking
  deliveredAt: {
    type: Date
  },
  viewedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Composite indexes for efficient queries
OnGameMessageViewSchema.index({ characterId: 1, viewType: 1, isDeleted: 1 });
OnGameMessageViewSchema.index({ characterId: 1, viewType: 1, isRead: 1 });
OnGameMessageViewSchema.index({ characterId: 1, viewType: 1, isArchived: 1 });
OnGameMessageViewSchema.index({ characterId: 1, customFolder: 1 });
OnGameMessageViewSchema.index({ messageId: 1, characterId: 1 }, { unique: true }); // One view per message per character
OnGameMessageViewSchema.index({ deliveryStatus: 1 }, { 
  partialFilterExpression: { viewType: 'outbox' } 
});

// Methods for message management
OnGameMessageViewSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

OnGameMessageViewSchema.methods.toggleStar = function() {
  this.isStarred = !this.isStarred;
  return this.save();
};

OnGameMessageViewSchema.methods.moveToFolder = function(folder: string) {
  this.customFolder = folder;
  return this.save();
};

OnGameMessageViewSchema.methods.softDelete = function() {
  this.isDeleted = true;
  return this.save();
};

OnGameMessageViewSchema.methods.restore = function() {
  this.isDeleted = false;
  return this.save();
};

export const OnGameMessageView = mongoose.models.OnGameMessageView || mongoose.model<IOnGameMessageView>('OnGameMessageView', OnGameMessageViewSchema);