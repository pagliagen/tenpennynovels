import mongoose, { Schema, Document, Types } from 'mongoose';

export type MemoryType = 'interaction' | 'observation' | 'emotional' | 'event';

export interface IMemory extends Document {
  botId: Types.ObjectId;
  externalCharacterId: string;
  characterName: string;
  summary: string;
  sentiment: string;
  type: MemoryType;
  importance: number;
  locationId: string;
  timestamp: Date;
}

const MemorySchema = new Schema<IMemory>({
  botId: { type: Schema.Types.ObjectId, ref: 'Bot', required: true, index: true },
  externalCharacterId: { type: String, default: '' },
  characterName: { type: String, required: true },
  summary: { type: String, required: true },
  sentiment: { type: String, default: 'neutral' },
  type: { type: String, enum: ['interaction', 'observation', 'emotional', 'event'], default: 'interaction' },
  importance: { type: Number, default: 50, min: 0, max: 100 },
  locationId: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
});

MemorySchema.index({ botId: 1, externalCharacterId: 1 });
MemorySchema.index({ botId: 1, locationId: 1 });
MemorySchema.index({ botId: 1, importance: -1 });

export const Memory = mongoose.model<IMemory>('Memory', MemorySchema);
