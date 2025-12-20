import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for LocationAction document
export interface ILocationAction extends Document {
  actionType: 'standard' | 'master' | 'moderation' | 'whisper' | 'ooc' |
             'dice_roll' | 'skill_check' | 'stat_check' | 'item_use';
  characterId: string;
  characterName: string;
  characterSurname?: string;
  content: string;
  locationId: string;
  locationName?: string; // Populated for embedding context
  sessionId?: string; // Reference to GamingSession (auto-created, groups messages, TTL 3 hours)
  timestamp: Date;
  visibility: 'public' | 'whisper' | 'master_only';
  diceResult?: {
    dice: string;
    result: number;
    success?: boolean;
    target?: number;      // Target number for skill/stat checks
    skillName?: string;   // For skill checks
    statName?: string;    // For stat checks
  };
  itemEffect?: {
    itemId: string;
    itemName: string;
    description: string;
    consumedItems?: Array<{
      itemId: string;
      itemName: string;
      quantity: number;
    }>;
    effects?: Array<{
      type: string;
      value: number;
      duration?: string;
    }>;
  };
  targetCharacters?: string[]; // For whispers
  characterRoles: string[]; // Sender's gameplay roles

  // Semantic search fields
  contentEmbedding?: number[]; // 384-dimensional vector for semantic search
  embeddingModel?: string; // Model used for embedding generation
  embeddingGeneratedAt?: Date; // When embedding was generated
}

// LocationAction Schema
const LocationActionSchema = new Schema<ILocationAction>({
  actionType: {
    type: String,
    required: true,
    enum: ['standard', 'master', 'moderation', 'whisper', 'ooc', 
           'dice_roll', 'skill_check', 'stat_check', 'item_use']
  },
  characterId: {
    type: String,
    required: true
  },
  characterName: {
    type: String,
    required: true
  },
  characterSurname: {
    type: String,
    required: false
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  locationId: {
    type: String,
    required: true
  },
  locationName: {
    type: String,
    required: false
  },
  sessionId: {
    type: String,
    required: false,
    index: true // Index for efficient session-based queries
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  visibility: {
    type: String,
    required: true,
    enum: ['public', 'whisper', 'master_only'],
    default: 'public'
  },
  diceResult: {
    dice: { type: String },
    result: { type: Number },
    success: { type: Boolean },
    target: { type: Number },      // Target number for skill/stat checks
    skillName: { type: String },   // For skill checks
    statName: { type: String }     // For stat checks
  },
  itemEffect: {
    itemId: { type: String },
    itemName: { type: String },
    description: { type: String },
    consumedItems: [{
      itemId: { type: String },
      itemName: { type: String },
      quantity: { type: Number }
    }],
    effects: [{
      type: { type: String },
      value: { type: Number },
      duration: { type: String }
    }]
  },
  targetCharacters: [{
    type: String
  }],
  characterRoles: [{
    type: String,
    enum: ['personaggio', 'master', 'moderatore', 'gestore']
  }],

  // Semantic search fields
  contentEmbedding: {
    type: [Number],
    required: false,
    validate: {
      validator: function(v: number[]) {
        return !v || v.length === 0 || v.length === 384;
      },
      message: 'Content embedding must be exactly 384 dimensions'
    }
  },
  embeddingModel: {
    type: String,
    required: false
  },
  embeddingGeneratedAt: {
    type: Date,
    required: false
  }
}, {
  timestamps: true,
  collection: 'locationactions'
});

// Compound indexes for efficient queries
LocationActionSchema.index({ locationId: 1, timestamp: -1 });
LocationActionSchema.index({ characterId: 1, timestamp: -1 });
LocationActionSchema.index({ locationId: 1, visibility: 1, timestamp: -1 });
LocationActionSchema.index({ sessionId: 1, timestamp: -1 }); // Session-based conversation retrieval

// TTL index to auto-delete old actions after 30 days
LocationActionSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Static methods
LocationActionSchema.statics.getLocationHistory = async function(
  locationId: string, 
  characterId: string, 
  limit: number = 50
): Promise<ILocationAction[]> {
  // Get actions visible to the character
  const actions = await this.find({
    locationId,
    $or: [
      { visibility: 'public' },
      { visibility: 'whisper', $or: [
        { characterId },
        { targetCharacters: characterId }
      ]},
      { visibility: 'master_only' } // Client will filter based on roles
    ]
  })
  .sort({ timestamp: -1 })
  .limit(limit)
  .lean();

  return actions.reverse(); // Return chronological order
};

LocationActionSchema.statics.createAction = async function(actionData: Partial<ILocationAction>): Promise<ILocationAction> {
  const action = new this(actionData);
  await action.save();
  return action;
};

// Model
export const LocationAction: Model<ILocationAction> = mongoose.models.LocationAction || 
  mongoose.model<ILocationAction>('LocationAction', LocationActionSchema);

export default LocationAction;