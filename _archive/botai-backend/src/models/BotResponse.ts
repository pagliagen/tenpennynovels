import { Schema, model, Document, Types } from 'mongoose';

export interface IBotResponse extends Document {
  botId: Types.ObjectId;
  triggeredByActionId: string;
  locationId: string;
  responseContent: string;
  emotionalState: {
    mood: string;
    intensity: number;
  };
  sentimentChanges: Array<{
    characterId: string;
    oldSentiment: number;
    newSentiment: number;
  }>;
  generatedAt: Date;
  postedAt?: Date;
  success: boolean;
  error?: string;
}

const BotResponseSchema = new Schema<IBotResponse>({
  botId: {
    type: Schema.Types.ObjectId,
    ref: 'Bot',
    required: true
  },
  triggeredByActionId: {
    type: String,
    required: true
  },
  locationId: {
    type: String,
    required: true
  },
  responseContent: {
    type: String,
    required: true,
    maxlength: 5000
  },
  emotionalState: {
    mood: {
      type: String,
      maxlength: 50
    },
    intensity: {
      type: Number,
      min: 1,
      max: 10
    }
  },
  sentimentChanges: [{
    characterId: {
      type: String,
      required: true
    },
    oldSentiment: {
      type: Number,
      min: -100,
      max: 100
    },
    newSentiment: {
      type: Number,
      min: -100,
      max: 100
    }
  }],
  generatedAt: {
    type: Date,
    default: Date.now
  },
  postedAt: Date,
  success: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    maxlength: 1000
  }
}, {
  timestamps: false,
  collection: 'bot_responses'
});

// Compound indexes for efficient queries
// Note: botId, locationId, and generatedAt are NOT indexed individually
// These compound indexes cover all query patterns efficiently
BotResponseSchema.index({ botId: 1, generatedAt: -1 });
BotResponseSchema.index({ locationId: 1, generatedAt: -1 });
BotResponseSchema.index({ success: 1, generatedAt: -1 });

// Export schema for use with DatabaseContext
export { BotResponseSchema };

// Export default model (for backward compatibility)
export const BotResponse = model<IBotResponse>('BotResponse', BotResponseSchema);
