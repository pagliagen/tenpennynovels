import mongoose, { Schema, Document } from 'mongoose';

/**
 * MessageBackup Model
 *
 * Archivia messaggi soft-deleted per moderazione master e recovery.
 *
 * Features:
 * - Retention a livelli: 3 mesi on-game, 1 mese off-game
 * - Snapshot completo messaggio originale (JSON)
 * - Accesso solo-master per moderazione
 * - CRON job cleanup automatico quando retentionUntil < now
 * - Query per thread per ripristino selettivo
 */

export interface IMessageBackup extends Document {
  messageContext: 'ongame' | 'offgame';
  originalMessageId: mongoose.Types.ObjectId;
  threadId: mongoose.Types.ObjectId; // onGameThreadId o offGameThreadId

  // Snapshot messaggio completo (OnGameMessage o OffGameMessage)
  messageData: any; // Mixed type - JSON snapshot completo

  deletedAt: Date;
  deletedBy: mongoose.Types.ObjectId; // Character che ha cancellato

  retentionUntil: Date; // Auto-calcolato (deletedAt + 90g o 30g)

  createdAt: Date;
}

const MessageBackupSchema = new Schema<IMessageBackup>(
  {
    messageContext: {
      type: String,
      required: true,
      enum: ['ongame', 'offgame'],
      index: true
    },
    originalMessageId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    threadId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    messageData: {
      type: Schema.Types.Mixed,
      required: true
    },
    deletedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Character',
      required: true,
      index: true
    },
    retentionUntil: {
      type: Date,
      required: true,
      index: true // CRITICAL per CRON job cleanup
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Solo createdAt
    collection: 'message_backups'
  }
);

// Index composto per CRON job cleanup (trova expired backups)
MessageBackupSchema.index({ retentionUntil: 1, messageContext: 1 });

// Index per moderazione master (query per thread)
MessageBackupSchema.index({ threadId: 1, messageContext: 1, deletedAt: -1 });

// Index per query per character (chi ha cancellato)
MessageBackupSchema.index({ deletedBy: 1, deletedAt: -1 });

// Pre-save hook per calcolare retentionUntil
MessageBackupSchema.pre('save', function(this: IMessageBackup) {
  if (this.isNew && !this.retentionUntil) {
    // Calcola retention period basato su messageContext
    const retentionDays = this.messageContext === 'ongame' ? 90 : 30;
    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

    this.retentionUntil = new Date(this.deletedAt.getTime() + retentionMs);
  }
});

// Static method per creare backup da OnGameMessage
MessageBackupSchema.statics.createFromOnGameMessage = async function(
  message: any,
  deletedBy: mongoose.Types.ObjectId
): Promise<IMessageBackup> {
  return this.create({
    messageContext: 'ongame',
    originalMessageId: message._id,
    threadId: message.onGameThreadId,
    messageData: message.toObject(), // Snapshot completo
    deletedAt: new Date(),
    deletedBy
  });
};

// Static method per creare backup da OffGameMessage
MessageBackupSchema.statics.createFromOffGameMessage = async function(
  message: any,
  deletedBy: mongoose.Types.ObjectId
): Promise<IMessageBackup> {
  return this.create({
    messageContext: 'offgame',
    originalMessageId: message._id,
    threadId: message.offGameThreadId,
    messageData: message.toObject(), // Snapshot completo
    deletedAt: new Date(),
    deletedBy
  });
};

// Static method per cleanup expired backups (chiamato da CRON)
MessageBackupSchema.statics.cleanupExpired = async function(): Promise<number> {
  const now = new Date();
  const result = await this.deleteMany({ retentionUntil: { $lt: now } });
  return result.deletedCount || 0;
};

// Virtual per verificare se backup è expired
MessageBackupSchema.virtual('isExpired').get(function(this: IMessageBackup) {
  return this.retentionUntil < new Date();
});

// Virtual per calcolare giorni rimanenti retention
MessageBackupSchema.virtual('daysUntilExpiry').get(function(this: IMessageBackup) {
  const now = new Date();
  const diffMs = this.retentionUntil.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
});

export const MessageBackup = mongoose.model<IMessageBackup>(
  'MessageBackup',
  MessageBackupSchema
);
