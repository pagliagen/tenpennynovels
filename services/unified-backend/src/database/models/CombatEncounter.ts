import mongoose, { Schema, Document } from 'mongoose';

/**
 * CombatEncounter Model
 *
 * Tracks active combat encounters between characters.
 * Manages turn-based combat state, initiative, and resolution.
 *
 * Lifecycle:
 * 1. waiting_reaction - Attacker initiated, waiting for defender's defense choice
 * 2. in_progress - Combat ongoing, multiple turns
 * 3. completed - Combat resolved
 *
 * Features:
 * - Turn tracking with history
 * - Participant management
 * - Weapon drawn status (Phase 2)
 * - Initiative rolls (Phase 2)
 *
 * @module database/models/CombatEncounter
 * @since 2.0.0 - TiroContrapposto Phase 1
 */

export interface ICombatEncounter extends Document {
  locationId: string; // Where the combat is happening
  sessionId: string; // Game session reference

  encounterType: 'combat' | 'social_scene'; // combat = physical fight, social_scene = skill usage tracking

  status: 'rolling_initiative' | 'waiting_reaction' | 'in_progress' | 'completed';

  participants: Array<{
    characterId: string;
    characterName: string;
    initiativeRoll?: number; // Phase 2: initiative order
    initiativeSuccessDegree?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble'; // Initiative success level
    hasWeaponDrawn?: boolean; // Phase 2: weapon readiness
    drawnWeaponId?: string; // Phase 2: equipped weapon reference
  }>;

  // For social_scene tracking (1 use per skill per scene)
  skillUsageTracking?: Array<{
    characterId: string;
    targetCharacterId: string;
    skillName: string;
    usedAt: Date;
    additionalContext?: string; // Testo bugia per Raggirare
  }>;

  currentTurn: {
    turnNumber: number;
    attackerId: string;
    defenderId: string;
    attackSkill: string;
    attackWeaponId?: string; // Phase 2
    defenseSkill?: string; // Set after defender chooses
    attackRoll?: number; // Rolled when defender reacts
    defenseRoll?: number; // Rolled when defender reacts
    attackSuccessLevel?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';
    defenseSuccessLevel?: 'critical' | 'extreme' | 'hard' | 'normal' | 'failure' | 'fumble';
    outcome?: 'hit' | 'miss' | 'parry' | 'dodge' | 'disarm';
    damageRoll?: number; // Phase 2
    isCriticalDamage?: boolean; // Phase 2
    modifier?: string; // e.g., "Tiro Rapido" (Phase 2)
    status: 'attacking' | 'waiting_defense' | 'resolved';
  };

  turnHistory: Array<{
    turnNumber: number;
    phase: 'initiative' | 'attack' | 'reaction' | 'result';
    results: any; // Flexible structure for different turn types
    timestamp: Date;
  }>;

  startedAt: Date;
  endedAt?: Date;
}

const CombatEncounterSchema = new Schema<ICombatEncounter>(
  {
    locationId: {
      type: String,
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    encounterType: {
      type: String,
      required: true,
      enum: ['combat', 'social_scene'],
      default: 'combat',
    },
    status: {
      type: String,
      required: true,
      enum: ['rolling_initiative', 'waiting_reaction', 'in_progress', 'completed'],
      default: 'waiting_reaction',
      index: true,
    },
    participants: [
      {
        characterId: {
          type: String,
          required: true,
        },
        characterName: {
          type: String,
          required: true,
        },
        initiativeRoll: Number,
        initiativeSuccessDegree: {
          type: String,
          enum: ['critical', 'extreme', 'hard', 'normal', 'failure', 'fumble'],
        },
        hasWeaponDrawn: Boolean,
        drawnWeaponId: String,
      },
    ],
    skillUsageTracking: [
      {
        characterId: {
          type: String,
          required: true,
        },
        targetCharacterId: {
          type: String,
          required: true,
        },
        skillName: {
          type: String,
          required: true,
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
        additionalContext: String,
      },
    ],
    currentTurn: {
      turnNumber: {
        type: Number,
        required: true,
        default: 1,
      },
      attackerId: {
        type: String,
        required: true,
      },
      defenderId: {
        type: String,
        required: true,
      },
      attackSkill: {
        type: String,
        required: true,
      },
      attackWeaponId: String,
      defenseSkill: String,
      attackRoll: Number,
      defenseRoll: Number,
      attackSuccessLevel: {
        type: String,
        enum: ['critical', 'extreme', 'hard', 'normal', 'failure', 'fumble'],
      },
      defenseSuccessLevel: {
        type: String,
        enum: ['critical', 'extreme', 'hard', 'normal', 'failure', 'fumble'],
      },
      outcome: {
        type: String,
        enum: ['hit', 'miss', 'parry', 'dodge', 'disarm'],
      },
      damageRoll: Number,
      isCriticalDamage: Boolean,
      modifier: String,
      status: {
        type: String,
        required: true,
        enum: ['attacking', 'waiting_defense', 'resolved'],
        default: 'attacking',
      },
    },
    turnHistory: [
      {
        turnNumber: Number,
        phase: {
          type: String,
          enum: ['initiative', 'attack', 'reaction', 'result'],
        },
        results: Schema.Types.Mixed,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: Date,
  },
  {
    timestamps: true,
    collection: 'combat_encounters',
  }
);

// Indexes for efficient queries
CombatEncounterSchema.index({ locationId: 1, status: 1 });
CombatEncounterSchema.index({ 'participants.characterId': 1, status: 1 });
CombatEncounterSchema.index({ status: 1, startedAt: -1 });

export const CombatEncounter = mongoose.model<ICombatEncounter>(
  'CombatEncounter',
  CombatEncounterSchema
);
