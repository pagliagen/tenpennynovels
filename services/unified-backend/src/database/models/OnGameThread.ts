import mongoose, { Schema, Document } from 'mongoose';

/**
 * OnGameThread Model
 *
 * Thread 1-to-1 per messaggi on-game (sistema postale in-character).
 *
 * Features:
 * - Partecipanti sempre ordinati (previene duplicati A↔B vs B↔A)
 * - Soft delete per-partecipante (ogni character può cancellare indipendentemente)
 * - Conteggi unread per-partecipante
 * - Subject e preview ultimo messaggio per UI email-style
 */

export interface IOnGameThread extends Document {
  participants: mongoose.Types.ObjectId[]; // Sempre 2 elementi, ordinati
  lastMessageAt: Date;
  lastMessageSubject: string;
  lastMessagePreview: string;
  unreadCount: Map<string, number>; // { characterId: count }
  deletedBy: Array<{
    characterId: mongoose.Types.ObjectId;
    deletedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  incrementUnreadCount(characterId: string): void;
  resetUnreadCount(characterId: string): void;
  markDeletedBy(characterId: mongoose.Types.ObjectId): void;
}

// Static methods interface
export interface IOnGameThreadModel extends mongoose.Model<IOnGameThread> {
  orderParticipants(
    participant1: mongoose.Types.ObjectId,
    participant2: mongoose.Types.ObjectId
  ): mongoose.Types.ObjectId[];
}

const OnGameThreadSchema = new Schema<IOnGameThread>(
  {
    participants: {
      type: [Schema.Types.ObjectId],
      ref: 'Character',
      required: true,
      validate: {
        validator: function(v: mongoose.Types.ObjectId[]) {
          // Must have exactly 2 participants (1-to-1 thread)
          return v.length === 2;
        },
        message: 'Thread deve avere esattamente 2 partecipanti'
      }
    },
    lastMessageAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    lastMessageSubject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    lastMessagePreview: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: () => new Map()
    },
    deletedBy: [{
      characterId: {
        type: Schema.Types.ObjectId,
        ref: 'Character',
        required: true
      },
      deletedAt: {
        type: Date,
        required: true,
        default: Date.now
      }
    }]
  },
  {
    timestamps: true,
    collection: 'ongame_threads'
  }
);

// Index per prevenire thread duplicati (participants ordinati)
// UNIQUE constraint assicura A↔B stesso di B↔A
// CRITICAL: Compound index sui primi 2 elementi dell'array (non multikey index)
OnGameThreadSchema.index({ 'participants.0': 1, 'participants.1': 1 }, { unique: true });

// Index per ordinamento lista thread (più recenti primi)
OnGameThreadSchema.index({ lastMessageAt: -1 });

// Index per query soft-deleted per character
OnGameThreadSchema.index({ 'deletedBy.characterId': 1 });

// Virtual per verificare se thread è cancellato da un character
OnGameThreadSchema.virtual('isDeletedBy').get(function(this: IOnGameThread) {
  return (characterId: string) => {
    return this.deletedBy.some(d => d.characterId.toString() === characterId);
  };
});

// Method per ordinare partecipanti (previene duplicati)
OnGameThreadSchema.statics.orderParticipants = function(
  participant1: mongoose.Types.ObjectId,
  participant2: mongoose.Types.ObjectId
): mongoose.Types.ObjectId[] {
  const p1 = participant1.toString();
  const p2 = participant2.toString();
  return p1 < p2 ? [participant1, participant2] : [participant2, participant1];
};

// Method per incrementare unread count
OnGameThreadSchema.methods.incrementUnreadCount = function(
  this: IOnGameThread,
  characterId: string
): void {
  const current = this.unreadCount.get(characterId) || 0;
  this.unreadCount.set(characterId, current + 1);
};

// Method per resettare unread count
OnGameThreadSchema.methods.resetUnreadCount = function(
  this: IOnGameThread,
  characterId: string
): void {
  this.unreadCount.set(characterId, 0);
};

// Method per marcare thread come cancellato da character
OnGameThreadSchema.methods.markDeletedBy = function(
  this: IOnGameThread,
  characterId: mongoose.Types.ObjectId
): void {
  // Verifica se già cancellato da questo character
  const alreadyDeleted = this.deletedBy.some(
    d => d.characterId.toString() === characterId.toString()
  );

  if (!alreadyDeleted) {
    this.deletedBy.push({
      characterId,
      deletedAt: new Date()
    });
  }
};

export const OnGameThread = mongoose.model<IOnGameThread, IOnGameThreadModel>(
  'OnGameThread',
  OnGameThreadSchema
);
