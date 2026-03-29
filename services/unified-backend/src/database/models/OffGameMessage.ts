import mongoose, { Schema, Document } from 'mongoose';

/**
 * OffGameMessage Model
 *
 * Messaggi off-game (chat OOC stile WhatsApp per coordinamento giocatori).
 *
 * Features:
 * - Thread 1-to-1 real-time
 * - Tutti gli stati character possono inviare (anche draft/pending)
 * - Consegna immediata WebSocket
 * - Cronologia modifiche (edit history)
 * - Conferme lettura (doppia spunta WhatsApp)
 * - Soft delete con migrazione automatica backup (retention 1 mese)
 */

export interface IOffGameMessage extends Document {
  offGameThreadId: mongoose.Types.ObjectId; // Riferimento a OffGameThread
  senderId: mongoose.Types.ObjectId; // Character (qualsiasi stato)

  content: string;

  editHistory: Array<{
    content: string;
    editedAt: Date;
  }>;

  readBy: Array<{
    characterId: mongoose.Types.ObjectId;
    readAt: Date;
  }>;

  deletedAt?: Date; // Soft delete (sposta a MessageBackup dopo retention)

  replyTo?: mongoose.Types.ObjectId; // Per citazione/risposta

  // Moderation fields (AI toxicity check)
  moderationScore?: number;
  moderationLabel?: string;
  moderationModel?: string;
  moderationProcessedAt?: Date;

  createdAt: Date;
  updatedAt: Date;

  // Methods
  isReadBy(characterId: mongoose.Types.ObjectId): boolean;
  markAsRead(characterId: mongoose.Types.ObjectId): void;
  editContent(newContent: string): void;
  markDeleted(): void;
}

const OffGameMessageSchema = new Schema<IOffGameMessage>(
  {
    offGameThreadId: {
      type: Schema.Types.ObjectId,
      ref: 'OffGameThread',
      required: true,
      index: true
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'Character',
      required: true,
      index: true
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    editHistory: [{
      content: {
        type: String,
        required: true,
        trim: true
      },
      editedAt: {
        type: Date,
        required: true,
        default: Date.now
      }
    }],
    readBy: [{
      characterId: {
        type: Schema.Types.ObjectId,
        ref: 'Character',
        required: true
      },
      readAt: {
        type: Date,
        required: true,
        default: Date.now
      }
    }],
    deletedAt: {
      type: Date,
      sparse: true
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'OffGameMessage'
    },

    // Moderation fields (AI toxicity check)
    moderationScore: {
      type: Number,
      min: 0,
      max: 1
    },
    moderationLabel: {
      type: String,
      enum: ['toxic', 'not-toxic']
    },
    moderationModel: {
      type: String
    },
    moderationProcessedAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    collection: 'offgame_messages'
  }
);

// Index composto per query thread messaggi (ordinati per data, escludi cancellati)
OffGameMessageSchema.index({ offGameThreadId: 1, createdAt: -1, deletedAt: 1 });

// Index sparse per CRON job cleanup backup (messaggi soft-deleted)
OffGameMessageSchema.index(
  { deletedAt: 1 },
  {
    sparse: true,
    partialFilterExpression: { deletedAt: { $exists: true } }
  }
);

// Index per query messaggi non letti da character
OffGameMessageSchema.index({ 'readBy.characterId': 1 });

// Virtual per verificare se messaggio è stato modificato
OffGameMessageSchema.virtual('isEdited').get(function(this: IOffGameMessage) {
  return this.editHistory && this.editHistory.length > 0;
});

// Virtual per verificare se messaggio è cancellato
OffGameMessageSchema.virtual('isDeleted').get(function(this: IOffGameMessage) {
  return !!this.deletedAt;
});

// Method per verificare se character ha letto il messaggio
OffGameMessageSchema.methods.isReadBy = function(
  this: IOffGameMessage,
  characterId: mongoose.Types.ObjectId
): boolean {
  return this.readBy.some(read => read.characterId.equals(characterId));
};

// Method per marcare messaggio come letto da character
OffGameMessageSchema.methods.markAsRead = function(
  this: IOffGameMessage,
  characterId: mongoose.Types.ObjectId
): void {
  if (!this.isReadBy(characterId)) {
    this.readBy.push({
      characterId,
      readAt: new Date()
    });
  }
};

// Method per modificare contenuto (salva in edit history)
OffGameMessageSchema.methods.editContent = function(
  this: IOffGameMessage,
  newContent: string
): void {
  // Salva contenuto corrente in edit history
  if (!this.editHistory) {
    this.editHistory = [];
  }

  this.editHistory.push({
    content: this.content,
    editedAt: new Date()
  });

  // Aggiorna contenuto
  this.content = newContent;
};

// Method per marcare come cancellato (soft delete)
OffGameMessageSchema.methods.markDeleted = function(
  this: IOffGameMessage
): void {
  this.deletedAt = new Date();
};

export const OffGameMessage = mongoose.model<IOffGameMessage>(
  'OffGameMessage',
  OffGameMessageSchema
);
