import mongoose, { Schema, Document } from 'mongoose';

export interface IOffGameChatMessage extends Document {
  chatId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId; // Character ID
  content: string;
  messageType: 'text' | 'system'; // system per messaggi come "X si è unito al gruppo"
  replyTo?: mongoose.Types.ObjectId; // Reference ad altro messaggio per reply
  editedAt?: Date;
  deletedAt?: Date;
  sentAt: Date;
  deliveredTo: mongoose.Types.ObjectId[]; // Character IDs che hanno ricevuto il messaggio
  readBy: Array<{
    characterId: mongoose.Types.ObjectId;
    readAt: Date;
  }>;
  isReadBy(characterId: mongoose.Types.ObjectId): boolean;
  markAsRead(characterId: mongoose.Types.ObjectId): void;
}

const OffGameChatMessageSchema = new Schema<IOffGameChatMessage>({
  chatId: {
    type: Schema.Types.ObjectId,
    ref: 'OffGameChat',
    required: true
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['text', 'system'],
    default: 'text'
  },
  replyTo: {
    type: Schema.Types.ObjectId,
    ref: 'OffGameChatMessage'
  },
  editedAt: {
    type: Date
  },
  deletedAt: {
    type: Date
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  deliveredTo: [{
    type: Schema.Types.ObjectId,
    ref: 'Character'
  }],
  readBy: [{
    characterId: {
      type: Schema.Types.ObjectId,
      ref: 'Character',
      required: true
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index per query efficienti
OffGameChatMessageSchema.index({ chatId: 1, sentAt: -1 });
OffGameChatMessageSchema.index({ senderId: 1 });
OffGameChatMessageSchema.index({ sentAt: -1 });
OffGameChatMessageSchema.index({ deletedAt: 1 }); // Per filtrare messaggi cancellati

// Virtual per controllare se il messaggio è stato modificato
OffGameChatMessageSchema.virtual('isEdited').get(function(this: IOffGameChatMessage) {
  return !!this.editedAt;
});

// Virtual per controllare se il messaggio è stato cancellato
OffGameChatMessageSchema.virtual('isDeleted').get(function(this: IOffGameChatMessage) {
  return !!this.deletedAt;
});

// Metodo per verificare se un character ha letto il messaggio
OffGameChatMessageSchema.methods.isReadBy = function(this: IOffGameChatMessage, characterId: mongoose.Types.ObjectId) {
  return this.readBy.some(read => read.characterId.equals(characterId));
};

// Metodo per marcare messaggio come letto da un character
OffGameChatMessageSchema.methods.markAsRead = function(this: IOffGameChatMessage, characterId: mongoose.Types.ObjectId) {
  if (!this.isReadBy(characterId)) {
    this.readBy.push({
      characterId,
      readAt: new Date()
    });
  }
};

export const OffGameChatMessage = mongoose.models.OffGameChatMessage || mongoose.model<IOffGameChatMessage>('OffGameChatMessage', OffGameChatMessageSchema);