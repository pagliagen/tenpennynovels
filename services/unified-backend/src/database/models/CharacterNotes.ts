import mongoose, { Schema, model, Document } from 'mongoose';

export interface ICharacterNotes extends Document {
  characterId: Schema.Types.ObjectId;
  locationId?: Schema.Types.ObjectId;
  content: string;
  
  updatedAt: Date;
  createdAt: Date;
}

const CharacterNotesSchema = new Schema<ICharacterNotes>({
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true
  },
  locationId: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    required: false
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  }
}, {
  timestamps: true,
  collection: 'character_notes'
});

CharacterNotesSchema.index({ characterId: 1, locationId: 1 }, { unique: true, sparse: true });

export const CharacterNotes = mongoose.models.CharacterNotes || model<ICharacterNotes>('CharacterNotes', CharacterNotesSchema);

export default CharacterNotes;
