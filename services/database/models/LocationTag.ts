import mongoose, { Schema, model, Document } from 'mongoose';

export interface ILocationTag extends Document {
  name: string;
  category?: string;
  isActive: boolean;
  createdBy: Schema.Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

const LocationTagSchema = new Schema<ILocationTag>({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: 50
  },
  category: {
    type: String,
    trim: true,
    maxlength: 50
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  collection: 'location_tags'
});

// Indexes
LocationTagSchema.index({ name: 1 });
LocationTagSchema.index({ category: 1 });
LocationTagSchema.index({ isActive: 1 });

export const LocationTag = mongoose.models.LocationTag || model<ILocationTag>('LocationTag', LocationTagSchema);

export default LocationTag;

