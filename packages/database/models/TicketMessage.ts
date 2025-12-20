import mongoose, { Schema, Document, ObjectId } from 'mongoose';

export interface ITicketMessage extends Document {
  _id: ObjectId;
  ticketId: ObjectId; // Reference to Ticket
  content: string;
  sender: {
    type: 'character' | 'staff';
    id: ObjectId;
    name: string;
  };
  sentAt: Date;
  isInternal: boolean; // Note interne staff (non visibili al personaggio)
  readAt?: {
    character?: Date;
    staff?: Date;
  };
  
  // System fields
  createdAt: Date;
  updatedAt: Date;
}

const TicketMessageSchema = new Schema<ITicketMessage>({
  ticketId: {
    type: Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000,
    trim: true
  },
  sender: {
    type: {
      type: String,
      enum: ['character', 'staff'],
      required: true
    },
    id: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: function(this: ITicketMessage) {
        return this.sender.type === 'character' ? 'Character' : 'User';
      }
    },
    name: {
      type: String,
      required: true,
      maxlength: 100
    }
  },
  sentAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  isInternal: {
    type: Boolean,
    required: true,
    default: false,
    index: true
  },
  readAt: {
    character: {
      type: Date
    },
    staff: {
      type: Date
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
TicketMessageSchema.index({ ticketId: 1, sentAt: -1 }); // For ticket thread chronological order
TicketMessageSchema.index({ ticketId: 1, isInternal: 1, sentAt: -1 }); // For filtering internal notes
TicketMessageSchema.index({ 'sender.type': 1, 'sender.id': 1, sentAt: -1 }); // For user's message history
TicketMessageSchema.index({ ticketId: 1, 'readAt.character': 1 }); // For unread messages tracking (character)
TicketMessageSchema.index({ ticketId: 1, 'readAt.staff': 1 }); // For unread messages tracking (staff)

// Compound index for staff dashboard - internal notes filtering
TicketMessageSchema.index({ 
  ticketId: 1, 
  isInternal: 1, 
  'sender.type': 1, 
  sentAt: -1 
});

// Text search index for message content
TicketMessageSchema.index({
  content: 'text'
}, {
  name: 'message_content_search'
});

// Virtual for determining if message is from current user
TicketMessageSchema.virtual('isFromCurrentUser').get(function() {
  // This will be set by the application logic when fetching messages
  return false; // Default value, will be computed in API responses
});

// Static methods for common queries
TicketMessageSchema.statics.findByTicket = function(ticketId: ObjectId, includeInternal: boolean = false) {
  const query: any = { ticketId };
  if (!includeInternal) {
    query.isInternal = false;
  }
  return this.find(query).sort({ sentAt: 1 });
};

TicketMessageSchema.statics.findUnreadByTicketForCharacter = function(ticketId: ObjectId) {
  return this.find({
    ticketId,
    isInternal: false, // Characters can't see internal messages
    'readAt.character': { $exists: false },
    'sender.type': 'staff' // Only count staff messages as unread for character
  }).sort({ sentAt: 1 });
};

TicketMessageSchema.statics.findUnreadByTicketForStaff = function(ticketId: ObjectId) {
  return this.find({
    ticketId,
    'readAt.staff': { $exists: false },
    'sender.type': 'character' // Only count character messages as unread for staff
  }).sort({ sentAt: 1 });
};

TicketMessageSchema.statics.countUnreadByTicketForCharacter = function(ticketId: ObjectId) {
  return this.countDocuments({
    ticketId,
    isInternal: false,
    'readAt.character': { $exists: false },
    'sender.type': 'staff'
  });
};

TicketMessageSchema.statics.countUnreadByTicketForStaff = function(ticketId: ObjectId) {
  return this.countDocuments({
    ticketId,
    'readAt.staff': { $exists: false },
    'sender.type': 'character'
  });
};

TicketMessageSchema.statics.findInternalNotes = function(ticketId: ObjectId) {
  return this.find({
    ticketId,
    isInternal: true
  }).sort({ sentAt: -1 });
};

TicketMessageSchema.statics.getLastMessageByTicket = function(ticketId: ObjectId, includeInternal: boolean = false) {
  const query: any = { ticketId };
  if (!includeInternal) {
    query.isInternal = false;
  }
  return this.findOne(query).sort({ sentAt: -1 });
};

// Method to mark message as read by character
TicketMessageSchema.methods.markAsReadByCharacter = function() {
  if (!this.readAt) {
    this.readAt = {};
  }
  this.readAt.character = new Date();
  return this.save();
};

// Method to mark message as read by staff
TicketMessageSchema.methods.markAsReadByStaff = function() {
  if (!this.readAt) {
    this.readAt = {};
  }
  this.readAt.staff = new Date();
  return this.save();
};

// Pre-save middleware to validate internal notes
TicketMessageSchema.pre('save', function(next) {
  // Only staff can send internal notes
  if (this.isInternal && this.sender.type !== 'staff') {
    const error = new Error('Only staff can send internal notes');
    return next(error);
  }
  
  // Internal notes should not have character read tracking
  if (this.isInternal && this.readAt?.character) {
    delete this.readAt.character;
  }
  
  next();
});

// Pre-save middleware to ensure content is not empty
TicketMessageSchema.pre('save', function(next) {
  if (!this.content || this.content.trim().length === 0) {
    const error = new Error('Message content cannot be empty');
    return next(error);
  }
  next();
});

export const TicketMessage = mongoose.models.TicketMessage || mongoose.model<ITicketMessage>('TicketMessage', TicketMessageSchema);