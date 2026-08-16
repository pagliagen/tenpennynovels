import mongoose, { Schema, Document, Model } from 'mongoose';
import { logger } from '@shared/utils/logger';
import { ChatActionType } from '../actionTypes/ChatActionType';
import { actionTypeRegistry } from '../actionTypes/registry';

export interface IChat extends Document {
  // Template literal type, non l'enum nominale: i molti call site esistenti
  // (query/filtri Mongoose) costruiscono il filtro con literal string
  // ('social_confrontation', ecc.), che un enum TS nominale rifiuterebbe in
  // assegnazione — questo tipo resta strutturalmente l'unione delle stesse
  // 12 stringhe, solo derivato dalla fonte unica invece che riscritto a mano.
  actionType: `${ChatActionType}`;
  characterId: string;
  characterName: string;
  characterSurname?: string;
  characterAvatar?: string;

  // PNG Light masking
  isMasked: boolean;
  realCharacterName?: string;  // Admin-only field (only if masked)

  content: string;
  locationId: string;
  locationName?: string;
  sessionId?: string;
  chatSceneId?: string;
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
      value?: number;
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

  // Soft delete — set by deleteMessage. Excluded from the in-game live view
  // (ChatBackup) entirely; retained here for master/gestionale audit access.
  deletedAt?: Date;
}

export const ChatSchema = new Schema<IChat>({
  actionType: {
    type: String,
    required: true,
    enum: Object.values(ChatActionType)
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
    maxlength: 1200
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
  chatSceneId: {
    type: String,
    required: false
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
      specialRule: String,
      value: Number
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
    maxlength: 1200
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
  },

  deletedAt: {
    type: Date,
    required: false,
    index: true
  }
}, {
  timestamps: true,
  collection: 'chats'
});

ChatSchema.index({ locationId: 1, timestamp: -1 });
ChatSchema.index({ characterId: 1, timestamp: -1 });
ChatSchema.index({ locationId: 1, visibility: 1, timestamp: -1 });
ChatSchema.index({ sessionId: 1, timestamp: -1 });
ChatSchema.index({ chatSceneId: 1, characterId: 1 });
ChatSchema.index({ isMasked: 1, locationId: 1 });  // Admin queries

ChatSchema.statics.getLocationHistory = async function(
  locationId: string,
  characterId: string,
  limit: number = 50,
  sessionId?: string,
  isMaster: boolean = false
): Promise<IChat[]> {
  // Build visibility filter — master sees every whisper and every master_only
  // message regardless of targeting; a regular character sees only whispers/
  // targeted master_only rows they're actually part of.
  const visibilityFilter: any[] = [{ visibility: 'public' }];

  if (isMaster) {
    visibilityFilter.push({ visibility: 'whisper' });
    visibilityFilter.push({ visibility: 'master_only' });
  } else {
    visibilityFilter.push({
      visibility: 'whisper',
      $or: [
        { characterId },
        { targetCharacters: characterId }
      ]
    });
    // Targeted master_only ("esito riservato") — visible to the listed characters too
    visibilityFilter.push({ visibility: 'master_only', targetCharacters: characterId });
  }

  const filter: any = {
    locationId,
    deletedAt: { $exists: false },
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

ChatSchema.post('save', async function(doc) {
  // Letto ad ogni save, non cacheato a livello di modulo: al caricamento di
  // questo file (import-time) la registrazione delle feature in app.ts non
  // è ancora avvenuta, un Set costruito qui sopra catturerebbe un registry
  // vuoto. Costo trascurabile (12 voci), nessun controllo flag — vedi
  // core/chat/actionTypes/registry.ts#getEmbeddingActionTypes.
  if (!actionTypeRegistry.getEmbeddingActionTypes().includes(doc.actionType as ChatActionType)) return;

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

/**
 * Two-table chat architecture:
 * - `Chat` (this collection, "chats") is the permanent archive — everything
 *   ever written, including soft-deleted rows (deletedAt). Master/gestionale
 *   reads from here.
 * - `ChatBackup` ("chatbackups") is a TTL-expired (3h) mirror. The in-game
 *   chat UI reads ONLY from ChatBackup (see ChatMessageService.getMessages).
 *   clearChat wipes ChatBackup only — the archive is untouched.
 *
 * Every create/update on `Chat` is mirrored here via post-save /
 * post-findOneAndUpdate hooks, so callers never have to remember to write
 * to both collections by hand. A soft-delete (deletedAt just set) removes
 * the mirrored row instead of copying it, so it disappears from the live
 * view immediately rather than waiting out the TTL.
 *
 * Guarded by modelName to avoid self-mirroring: ChatBackup's schema is a
 * `.clone()` of this one (see ChatBackup.ts) and therefore inherits these
 * same hooks — without the guard, writes to ChatBackup would recursively
 * try to mirror themselves.
 */
async function mirrorToChatBackup(doc: any): Promise<void> {
  if (!doc || doc.constructor?.modelName !== 'Chat') return;

  try {
    const { ChatBackup } = await import('./ChatBackup');

    if (doc.deletedAt) {
      await ChatBackup.deleteOne({ _id: doc._id });
      return;
    }

    const { _id, ...rest } = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    await ChatBackup.findByIdAndUpdate(
      _id,
      { $set: rest },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    logger.error('[Chat] Failed to mirror to ChatBackup:', error);
  }
}

ChatSchema.post('save', function(doc) {
  void mirrorToChatBackup(doc);
});

ChatSchema.post('findOneAndUpdate', function(doc) {
  void mirrorToChatBackup(doc);
});

export interface IChatModel extends Model<IChat> {
  createAction(actionData: Partial<IChat>): Promise<IChat>;
  getLocationHistory(locationId: string, characterId: string, limit?: number, sessionId?: string, isMaster?: boolean): Promise<IChat[]>;
}

export const Chat = (mongoose.models.Chat ||
  mongoose.model<IChat, IChatModel>('Chat', ChatSchema)) as IChatModel;

export default Chat;
