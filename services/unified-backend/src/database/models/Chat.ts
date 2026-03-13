import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChat extends Document {
  actionType: 'standard' | 'master' | 'moderation' | 'whisper' | 'ooc' |
             'dice_roll' | 'skill_check' | 'stat_check' | 'item_use';
  characterId: string;
  characterName: string;
  characterSurname?: string;
  characterAvatar?: string;
  isBot: boolean;
  content: string;
  locationId: string;
  locationName?: string;
  sessionId?: string;
  timestamp: Date;
  visibility: 'public' | 'whisper' | 'master_only';
  diceResult?: {
    dice: string;
    result: number;
    success?: boolean;
    target?: number;
    skillName?: string;
    statName?: string;
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
  targetCharacters?: string[];
  characterRoles: string[];

  position?: string;
  
  editHistory?: Array<{
    content: string;
    editedAt: Date;
    editedBy: string;
  }>;
  
  socialConflict?: {
    type: string;
    attackerSkill: string;
    defenderSkill: string;
    attackerRoll: number;
    defenderRoll: number;
    result: string;
    attackerSuccessDegree?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';
    defenderSuccessDegree?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';
    messageForDefender?: string;
    visibleToDefenderOnly?: boolean;
  };
  
  successDegree?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';
  
  isHidden?: boolean;
  revealedAt?: Date;

  contentEmbedding?: number[];
  embeddingModel?: string;
  embeddingGeneratedAt?: Date;
}

const ChatSchema = new Schema<IChat>({
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
  characterAvatar: {
    type: String,
    required: false,
    trim: true,
    maxlength: 500
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
    index: true
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
    target: { type: Number },
    skillName: { type: String },
    statName: { type: String }
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
    enum: ['player', 'master', 'moderatore']
  }],

  position: {
    type: String,
    required: false,
    trim: true,
    maxlength: 50
  },
  
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
  
  successDegree: {
    type: String,
    enum: ['critical', 'extreme', 'hard', 'normal', 'failure', 'fumble']
  },
  
  isHidden: {
    type: Boolean,
    default: false
  },
  revealedAt: Date,

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
  collection: 'chats'
});

ChatSchema.index({ locationId: 1, timestamp: -1 });
ChatSchema.index({ characterId: 1, timestamp: -1 });
ChatSchema.index({ locationId: 1, visibility: 1, timestamp: -1 });
ChatSchema.index({ sessionId: 1, timestamp: -1 });

// TTL index to auto-delete old messages after 30 days
ChatSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

ChatSchema.statics.getLocationHistory = async function(
  locationId: string,
  characterId: string,
  limit: number = 50,
  sessionId?: string,
  isMaster: boolean = false
): Promise<IChat[]> {
  // Build visibility filter
  const visibilityFilter: any[] = [
    { visibility: 'public' },
    {
      visibility: 'whisper',
      $or: [
        { characterId },
        { targetCharacters: characterId }
      ]
    }
  ];

  // Only add master_only if character is master
  if (isMaster) {
    visibilityFilter.push({ visibility: 'master_only' });
  }

  const filter: any = {
    locationId,
    $or: visibilityFilter
  };

  if (sessionId) {
    filter.sessionId = sessionId;
  }

  const actions = await this.find(filter)
  .sort({ timestamp: -1 })
  .limit(limit)
  .lean();

  const normalizedActions = actions.map((action: any) => ({
    ...action,
    position: action.position || undefined
  }));

  return normalizedActions.reverse();
};

ChatSchema.statics.createAction = async function(actionData: Partial<IChat>): Promise<IChat> {
  const action = new this(actionData);
  await action.save();
  return action;
};

const EMBEDDING_ACTION_TYPES = new Set(['standard', 'master', 'moderation']);

ChatSchema.post('save', async function(doc) {
  if (!EMBEDDING_ACTION_TYPES.has(doc.actionType)) return;

  try {
    const { publishChatEvent } = await import('@shared/services/EmbeddingEventPublisher');
    const action = doc.isNew ? 'created' : 'updated';

    await publishChatEvent(action, {
      _id: doc._id.toString(),
      characterId: doc.characterId,
      characterName: doc.characterName,
      locationId: doc.locationId,
      content: doc.content,
      actionType: doc.actionType
    });
  } catch (error) {
    console.error('[Chat] Failed to publish embedding event:', error);
  }
});

ChatSchema.post('deleteOne', async function(doc) {
  try {
    const { publishChatDeletedEvent } = await import('@shared/services/EmbeddingEventPublisher');
    await publishChatDeletedEvent(doc._id.toString());
  } catch (error) {
    console.error('[Chat] Failed to publish delete event:', error);
  }
});

ChatSchema.post('findOneAndDelete', async function(doc) {
  if (!doc) return;
  try {
    const { publishChatDeletedEvent } = await import('@shared/services/EmbeddingEventPublisher');
    await publishChatDeletedEvent(doc._id.toString());
  } catch (error) {
    console.error('[Chat] Failed to publish delete event:', error);
  }
});

export const Chat: Model<IChat> = mongoose.models.Chat ||
  mongoose.model<IChat>('Chat', ChatSchema);

export default Chat;
