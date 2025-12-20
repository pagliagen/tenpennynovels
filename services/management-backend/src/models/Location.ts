import mongoose, { Schema, model, Document } from 'mongoose';

export interface ILocation extends Document {
  name: string;
  description?: string;
  parentLocation?: Schema.Types.ObjectId;
  visible: boolean;
  chat: boolean;
  shop: boolean;
  private: boolean;
  coordinates?: {
    x: number;
    y: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  parentLocation: {
    type: Schema.Types.ObjectId,
    ref: 'Location'
  },
  visible: {
    type: Boolean,
    default: true
  },
  chat: {
    type: Boolean,
    default: false
  },
  shop: {
    type: Boolean,
    default: false
  },
  private: {
    type: Boolean,
    default: false
  },
  coordinates: {
    x: { type: Number },
    y: { type: Number }
  }
}, {
  timestamps: true,
  collection: 'locations'
});

// Indexes
LocationSchema.index({ visible: 1 });
LocationSchema.index({ parentLocation: 1 });
LocationSchema.index({ name: 1 });

export const Location = mongoose.models.Location || model<ILocation>('Location', LocationSchema);