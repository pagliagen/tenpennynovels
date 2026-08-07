import mongoose, { Schema, model, Document } from 'mongoose';

/**
 * Note private del personaggio proprietario su un personaggio incontrato in gioco.
 * Distinto da CharacterRelation (relazioni IC pubbliche/mutual-approval): qui il
 * proprietario scrive quello che il SUO personaggio sa/pensa dell'altro, senza che
 * l'altro giocatore ne sia a conoscenza o debba approvare nulla.
 */
export interface ICharacterEncounterNote extends Document {
  ownerCharacterId: Schema.Types.ObjectId;
  targetCharacterId?: Schema.Types.ObjectId; // personaggio censito, se selezionabile
  targetName: string; // nome libero, sempre presente (fallback se targetCharacterId non è settato)
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const CharacterEncounterNoteSchema = new Schema<ICharacterEncounterNote>({
  ownerCharacterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  targetCharacterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character'
  },
  targetName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  notes: {
    type: String,
    required: true,
    trim: true,
    maxlength: 10000
  }
}, {
  timestamps: true,
  collection: 'character_encounter_notes'
});

CharacterEncounterNoteSchema.index({ ownerCharacterId: 1, updatedAt: -1 });

export const CharacterEncounterNote = mongoose.models.CharacterEncounterNote ||
  model<ICharacterEncounterNote>('CharacterEncounterNote', CharacterEncounterNoteSchema);

export default CharacterEncounterNote;
