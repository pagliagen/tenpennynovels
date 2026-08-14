import mongoose, { Schema, Document } from 'mongoose';

/**
 * OnGameMessage Model
 *
 * Messaggi on-game (sistema postale in-character): lettere, telegrammi, note.
 *
 * Features:
 * - Thread 1-to-1 (multi-destinatario crea messaggi separati)
 * - Solo personaggi APPROVED possono inviare
 * - Delivery config snapshot (immutabile a modifiche config runtime)
 * - Consegna programmata via CRON (scheduledDelivery)
 * - Soft delete per-utente (sender/recipient indipendenti)
 * - Costo in crediti + ritardi consegna configurabili
 */

export interface IOnGameMessage extends Document {
  onGameThreadId: mongoose.Types.ObjectId; // Riferimento a OnGameThread
  senderId: mongoose.Types.ObjectId; // Character (sempre approved)
  recipientId: mongoose.Types.ObjectId; // Character (sempre approved)

  messageType: 'letter' | 'note' | 'telegram' | 'dispatch' | 'flyer';
  subject: string;
  content: string;

  // Snapshot configurazione al momento invio (immutabile)
  deliveryConfig: {
    deliveryDelay: number; // Millisecondi
    cost: number; // Crediti
    canReply: boolean;
    displayName: string; // Nome tipo messaggio per UI
  };

  sentAt: Date;
  scheduledDelivery?: Date; // Per CRON job
  deliveredAt?: Date;

  // Soft delete per-utente
  deletedBy: {
    sender?: Date;
    recipient?: Date;
  };

  replyTo?: mongoose.Types.ObjectId; // Riferimento a messaggio originale

  // Moderation fields (AI toxicity check)
  moderationScore?: number;
  moderationLabel?: string;
  moderationModel?: string;
  moderationProcessedAt?: Date;

  createdAt: Date;
  updatedAt: Date;

  // Methods
  markDelivered(): void;
  markDeletedBySender(): void;
  markDeletedByRecipient(): void;
}

const OnGameMessageSchema = new Schema<IOnGameMessage>(
  {
    onGameThreadId: {
      type: Schema.Types.ObjectId,
      ref: 'OnGameThread',
      required: true,
      index: true
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'Character',
      required: true,
      index: true
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'Character',
      required: true,
      index: true
    },
    messageType: {
      type: String,
      required: true,
      enum: ['letter', 'note', 'telegram', 'dispatch', 'flyer']
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000
    },
    deliveryConfig: {
      deliveryDelay: {
        type: Number,
        required: true,
        min: 0
      },
      cost: {
        type: Number,
        required: true,
        min: 0
      },
      canReply: {
        type: Boolean,
        required: true
      },
      displayName: {
        type: String,
        required: true,
        trim: true
      }
    },
    sentAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    scheduledDelivery: {
      type: Date,
      sparse: true // Index sparse per CRON query
    },
    deliveredAt: {
      type: Date
    },
    deletedBy: {
      sender: {
        type: Date
      },
      recipient: {
        type: Date
      }
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'OnGameMessage'
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
    collection: 'ongame_messages'
  }
);

// Index composto per query thread messaggi (ordinati per data)
OnGameMessageSchema.index({ onGameThreadId: 1, sentAt: -1 });

// Index sparse per CRON job consegna programmata
OnGameMessageSchema.index(
  { scheduledDelivery: 1 },
  {
    sparse: true,
    partialFilterExpression: { scheduledDelivery: { $exists: true } }
  }
);

// Index per query inbox (messaggi ricevuti non cancellati)
OnGameMessageSchema.index({ recipientId: 1, 'deletedBy.recipient': 1, deliveredAt: -1 });

// Index per query sent (messaggi inviati non cancellati)
OnGameMessageSchema.index({ senderId: 1, 'deletedBy.sender': 1, sentAt: -1 });

// Virtual per verificare se consegnato
OnGameMessageSchema.virtual('isDelivered').get(function(this: IOnGameMessage) {
  return !!this.deliveredAt;
});

// Virtual per verificare se cancellato da sender
OnGameMessageSchema.virtual('isDeletedBySender').get(function(this: IOnGameMessage) {
  return !!this.deletedBy?.sender;
});

// Virtual per verificare se cancellato da recipient
OnGameMessageSchema.virtual('isDeletedByRecipient').get(function(this: IOnGameMessage) {
  return !!this.deletedBy?.recipient;
});

// Virtual per verificare se cancellato da entrambi (pronto per backup)
OnGameMessageSchema.virtual('isDeletedByBoth').get(function(this: IOnGameMessage) {
  return !!(this.deletedBy?.sender && this.deletedBy?.recipient);
});

// Method per marcare come cancellato da sender
OnGameMessageSchema.methods.markDeletedBySender = function(
  this: IOnGameMessage
): void {
  if (!this.deletedBy) {
    this.deletedBy = {};
  }
  this.deletedBy.sender = new Date();
};

// Method per marcare come cancellato da recipient
OnGameMessageSchema.methods.markDeletedByRecipient = function(
  this: IOnGameMessage
): void {
  if (!this.deletedBy) {
    this.deletedBy = {};
  }
  this.deletedBy.recipient = new Date();
};

// Method per marcare come consegnato
OnGameMessageSchema.methods.markDelivered = function(
  this: IOnGameMessage
): void {
  this.deliveredAt = new Date();
};

export const OnGameMessage = mongoose.model<IOnGameMessage>(
  'OnGameMessage',
  OnGameMessageSchema
);
