import mongoose, { Schema, Document } from 'mongoose';

export interface IOffGameChatParticipant extends Document {
  chatId: mongoose.Types.ObjectId;
  characterId: mongoose.Types.ObjectId;
  role: 'member' | 'admin' | 'owner';
  joinedAt: Date;
  leftAt?: Date;
  mutedUntil?: Date;
  lastSeenMessageId?: mongoose.Types.ObjectId;
  lastSeenAt?: Date;
  isActive: boolean; // false se ha lasciato la chat
}

const OffGameChatParticipantSchema = new Schema<IOffGameChatParticipant>({
  chatId: {
    type: Schema.Types.ObjectId,
    ref: 'OffGameChat',
    required: true
  },
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  role: {
    type: String,
    enum: ['member', 'admin', 'owner'],
    default: 'member'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  leftAt: {
    type: Date
  },
  mutedUntil: {
    type: Date
  },
  lastSeenMessageId: {
    type: Schema.Types.ObjectId,
    ref: 'OffGameChatMessage'
  },
  lastSeenAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index per query efficienti
OffGameChatParticipantSchema.index({ chatId: 1, isActive: 1 });
OffGameChatParticipantSchema.index({ characterId: 1, isActive: 1 });
OffGameChatParticipantSchema.index({ chatId: 1, characterId: 1 }, { unique: true });

// Virtual per controllare se è mutato
OffGameChatParticipantSchema.virtual('isMuted').get(function(this: IOffGameChatParticipant) {
  return this.mutedUntil && this.mutedUntil > new Date();
});

// Virtual per controllare se ha permessi di admin
OffGameChatParticipantSchema.virtual('canModerate').get(function(this: IOffGameChatParticipant) {
  return this.role === 'admin' || this.role === 'owner';
});

// Metodo per lasciare la chat
OffGameChatParticipantSchema.methods.leave = function(this: IOffGameChatParticipant) {
  this.leftAt = new Date();
  this.isActive = false;
};

// Metodo per mutare fino a una data
OffGameChatParticipantSchema.methods.muteUntil = function(this: IOffGameChatParticipant, until: Date) {
  this.mutedUntil = until;
};

// Metodo per unmutare
OffGameChatParticipantSchema.methods.unmute = function(this: IOffGameChatParticipant) {
  this.mutedUntil = undefined;
};

export const OffGameChatParticipant = mongoose.models.OffGameChatParticipant || mongoose.model<IOffGameChatParticipant>('OffGameChatParticipant', OffGameChatParticipantSchema);