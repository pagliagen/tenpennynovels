import mongoose, { Schema, Document } from 'mongoose';

/**
 * OffGameThread Model
 *
 * Thread 1-to-1 per messaggi off-game (chat OOC stile WhatsApp).
 *
 * Features:
 * - Partecipanti sempre ordinati (previene duplicati A↔B vs B↔A)
 * - Soft delete per-partecipante (ogni character può cancellare indipendentemente)
 * - Conteggi unread per-partecipante
 * - Typing indicators per real-time chat UX
 * - Preview ultimo messaggio per lista thread
 */

export interface IOffGameThread extends Document {
  participants: mongoose.Types.ObjectId[]; // Sempre 2 elementi, ordinati
  lastMessageAt: Date;
  lastMessagePreview: string;
  unreadCount: Map<string, number>; // { characterId: count }
  typingIndicators: Array<{
    characterId: mongoose.Types.ObjectId;
    lastTyping: Date;
  }>;
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
  updateTypingIndicator(characterId: mongoose.Types.ObjectId): void;
  cleanStaleTypingIndicators(): void;
}

// Static methods interface
export interface IOffGameThreadModel extends mongoose.Model<IOffGameThread> {
  orderParticipants(
    participant1: mongoose.Types.ObjectId,
    participant2: mongoose.Types.ObjectId
  ): mongoose.Types.ObjectId[];
}

const OffGameThreadSchema = new Schema<IOffGameThread>(
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
    typingIndicators: [{
      characterId: {
        type: Schema.Types.ObjectId,
        ref: 'Character',
        required: true
      },
      lastTyping: {
        type: Date,
        required: true,
        default: Date.now
      }
    }],
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
    collection: 'offgame_threads'
  }
);

// Index per prevenire thread duplicati (participants ordinati)
// UNIQUE constraint assicura A↔B stesso di B↔A
OffGameThreadSchema.index({ participants: 1 }, { unique: true });

// Index per ordinamento lista thread (più recenti primi)
OffGameThreadSchema.index({ lastMessageAt: -1 });

// Index per query soft-deleted per character
OffGameThreadSchema.index({ 'deletedBy.characterId': 1 });

// Virtual per verificare se thread è cancellato da un character
OffGameThreadSchema.virtual('isDeletedBy').get(function(this: IOffGameThread) {
  return (characterId: string) => {
    return this.deletedBy.some(d => d.characterId.toString() === characterId);
  };
});

// Method per ordinare partecipanti (previene duplicati)
OffGameThreadSchema.statics.orderParticipants = function(
  participant1: mongoose.Types.ObjectId,
  participant2: mongoose.Types.ObjectId
): mongoose.Types.ObjectId[] {
  const p1 = participant1.toString();
  const p2 = participant2.toString();
  return p1 < p2 ? [participant1, participant2] : [participant2, participant1];
};

// Method per incrementare unread count
OffGameThreadSchema.methods.incrementUnreadCount = function(
  this: IOffGameThread,
  characterId: string
): void {
  const current = this.unreadCount.get(characterId) || 0;
  this.unreadCount.set(characterId, current + 1);
};

// Method per resettare unread count
OffGameThreadSchema.methods.resetUnreadCount = function(
  this: IOffGameThread,
  characterId: string
): void {
  this.unreadCount.set(characterId, 0);
};

// Method per marcare thread come cancellato da character
OffGameThreadSchema.methods.markDeletedBy = function(
  this: IOffGameThread,
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

// Method per aggiornare typing indicator
OffGameThreadSchema.methods.updateTypingIndicator = function(
  this: IOffGameThread,
  characterId: mongoose.Types.ObjectId
): void {
  // Trova o crea typing indicator per questo character
  const existingIndex = this.typingIndicators.findIndex(
    t => t.characterId.toString() === characterId.toString()
  );

  if (existingIndex !== -1) {
    // Aggiorna timestamp
    this.typingIndicators[existingIndex].lastTyping = new Date();
  } else {
    // Aggiungi nuovo indicator
    this.typingIndicators.push({
      characterId,
      lastTyping: new Date()
    });
  }
};

// Method per pulire typing indicators vecchi (> 3 secondi)
OffGameThreadSchema.methods.cleanStaleTypingIndicators = function(
  this: IOffGameThread
): void {
  const threeSecondsAgo = new Date(Date.now() - 3000);
  this.typingIndicators = this.typingIndicators.filter(
    t => t.lastTyping > threeSecondsAgo
  );
};

export const OffGameThread = mongoose.model<IOffGameThread, IOffGameThreadModel>(
  'OffGameThread',
  OffGameThreadSchema
);
