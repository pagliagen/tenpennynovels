import { Schema, model, Document, Types } from 'mongoose';

export interface IBotMemory extends Document {
  botId: Types.ObjectId;
  locationId: string;
  type: 'conversation' | 'event' | 'observation';
  content: string;
  participants: string[]; // character IDs coinvolti
  emotionalImpact: number; // -10 a 10
  importance: number; // 0-100
  embedding?: number[]; // vector embedding per semantic search
  timestamp: Date;
  relatedMemories?: Types.ObjectId[]; // riferimenti ad altre memorie
}

const BotMemorySchema = new Schema<IBotMemory>({
  botId: {
    type: Schema.Types.ObjectId,
    ref: 'Bot',
    required: true
  },
  locationId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['conversation', 'event', 'observation'],
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  participants: [{
    type: String,
    maxlength: 100
  }],
  emotionalImpact: {
    type: Number,
    min: -10,
    max: 10,
    default: 0
  },
  importance: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  embedding: [{
    type: Number
  }],
  timestamp: {
    type: Date,
    default: Date.now
  },
  relatedMemories: [{
    type: Schema.Types.ObjectId,
    ref: 'BotMemory'
  }]
}, {
  timestamps: false,
  collection: 'bot_memories'
});

// Compound indexes for efficient queries
// Note: botId, locationId, and timestamp are NOT indexed individually
// These compound indexes cover all query patterns efficiently
BotMemorySchema.index({ botId: 1, timestamp: -1 });
BotMemorySchema.index({ botId: 1, locationId: 1, timestamp: -1 });
BotMemorySchema.index({ botId: 1, importance: -1, timestamp: -1 });

// Export schema for use with DatabaseContext
export { BotMemorySchema };

// Export default model (for backward compatibility)
export const BotMemory = model<IBotMemory>('BotMemory', BotMemorySchema);
