/**
 * Location Model (Simplified for Embeddings Worker)
 * Only includes fields needed for embedding context
 */
import mongoose, { Schema } from 'mongoose';

const LocationSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String }
  },
  {
    timestamps: true,
    collection: 'locations'
  }
);

export default mongoose.model('Location', LocationSchema);
