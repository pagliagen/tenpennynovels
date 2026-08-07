import mongoose, { Schema, model, Document } from 'mongoose';

/**
 * Note scritte dal master su un personaggio (tab "Note Master" della scheda).
 * Distinto da Character.reviewHistory, che è l'audit trail del workflow di
 * approvazione (action/feedback tipizzati per stats/skills/background) e non
 * va riusato per annotazioni libere: schema e scopo sono diversi.
 */
export interface ICharacterMasterNote extends Document {
  characterId: Schema.Types.ObjectId;
  authorId: Schema.Types.ObjectId;
  authorName: string;
  category: 'general' | 'damage';
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const CharacterMasterNoteSchema = new Schema<ICharacterMasterNote>({
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  authorId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  authorName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['general', 'damage'],
    default: 'general'
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10000
  }
}, {
  timestamps: true,
  collection: 'character_master_notes'
});

CharacterMasterNoteSchema.index({ characterId: 1, createdAt: -1 });
CharacterMasterNoteSchema.index({ characterId: 1, category: 1, createdAt: -1 });

export const CharacterMasterNote = mongoose.models.CharacterMasterNote ||
  model<ICharacterMasterNote>('CharacterMasterNote', CharacterMasterNoteSchema);

export default CharacterMasterNote;
