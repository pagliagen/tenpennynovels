import mongoose, { Schema, Document } from 'mongoose';

/**
 * OffGameChat Model (LEGACY SYSTEM - Coexists with OffGameThread)
 *
 * NOTE: This is the ORIGINAL off-game chat system that supports:
 * - Group chats (multiple participants)
 * - Admin roles
 * - Chat names
 * - Message retention configuration
 *
 * Used by:
 * - Character review notifications (CharacterReviewEventHandler)
 * - Legacy /offgame-chats API endpoints
 *
 * The NEW messaging system (OffGameThread + OffGameMessage) is being built
 * for simple 1-to-1 thread-based messaging. Both systems coexist during migration.
 *
 * TODO: Migrate CharacterReviewEventHandler to use OffGameThread
 * TODO: Deprecate /offgame-chats endpoints in favor of /offgame-threads
 */
export interface IOffGameChat extends Document {
  type: 'direct' | 'group';
  name?: string; // Solo per gruppi
  participants: mongoose.Types.ObjectId[]; // Array di character IDs
  admins: mongoose.Types.ObjectId[]; // Solo per gruppi - character IDs con ruolo admin
  createdBy: mongoose.Types.ObjectId; // Character ID del creatore
  createdAt: Date;
  lastMessage?: mongoose.Types.ObjectId; // Reference al ultimo messaggio
  lastActivity: Date;
  isActive: boolean; // Per soft delete
  messageRetentionDays: number; // Default 30, configurabile per chat
}

const OffGameChatSchema = new Schema<IOffGameChat>({
  type: {
    type: String,
    enum: ['direct', 'group'],
    required: true
  },
  name: {
    type: String,
    required: function(this: IOffGameChat) {
      return this.type === 'group';
    },
    maxlength: 100,
    trim: true
  },
  participants: [{
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  }],
  admins: [{
    type: Schema.Types.ObjectId,
    ref: 'Character'
  }],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastMessage: {
    type: Schema.Types.ObjectId,
    ref: 'OffGameChatMessage'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  messageRetentionDays: {
    type: Number,
    default: 30,
    min: 1,
    max: 365
  }
}, {
  timestamps: true
});

// Index for efficient queries
OffGameChatSchema.index({ participants: 1, isActive: 1 });
OffGameChatSchema.index({ type: 1, isActive: 1 });
OffGameChatSchema.index({ lastActivity: -1 });

// Virtual per contare partecipanti
OffGameChatSchema.virtual('participantCount').get(function(this: IOffGameChat) {
  return this.participants.length;
});

// Metodo per verificare se un character è admin
OffGameChatSchema.methods.isAdmin = function(this: IOffGameChat, characterId: mongoose.Types.ObjectId) {
  return this.admins.some(adminId => adminId.equals(characterId));
};

// Metodo per verificare se un character è partecipante
OffGameChatSchema.methods.isParticipant = function(this: IOffGameChat, characterId: mongoose.Types.ObjectId) {
  return this.participants.some(participantId => participantId.equals(characterId));
};

export const OffGameChat = mongoose.models.OffGameChat || mongoose.model<IOffGameChat>('OffGameChat', OffGameChatSchema);
