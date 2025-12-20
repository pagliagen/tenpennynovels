/**
 * Document Model (Simplified for Embeddings Worker)
 * Only includes fields needed for embedding updates
 */
import mongoose, { Schema } from 'mongoose';

const DocumentSchema = new Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    type: {
      type: String,
      enum: ['ambientazione', 'regolamento', 'lore'],
      required: true
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
    collection: 'documents'
  }
);

export default mongoose.model('Document', DocumentSchema);
