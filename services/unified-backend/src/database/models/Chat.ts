import mongoose, { Schema, Document, Model } from 'mongoose';
import { logger } from '@shared/utils/logger';

export interface IChat extends Document {
  actionType: 'standard' | 'master' | 'moderation' | 'whisper' | 'ooc' |
             'dice_roll' | 'skill_check' | 'stat_check' | 'item_use' |
             'social_confrontation' | 'combat_action' | 'confrontation_reaction_request';
  characterId: string;
  characterName: string;
  characterSurname?: string;
  characterAvatar?: string;
  isBot: boolean;

  // PNG Light masking
  isMasked: boolean;
  realCharacterName?: string;  // Admin-only field (only if masked)

  content: string;
  locationId: string;
  locationName?: string;
  sessionId?: string;
  timestamp: Date;
  visibility: 'public' | 'whisper' | 'master_only';
  diceResult?: {
    dice: string;
    result: number;
    rolls?: number[];           // Individual dice rolls (for multi-dice)
    modifier?: number;          // Modifier applied
    total: number;              // Final total (result + modifier)
    success?: boolean;          // Pass/fail
    successDegree?: string;     // critical, extreme, hard, normal, failure, fumble
    skillId?: string;           // For skill checks
    skillName?: string;         // For skill checks
    statName?: string;          // For stat checks
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

  // TiroContrapposto - Unified confrontation field (replaces socialConflict)
  confrontation?: {
    type: 'social' | 'combat';
    encounterId?: string; // CombatEncounter._id (null for social)
    turnNumber?: number; // Combat only
    phase: 'rolling_initiative' | 'waiting_reaction' | 'result';

    // Initiative tracking
    initiativeRolls?: { [characterId: string]: { roll: number; successDegree: string } };
    firstAttacker?: string;

    // Constitution check
    constitutionCheckRequired?: boolean;
    constitutionCheckPassed?: boolean;
    constitutionCheckRoll?: number;

    // Raggirare hidden result
    hiddenResultForAttacker?: boolean; // true for Raggirare (attacker doesn't see rolls)
    visibleToAttackerOnly?: boolean; // Message "Stai provando a raggirare Y" visible only to attacker

    attackerCharacterId: string;
    defenderCharacterId: string;

    // Populated when phase = 'waiting_reaction'
    availableDefenseSkills?: Array<{
      skillName: string;
      label: string;
      specialRule?: string;
    }>;

    // Populated when phase = 'result'
    attackSkill?: string;
    defenseSkill?: string;
    weaponName?: string; // Combat only
    attackRoll?: number;
    defenseRoll?: number;
    attackSuccessLevel?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';
    defenseSuccessLevel?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';

    outcome?: 'hit' | 'miss' | 'parry' | 'dodge' | 'disarm' | 'attacker_wins' | 'defender_wins' | 'draw';

    damageDealt?: number; // Combat only (Phase 2)
    isCriticalDamage?: boolean; // Combat only (Phase 2)
    damageFormula?: string; // Combat only (Phase 2)

    // For Raggirare (Phase 3)
    messageForDefender?: string;
    visibleToDefenderOnly?: boolean;
  };

  successDegree?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';

  isHidden?: boolean;
  revealedAt?: Date;
  hiddenContent?: string;  // For hidden intentions (Raggirare, etc.)

  contentEmbedding?: number[];
  embeddingModel?: string;
  embeddingGeneratedAt?: Date;

  moderationScore?: number;
  moderationLabel?: string;
  moderationModel?: string;
  moderationProcessedAt?: Date;
}

const ChatSchema = new Schema<IChat>({
  actionType: {
    type: String,
    required: true,
    enum: ['standard', 'master', 'moderation', 'whisper', 'ooc',
           'dice_roll', 'skill_check', 'stat_check', 'item_use',
           'social_confrontation', 'combat_action', 'confrontation_reaction_request']
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

  // PNG Light masking
  isMasked: {
    type: Boolean,
    default: false
  },
  realCharacterName: {
    type: String,
    trim: true,
    maxlength: 100
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
    rolls: [{ type: Number }],              // Individual dice rolls (for multi-dice)
    modifier: { type: Number },             // Modifier applied
    total: { type: Number },                // Final total (result + modifier)
    success: { type: Boolean },             // Pass/fail
    successDegree: { type: String },        // critical, extreme, hard, normal, failure, fumble
    skillId: { type: String },              // For skill checks (ObjectId as string)
    skillName: { type: String },            // For skill checks
    statName: { type: String }              // For stat checks
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

  // TiroContrapposto - Unified confrontation field
  confrontation: {
    type: {
      type: String,
      enum: ['social', 'combat']
    },
    encounterId: String,
    turnNumber: Number,
    phase: {
      type: String,
      enum: ['rolling_initiative', 'waiting_reaction', 'result']
    },
    initiativeRolls: Schema.Types.Mixed,
    firstAttacker: String,
    constitutionCheckRequired: Boolean,
    constitutionCheckPassed: Boolean,
    constitutionCheckRoll: Number,
    hiddenResultForAttacker: Boolean,
    visibleToAttackerOnly: Boolean,
    attackerCharacterId: String,
    defenderCharacterId: String,
    availableDefenseSkills: [{
      skillName: String,
      label: String,
      specialRule: String
    }],
    attackSkill: String,
    defenseSkill: String,
    weaponName: String,
    attackRoll: Number,
    defenseRoll: Number,
    attackSuccessLevel: {
      type: String,
      enum: ['critical', 'extreme', 'hard', 'normal', 'failure', 'fumble']
    },
    defenseSuccessLevel: {
      type: String,
      enum: ['critical', 'extreme', 'hard', 'normal', 'failure', 'fumble']
    },
    outcome: {
      type: String,
      enum: ['hit', 'miss', 'parry', 'dodge', 'disarm', 'attacker_wins', 'defender_wins', 'draw']
    },
    damageDealt: Number,
    isCriticalDamage: Boolean,
    damageFormula: String,
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
  hiddenContent: {
    type: String,
    maxlength: 2000
  },

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
  },

  moderationScore: {
    type: Number,
    required: false,
    min: 0,
    max: 1
  },
  moderationLabel: {
    type: String,
    required: false,
    enum: ['toxic', 'not-toxic']
  },
  moderationModel: {
    type: String,
    required: false
  },
  moderationProcessedAt: {
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
ChatSchema.index({ isMasked: 1, locationId: 1 });  // Admin queries

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

/**
 * Pre-save middleware: Remove empty subdocuments to prevent Mongoose auto-initialization
 *
 * Problem: When subdocuments with nested arrays are defined in the schema (e.g., itemEffect.consumedItems[]),
 * Mongoose auto-initializes those arrays as [] even when the parent subdocument is not set.
 * This causes WebSocket rendering bugs where the frontend expects undefined, not empty objects.
 *
 * Solution: Before saving, check if subdocuments are "empty" (only contain empty arrays or no data fields)
 * and remove them entirely. This ensures only meaningful data is persisted.
 */
ChatSchema.pre('save', function() {
  // Check if itemEffect is empty (no meaningful data, only empty arrays)
  if (this.itemEffect) {
    const hasItemId = !!this.itemEffect.itemId;
    const hasItemName = !!this.itemEffect.itemName;
    const hasDescription = !!this.itemEffect.description;
    const hasConsumedItems = this.itemEffect.consumedItems && this.itemEffect.consumedItems.length > 0;
    const hasEffects = this.itemEffect.effects && this.itemEffect.effects.length > 0;

    if (!hasItemId && !hasItemName && !hasDescription && !hasConsumedItems && !hasEffects) {
      this.itemEffect = undefined;
    }
  }

  // Check if confrontation is empty
  if (this.confrontation) {
    const hasType = !!this.confrontation.type;
    const hasEncounterId = !!this.confrontation.encounterId;
    const hasPhase = !!this.confrontation.phase;
    const hasAttackerId = !!this.confrontation.attackerCharacterId;
    const hasDefenderId = !!this.confrontation.defenderCharacterId;
    const hasAvailableSkills = this.confrontation.availableDefenseSkills && this.confrontation.availableDefenseSkills.length > 0;

    if (!hasType && !hasEncounterId && !hasPhase && !hasAttackerId && !hasDefenderId && !hasAvailableSkills) {
      this.confrontation = undefined;
    }
  }

  // Check if socialConflict is empty
  if (this.socialConflict) {
    const hasType = !!this.socialConflict.type;
    const hasAttackerSkill = !!this.socialConflict.attackerSkill;
    const hasDefenderSkill = !!this.socialConflict.defenderSkill;
    const hasAttackerRoll = this.socialConflict.attackerRoll !== undefined;
    const hasDefenderRoll = this.socialConflict.defenderRoll !== undefined;
    const hasResult = !!this.socialConflict.result;

    if (!hasType && !hasAttackerSkill && !hasDefenderSkill && !hasAttackerRoll && !hasDefenderRoll && !hasResult) {
      this.socialConflict = undefined;
    }
  }
});

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
    logger.error('[Chat] Failed to publish embedding event:', error);
  }
});

ChatSchema.post('deleteOne', async function(doc) {
  try {
    const { publishChatDeletedEvent } = await import('@shared/services/EmbeddingEventPublisher');
    await publishChatDeletedEvent(doc._id.toString());
  } catch (error) {
    logger.error('[Chat] Failed to publish delete event:', error);
  }
});

ChatSchema.post('findOneAndDelete', async function(doc) {
  if (!doc) return;
  try {
    const { publishChatDeletedEvent } = await import('@shared/services/EmbeddingEventPublisher');
    await publishChatDeletedEvent(doc._id.toString());
  } catch (error) {
    logger.error('[Chat] Failed to publish delete event:', error);
  }
});

export interface IChatModel extends Model<IChat> {
  createAction(actionData: Partial<IChat>): Promise<IChat>;
  getLocationHistory(locationId: string, characterId: string, limit?: number, sessionId?: string, isMaster?: boolean): Promise<IChat[]>;
}

export const Chat = (mongoose.models.Chat ||
  mongoose.model<IChat, IChatModel>('Chat', ChatSchema)) as IChatModel;

export default Chat;
