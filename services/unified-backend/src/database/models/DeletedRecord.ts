import mongoose, { Schema, model, Document, Types } from 'mongoose';

export interface IDeletedRecord extends Document {
  originalCollection: string;
  originalId: Types.ObjectId;
  displayName: string;
  data: Record<string, any>;
  deletedAt: Date;
  deletedBy?: Types.ObjectId;
  deletedByName: string;
  deletedByType: 'Character' | 'User';
  deletionReason?: string;
  originalKeys: Record<string, any>;
}

const DeletedRecordSchema = new Schema<IDeletedRecord>({
  originalCollection: {
    type: String,
    required: true,
    trim: true
  },
  originalId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  data: {
    type: Schema.Types.Mixed,
    required: true
  },
  deletedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  deletedBy: {
    type: Schema.Types.ObjectId,
    required: false
  },
  deletedByName: {
    type: String,
    required: true,
    trim: true
  },
  deletedByType: {
    type: String,
    enum: ['Character', 'User'],
    required: true
  },
  deletionReason: {
    type: String,
    trim: true
  },
  originalKeys: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: false,
  collection: 'deleted_records'
});

DeletedRecordSchema.index({ originalCollection: 1, deletedAt: -1 });
DeletedRecordSchema.index({ originalCollection: 1, originalId: 1 });
DeletedRecordSchema.index({ deletedAt: -1 });

export const DeletedRecord = mongoose.models.DeletedRecord || model<IDeletedRecord>('DeletedRecord', DeletedRecordSchema);
