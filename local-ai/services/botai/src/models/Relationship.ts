import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IRelationship extends Document {
  botId: Types.ObjectId;
  externalCharacterId: string;
  characterName: string;
  trust: number;
  familiarity: number;
  sentiment: number;
  interactionCount: number;
  significantEvents: string[];
  lastInteraction: Date;
}

const RelationshipSchema = new Schema<IRelationship>({
  botId: { type: Schema.Types.ObjectId, ref: 'Bot', required: true, index: true },
  externalCharacterId: { type: String, default: '' },
  characterName: { type: String, required: true },
  trust: { type: Number, default: 0.5, min: 0, max: 1 },
  familiarity: { type: Number, default: 0, min: 0, max: 1 },
  sentiment: { type: Number, default: 0, min: -1, max: 1 },
  interactionCount: { type: Number, default: 0 },
  significantEvents: { type: [String], default: [] },
  lastInteraction: { type: Date, default: Date.now },
});

RelationshipSchema.index({ botId: 1, externalCharacterId: 1 }, { unique: true });

export const Relationship = mongoose.model<IRelationship>('Relationship', RelationshipSchema);
