import mongoose, { Schema, model, Document } from 'mongoose';

/**
 * Segmento narrativo di chat "standard" in una location: si apre al primo
 * messaggio di un gruppo di personaggi e si chiude deterministicamente dopo
 * 60' di silenzio (vedi ChatSceneService.closeStaleScenes). Più scene possono
 * restare aperte in parallelo nella stessa location — le sottoposizioni
 * (Chat.position) sono cosmetiche e non incidono su questo confine.
 */
export interface IChatScene extends Document {
  locationId: string;
  locationName?: string;
  participantCharacterIds: string[];
  startedAt: Date;
  lastActivityAt: Date;
  status: 'open' | 'closed';
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSceneSchema = new Schema<IChatScene>({
  locationId: {
    type: String,
    required: true
  },
  locationName: {
    type: String,
    required: false
  },
  participantCharacterIds: {
    type: [String],
    default: []
  },
  startedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  lastActivityAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open'
  },
  closedAt: Date
}, {
  timestamps: true,
  collection: 'chat_scenes'
});

ChatSceneSchema.index({ locationId: 1, status: 1 });
ChatSceneSchema.index({ status: 1, lastActivityAt: 1 });
ChatSceneSchema.index({ participantCharacterIds: 1 });

export const ChatScene = mongoose.models.ChatScene ||
  model<IChatScene>('ChatScene', ChatSceneSchema);

export default ChatScene;
