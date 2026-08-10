import mongoose, { Schema, model, Document } from 'mongoose';

/**
 * Voce del diario classico del personaggio: note libere scritte dal giocatore,
 * private (visibili solo al proprietario e ai master). Distinto da CharacterNotes
 * (blob singolo per location) e da CharacterRelation (relazioni IC pubbliche/mutual-approval).
 */
export interface ICharacterDiaryEntry extends Document {
  characterId: Schema.Types.ObjectId;
  title: string;
  content: string;
  entryDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CharacterDiaryEntrySchema = new Schema<ICharacterDiaryEntry>({
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10000
  },
  entryDate: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'character_diary_entries'
});

CharacterDiaryEntrySchema.index({ characterId: 1, entryDate: -1 });

export const CharacterDiaryEntry = mongoose.models.CharacterDiaryEntry ||
  model<ICharacterDiaryEntry>('CharacterDiaryEntry', CharacterDiaryEntrySchema);

export default CharacterDiaryEntry;
