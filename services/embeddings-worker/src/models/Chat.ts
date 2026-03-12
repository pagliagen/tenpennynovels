/**
 * Chat Model (Simplified for Embeddings Worker)
 * Only includes fields needed for embedding updates
 */
import mongoose, { Schema } from 'mongoose';

const ChatSchema = new Schema(
  {
    characterId: { type: String, required: true },
    locationId: { type: String, required: true },
    content: { type: String, required: true },
    actionType: { type: String, required: true },
    locationName: {
      type: String,
      required: false
    },
    contentEmbedding: {
      type: [Number],
      required: false,
      validate: {
        validator: function (v: number[]) {
          return !v || v.length === 0 || v.length === 384;
        },
        message: 'Embedding must be 384 dimensions'
      }
    },
    embeddingModel: {
      type: String,
      required: false
    },
    embeddingGeneratedAt: {
      type: Date,
      required: false
    }
  },
  {
    timestamps: true,
    collection: 'chats',
    strict: false
  }
);

export default mongoose.model('Chat', ChatSchema);
