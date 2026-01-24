import mongoose, { Schema, model, Document } from 'mongoose';

export interface IBlockNotes extends Document {
  characterId: Schema.Types.ObjectId;
  locationId?: Schema.Types.ObjectId; // Optional, for location-specific notes
  content: string;
  
  updatedAt: Date;
  createdAt: Date;
}

const BlockNotesSchema = new Schema<IBlockNotes>({
  characterId: {
    type: Schema.Types.ObjectId,
    ref: 'Character',
    required: true,
    index: true
  },
  locationId: {
    type: Schema.Types.ObjectId,
    ref: 'Location',
    required: false,
    index: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  }
}, {
  timestamps: true,
  collection: 'block_notes'
});

// Compound index for efficient queries
BlockNotesSchema.index({ characterId: 1, locationId: 1 }, { unique: true, sparse: true });
BlockNotesSchema.index({ characterId: 1 });

export const BlockNotes = mongoose.models.BlockNotes || model<IBlockNotes>('BlockNotes', BlockNotesSchema);

export default BlockNotes;

