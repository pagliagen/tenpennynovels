import mongoose, { Schema, model, Document } from 'mongoose';

/**
 * Copia personale, editabile, di una ChatScene chiusa: creata da
 * ChatSceneService.closeScene() per ogni personaggio partecipante, una per
 * scena. Indipendente dalle copie degli altri personaggi anche se derivano
 * dalla stessa conversazione (stesso sourceSceneId) - titolo e riassunto
 * sono privati al personaggio proprietario.
 */
export interface ICharacterChatScene extends Document {
  characterId: string;
  sourceSceneId: string; // _id (stringa) della ChatScene "ancora" che ha originato la fork
  locationId: string;
  locationName?: string;
  title: string;
  summary?: string;
  startedAt: Date;
  closedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CharacterChatSceneSchema = new Schema<ICharacterChatScene>({
  characterId: {
    type: String,
    required: true
  },
  sourceSceneId: {
    type: String,
    required: true
  },
  locationId: {
    type: String,
    required: true
  },
  locationName: {
    type: String,
    required: false
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  summary: {
    type: String,
    required: false,
    trim: true,
    maxlength: 10000
  },
  startedAt: {
    type: Date,
    required: true
  },
  closedAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true,
  collection: 'character_chat_scenes'
});

CharacterChatSceneSchema.index({ characterId: 1, startedAt: -1 });

export const CharacterChatScene = mongoose.models.CharacterChatScene ||
  model<ICharacterChatScene>('CharacterChatScene', CharacterChatSceneSchema);

export default CharacterChatScene;
