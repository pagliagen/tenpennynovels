import mongoose, { Schema, Document } from 'mongoose';

/**
 * SkillConfrontation Model
 *
 * Configuration table for opposed roll system (TiroContrapposto).
 * Defines which skills can be used in confrontations and their counter-skills.
 *
 * Examples:
 * - Social: Intimidire → Autocontrollo
 * - Combat: Corpo a Corpo → [Schivata, Parata]
 * - Ranged: Armi da fuoco → [Schivata, Disarmare]
 *
 * Features:
 * - Multiple counter-skills support (triggers reaction request flow)
 * - Special rules (e.g., "strict_higher" for Disarmare)
 * - Roll type (open vs hidden for Raggirare)
 * - Outcome templates for narrative messages
 *
 * @module database/models/SkillConfrontation
 * @since 2.0.0 - TiroContrapposto Phase 1
 */

export interface ISkillConfrontation extends Document {
  skillId?: Schema.Types.ObjectId; // ref: Skill (optional - can use skillName for lookup)
  skillName: string; // Denormalized for fast lookup (e.g., "Corpo a Corpo", "Intimidire")

  category: 'social' | 'combat_unarmed' | 'combat_melee' | 'combat_ranged';

  counterSkills: Array<{
    skillId?: Schema.Types.ObjectId; // ref: Skill (optional - can use skillName for lookup)
    skillName: string; // e.g., "Schivata", "Autocontrollo"
    label: string; // UI display name (e.g., "Parata" when using Corpo a Corpo for defense)
    specialRule?: 'strict_higher' | 'auto_fail'; // null = normal, strict_higher = defender needs strictly higher degree, auto_fail = "Non voglio tirare/difendermi"
  }>;

  rollType: 'open' | 'hidden'; // open = visible to all, hidden = Raggirare (two-phase)

  // "Può difendersi?" — false + counterSkills.length===1 = risoluzione
  // automatica (nessun popup di scelta difesa, nessuna opzione "non
  // difendersi": la skill di difesa è obbligata). true = il popup esce
  // sempre, anche con una sola opzione di difesa (comportamento di
  // tutti i confronti "aperti" oggi, es. Ammaliare→Autocontrollo).
  canDefend: boolean;

  requiresAdditionalMessage: boolean; // true for Raggirare (requires lie text)
  additionalMessageLabel?: string; // e.g., "Testo della bugia"

  modifiers?: Array<{
    label: string; // e.g., "Tiro Rapido"
    description: string; // e.g., "Sparo senza mirare, nello stesso turno dell'estrazione"
    minSuccessLevel: 'hard' | 'extreme' | 'critical'; // Minimum success level required
  }>;

  outcomeTemplates?: {
    attackerFails?: string; // For Raggirare phase 1 failure
    defenderWinsBy1?: string; // Defender wins by 1 degree
    defenderWinsBy2?: string; // Defender wins by 2+ degrees
  };

  createdAt: Date;
  updatedAt: Date;
}

const SkillConfrontationSchema = new Schema<ISkillConfrontation>(
  {
    skillId: {
      type: Schema.Types.ObjectId,
      ref: 'Skill',
      required: false,
    },
    skillName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['social', 'combat_unarmed', 'combat_melee', 'combat_ranged'],
    },
    counterSkills: [
      {
        skillId: {
          type: Schema.Types.ObjectId,
          ref: 'Skill',
          required: false,
        },
        skillName: {
          type: String,
          required: true,
        },
        label: {
          type: String,
          required: true,
        },
        specialRule: {
          type: String,
          enum: ['strict_higher', 'auto_fail', null],
          default: null,
        },
      },
    ],
    rollType: {
      type: String,
      required: true,
      enum: ['open', 'hidden'],
      default: 'open',
    },
    canDefend: {
      type: Boolean,
      required: true,
      default: true,
    },
    requiresAdditionalMessage: {
      type: Boolean,
      default: false,
    },
    additionalMessageLabel: {
      type: String,
    },
    modifiers: [
      {
        label: String,
        description: String,
        minSuccessLevel: {
          type: String,
          enum: ['hard', 'extreme', 'critical'],
        },
      },
    ],
    outcomeTemplates: {
      attackerFails: String,
      defenderWinsBy1: String,
      defenderWinsBy2: String,
    },
  },
  {
    timestamps: true,
    collection: 'skill_confrontations',
  }
);

// Indexes for efficient queries
SkillConfrontationSchema.index({ skillName: 1 }, { unique: true }); // Unique index for skill names
SkillConfrontationSchema.index({ category: 1 }); // Category filtering
SkillConfrontationSchema.index({ skillName: 1, category: 1 }); // Compound index for combined queries

export const SkillConfrontation = mongoose.model<ISkillConfrontation>(
  'SkillConfrontation',
  SkillConfrontationSchema
);
