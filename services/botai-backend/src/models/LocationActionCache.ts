import { Schema, model, Document, Types } from 'mongoose';

export interface ILocationActionCache extends Document {
  actionId: string; // ID originale da game-backend
  locationId: string;
  sessionId?: string; // Session ID for conversation history tracking
  characterId: string;
  characterName: string;
  actionType: string;
  content: string;
  timestamp: Date;
  tags?: string;
  visibility: string;
  processedByBots: Types.ObjectId[]; // quali bot hanno già visto questa azione
  cachedAt: Date;
}

const LocationActionCacheSchema = new Schema<ILocationActionCache>({
  actionId: {
    type: String,
    required: true,
    unique: true
  },
  locationId: {
    type: String,
    required: true
  },
  sessionId: {
    type: String,
    required: false
  },
  characterId: {
    type: String,
    required: true
  },
  characterName: {
    type: String,
    required: true,
    maxlength: 100
  },
  actionType: {
    type: String,
    required: true,
    maxlength: 50
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  timestamp: {
    type: Date,
    required: true
  },
  tags: {
    type: String,
    required: false,
    maxlength: 50
  },
  visibility: {
    type: String,
    enum: ['public', 'whisper', 'master_only'],
    default: 'public'
  },
  processedByBots: [{
    type: Schema.Types.ObjectId,
    ref: 'Bot'
  }],
  cachedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false,
  collection: 'location_action_cache'
});

// Compound indexes for efficient queries
// Note: locationId, sessionId, timestamp, and cachedAt are NOT indexed individually
// These compound indexes cover all query patterns efficiently
LocationActionCacheSchema.index({ locationId: 1, timestamp: -1 });
LocationActionCacheSchema.index({ locationId: 1, cachedAt: -1 });
LocationActionCacheSchema.index({ sessionId: 1, timestamp: -1 }); // For session history queries
LocationActionCacheSchema.index({ locationId: 1, characterId: 1, timestamp: -1 }); // For character action history

// Export schema for use with DatabaseContext
export { LocationActionCacheSchema };

// Export default model (for backward compatibility)
export const LocationActionCache = model<ILocationActionCache>('LocationActionCache', LocationActionCacheSchema);
