import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for LocationAction document
export interface ILocationAction extends Document {
  actionType: 'standard' | 'master' | 'moderation' | 'whisper' | 'ooc' |
             'dice_roll' | 'skill_check' | 'stat_check' | 'item_use';
  characterId: string;
  characterName: string;
  characterSurname?: string;
  isBot: boolean; // indica se l'azione è stata eseguita da un bot
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
  characterRoles: string[]; // Sender's gameplay roles (stores gameplayRoles values: player, approved-player, master, moderatore)

  // Tag for action zone (REQUIRED - indicates where action takes place, must be one of location's tags)
  tags: string;
  
  // Edit history for tracking modifications
  editHistory?: Array<{
    content: string;
    editedAt: Date;
    editedBy: string;
  }>;
  
  // Social conflict data
  socialConflict?: {
    type: string;
    attackerSkill: string;
    defenderSkill: string;
    attackerRoll: number;
    defenderRoll: number;
    result: string;
    attackerSuccessDegree?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';
    defenderSuccessDegree?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';
    messageForDefender?: string; // Message shown to defender when they detect something
    visibleToDefenderOnly?: boolean; // If true, only defender can see this conflict result
  };
  
  // Success degree for skill/stat checks
  successDegree?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';
  
  // Action mode fields
  isHidden?: boolean; // For actions hidden during action mode
  revealedAt?: Date; // When action is revealed after action mode

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
  isBot: {
    type: Boolean,
    default: false,
    required: true
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
    enum: ['player', 'approved-player', 'master', 'moderatore']
  }],

  // Tag (REQUIRED - must specify which zone the action takes place in)
  tags: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 50
  },
  
  // Edit history
  editHistory: [{
    content: {
      type: String,
      required: true
    },
    editedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    editedBy: {
      type: String,
      required: true
    }
  }],
  
  // Social conflict
  socialConflict: {
    type: {
      type: String
    },
    attackerSkill: String,
    defenderSkill: String,
    attackerRoll: Number,
    defenderRoll: Number,
    result: String,
    attackerSuccessDegree: {
      type: String,
      enum: ['critical', 'extreme', 'hard', 'normal', 'failure', 'fumble']
    },
    defenderSuccessDegree: {
      type: String,
      enum: ['critical', 'extreme', 'hard', 'normal', 'failure', 'fumble']
    },
    messageForDefender: String,
    visibleToDefenderOnly: Boolean
  },
  
  // Success degree
  successDegree: {
    type: String,
    enum: ['critical', 'extreme', 'hard', 'normal', 'failure', 'fumble']
  },
  
  // Action mode fields
  isHidden: {
    type: Boolean,
    default: false
  },
  revealedAt: Date,

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
  limit: number = 50,
  sessionId?: string
): Promise<ILocationAction[]> {
  // Build query filter
  const filter: any = {
    locationId,
    $or: [
      { visibility: 'public' },
      { visibility: 'whisper', $or: [
        { characterId },
        { targetCharacters: characterId }
      ]},
      { visibility: 'master_only' } // Client will filter based on roles
    ]
  };

  // Filter by sessionId if provided (only show actions from current session)
  if (sessionId) {
    filter.sessionId = sessionId;
  }

  // Get actions visible to the character
  const actions = await this.find(filter)
  .sort({ timestamp: -1 })
  .limit(limit)
  .lean();

  // Normalize actions: ensure tags field is always present (as string)
  const normalizedActions = actions.map((action: any) => ({
    ...action,
    tags: action.tags || ''
  }));

  return normalizedActions.reverse(); // Return chronological order
};

LocationActionSchema.statics.createAction = async function(actionData: Partial<ILocationAction>): Promise<ILocationAction> {
  const action = new this(actionData);
  await action.save();
  return action;
};

// ========== HOOKS ==========

/**
 * Post-save hook: Trigger embedding generation
 */
LocationActionSchema.post('save', async function(doc) {
  try {
    const { publishLocationActionEvent } = await import('@shared/services/EmbeddingEventPublisher');
    const action = doc.isNew ? 'created' : 'updated';

    await publishLocationActionEvent(action, {
      _id: doc._id.toString(),
      characterId: doc.characterId,
      characterName: doc.characterName,
      locationId: doc.locationId,
      content: doc.content,
      actionType: doc.actionType
    });
  } catch (error) {
    console.error('[LocationAction] Failed to publish embedding event:', error);
  }
});

/**
 * Post-delete hooks: Trigger embedding cleanup
 */
LocationActionSchema.post('deleteOne', async function(doc) {
  try {
    const { publishLocationActionDeletedEvent } = await import('@shared/services/EmbeddingEventPublisher');
    await publishLocationActionDeletedEvent(doc._id.toString());
  } catch (error) {
    console.error('[LocationAction] Failed to publish delete event:', error);
  }
});

LocationActionSchema.post('findOneAndDelete', async function(doc) {
  if (!doc) return;
  try {
    const { publishLocationActionDeletedEvent } = await import('@shared/services/EmbeddingEventPublisher');
    await publishLocationActionDeletedEvent(doc._id.toString());
  } catch (error) {
    console.error('[LocationAction] Failed to publish delete event:', error);
  }
});

// Model
export const LocationAction: Model<ILocationAction> = mongoose.models.LocationAction ||
  mongoose.model<ILocationAction>('LocationAction', LocationActionSchema);

export default LocationAction;