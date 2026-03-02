import mongoose, { Schema, Document } from 'mongoose';

export interface IOnGameMessage extends Document {
  messageType: string; // Reference to postal-system.json configuration
  from: Schema.Types.ObjectId; // Character ID
  to: Schema.Types.ObjectId[]; // Recipient Character IDs
  subject: string;
  content: string;

  // Postal System
  sentAt: Date;
  scheduledDelivery?: Date; // For cron job processing
  deliveredAt?: Date;

  // Delivery Configuration
  deliveryTarget: {
    type: 'character' | 'residence';
    requiresKnownResidence: boolean;
  };
  sentFromLocation: Schema.Types.ObjectId; // Location where message was sent

  // Costs and Properties
  postageCharged: number; // in pence
  isExpress: boolean;
  sealed: boolean;

  // Message Chain
  replyTo?: Schema.Types.ObjectId; // Reference to original message
  conversationId?: string; // Group related messages
  
  // System fields
  createdAt: Date;
  updatedAt: Date;
}

const OnGameMessageSchema = new Schema<IOnGameMessage>({
  messageType: {
    type: String,
    required: true,
    enum: ['note', 'telegram', 'letter', 'express_letter', 'postcard', 'invitation', 'official_document', 'diary']
  },
  from: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  to: [{
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  }],
  subject: {
    type: String,
    required: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000 // Max for diary
  },
  
  // Postal System
  sentAt: {
    type: Date,
    default: Date.now
  },
  scheduledDelivery: {
    type: Date
  },
  deliveredAt: {
    type: Date
  },
  
  // Delivery Configuration
  deliveryTarget: {
    type: {
      type: String,
      enum: ['character', 'residence'],
      required: true
    },
    requiresKnownResidence: {
      type: Boolean,
      default: false
    }
  },
  sentFromLocation: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    required: true
  },
  
  // Costs and Properties
  postageCharged: {
    type: Number,
    min: 0,
    default: 0
  },
  isExpress: {
    type: Boolean,
    default: false
  },
  sealed: {
    type: Boolean,
    default: false
  },
  
  // Message Chain
  replyTo: {
    type: Schema.Types.ObjectId,
    ref: 'OnGameMessage'
  },
  conversationId: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
OnGameMessageSchema.index({ from: 1, sentAt: -1 });
OnGameMessageSchema.index({ to: 1, deliveredAt: -1 });
OnGameMessageSchema.index({ scheduledDelivery: 1 }, { 
  partialFilterExpression: { scheduledDelivery: { $exists: true } } 
});
OnGameMessageSchema.index({ messageType: 1 });
OnGameMessageSchema.index({ conversationId: 1 }, { 
  partialFilterExpression: { conversationId: { $exists: true } } 
});

export const OnGameMessage = mongoose.models.OnGameMessage || mongoose.model<IOnGameMessage>('OnGameMessage', OnGameMessageSchema);