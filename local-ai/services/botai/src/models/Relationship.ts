import mongoose, { Schema, Document, Types } from 'mongoose';
import { IPlutchikEmotions, IEmotionState } from './Bot';

export type PerceivedStatus = 'superior' | 'equal' | 'inferior' | 'unknown';
export type RelationshipType = 'stranger' | 'acquaintance' | 'friend' | 'rival' | 'romantic' | 'professional' | 'mentor' | 'protege' | 'enemy';

// ── Knapp's Relational Development Model ──────────────────────────────
export type RelationshipPhase =
  // Coming together
  | 'initiating'      // First contact, sizing up
  | 'experimenting'   // Small talk, testing waters
  | 'intensifying'    // Deeper sharing, "we" language
  | 'integrating'     // Social circles merge, paired identity
  | 'bonding'         // Public commitment, deep loyalty
  // Coming apart
  | 'differentiating' // "I" vs "you" re-emerges
  | 'circumscribing'  // Topics become off-limits
  | 'stagnating'      // Going through motions
  | 'avoiding'        // Active withdrawal
  | 'terminating';    // Relationship ends

// ── Attachment Style (derived from bot personality traits) ─────────────
export type AttachmentStyle = 'secure' | 'anxious' | 'avoidant' | 'disorganized';

// ── Trust Decomposition (Mayer et al., 1995) ──────────────────────────
export interface ITrustDimensions {
  competence: number;   // 0-1: can they do what they say?
  benevolence: number;  // 0-1: do they care about my wellbeing?
  integrity: number;    // 0-1: do they follow principles I value?
}

// ── Turning Points (Baxter & Bullis) ──────────────────────────────────
export type TurningPointType =
  | 'first_meeting' | 'first_conflict' | 'first_vulnerability'
  | 'betrayal' | 'reconciliation' | 'shared_crisis'
  | 'gift_or_favor' | 'public_acknowledgment' | 'romantic_advance'
  | 'rejection' | 'revelation' | 'sacrifice' | 'abandonment'
  | 'repair_attempt';

// ── Conflict State (Gottman Model) ───────────────────────────────────
export interface IConflictState {
  isActive: boolean;
  severity: number;              // 0-1
  escalationLevel: number;       // 0-3 (Gottman: criticism, contempt, defensiveness, stonewalling)
  triggerTurningPointId?: string; // which TP started it
  repairAttempts: number;
  lastRepairAt?: Date;
  resolved: boolean;
}

export interface ITurningPoint {
  type: TurningPointType;
  description: string;
  emotionalImpact: number;      // -1 to +1
  importanceWeight: number;     // 1-10
  timestamp: Date;
  trustDeltaAtTime: number;     // snapshot of trust change
  sentimentDeltaAtTime: number; // snapshot of sentiment change
}

// ── Weighted Support Events (Social Exchange Theory) ──────────────────
export type SupportCategory = 'emotional' | 'material' | 'informational' | 'instrumental';

export interface ISupportEvent {
  direction: 'given' | 'received';
  weight: number;           // 1-10 (1=trivial favor, 10=life-saving)
  category: SupportCategory;
  description: string;
  timestamp: Date;
}

// ── Reciprocity Mode (Clark & Mills) ──────────────────────────────────
export type ReciprocityMode = 'exchange' | 'transitional' | 'communal';

// ── Self-Disclosure State (Social Penetration Theory) ─────────────────
export interface IDisclosureState {
  breadth: number;      // 0-1: how many topics discussed
  depth: number;        // 0-1: how intimate the disclosures
  lastDepthLevel: number; // to detect disclosure violations
}

// ── Trend Tracking ────────────────────────────────────────────────────
export interface ITrendSnapshot {
  trust: number;
  sentiment: number;
  familiarity: number;
  timestamp: Date;
}

// ── Phase History Entry ───────────────────────────────────────────────
export interface IPhaseHistoryEntry {
  phase: RelationshipPhase;
  enteredAt: Date;
  exitedAt?: Date;
}

// ── Main Interface ────────────────────────────────────────────────────
export interface IRelationship extends Document {
  botId: Types.ObjectId;
  externalCharacterId: string;
  characterName: string;

  // Core metrics (trust is now computed from trustDimensions)
  trust: number;                    // 0-1, convenience field = 0.4*comp + 0.35*benev + 0.25*integ
  familiarity: number;              // 0-1
  sentiment: number;                // -1 to +1
  interactionCount: number;
  qualityScore: number;              // cumulative interaction quality (replaces raw count for phase transitions)
  lastInteraction: Date;
  emotionState: IEmotionState;

  // Trust decomposition (Mayer et al.)
  trustDimensions: ITrustDimensions;

  // Relationship phase (Knapp's model)
  phase: RelationshipPhase;
  phaseEnteredAt: Date;
  phaseHistory: IPhaseHistoryEntry[];

  // Turning points (replaces significantEvents)
  turningPoints: ITurningPoint[];   // max 15, sorted by importance

  // Disclosure state (Social Penetration Theory)
  disclosure: IDisclosureState;

  // Reciprocity (replaces givenSupport/receivedSupport)
  supportEvents: ISupportEvent[];   // max 20, with temporal decay
  reciprocityMode: ReciprocityMode;

  // Social dynamics
  perceivedStatus: PerceivedStatus;
  relationshipType: RelationshipType;

  // Trend tracking
  trendSnapshots: ITrendSnapshot[]; // max 20, one per ~5 interactions

  // Conflict state (Gottman model, Phase 3)
  activeConflict?: IConflictState;

  // Legacy (kept for backward compat during migration)
  significantEvents?: string[];
  givenSupport?: number;
  receivedSupport?: number;
}

/** Computes composite trust from the three dimensions */
export function computeTrust(dims: ITrustDimensions): number {
  return 0.4 * dims.competence + 0.35 * dims.benevolence + 0.25 * dims.integrity;
}

// ── Mongoose Schemas ──────────────────────────────────────────────────

const PlutchikSchema = new Schema({
  gioia: { type: Number, default: 0, min: 0, max: 1 },
  fiducia: { type: Number, default: 0, min: 0, max: 1 },
  paura: { type: Number, default: 0, min: 0, max: 1 },
  sorpresa: { type: Number, default: 0, min: 0, max: 1 },
  tristezza: { type: Number, default: 0, min: 0, max: 1 },
  disgusto: { type: Number, default: 0, min: 0, max: 1 },
  rabbia: { type: Number, default: 0, min: 0, max: 1 },
  anticipazione: { type: Number, default: 0, min: 0, max: 1 },
}, { _id: false });

const EmotionStateSchema = new Schema({
  axes: { type: PlutchikSchema, default: () => ({}) },
  expressedAxes: { type: PlutchikSchema, default: undefined },
  trigger: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
  suppressionBurden: { type: Number, default: 0, min: 0, max: 1 },
}, { _id: false });

const TrustDimensionsSchema = new Schema({
  competence: { type: Number, default: 0.5, min: 0, max: 1 },
  benevolence: { type: Number, default: 0.5, min: 0, max: 1 },
  integrity: { type: Number, default: 0.5, min: 0, max: 1 },
}, { _id: false });

const TurningPointSchema = new Schema({
  type: { type: String, required: true },
  description: { type: String, required: true },
  emotionalImpact: { type: Number, default: 0, min: -1, max: 1 },
  importanceWeight: { type: Number, default: 5, min: 1, max: 10 },
  timestamp: { type: Date, default: Date.now },
  trustDeltaAtTime: { type: Number, default: 0 },
  sentimentDeltaAtTime: { type: Number, default: 0 },
}, { _id: false });

const SupportEventSchema = new Schema({
  direction: { type: String, enum: ['given', 'received'], required: true },
  weight: { type: Number, default: 3, min: 1, max: 10 },
  category: { type: String, enum: ['emotional', 'material', 'informational', 'instrumental'], default: 'emotional' },
  description: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const DisclosureStateSchema = new Schema({
  breadth: { type: Number, default: 0, min: 0, max: 1 },
  depth: { type: Number, default: 0, min: 0, max: 1 },
  lastDepthLevel: { type: Number, default: 0, min: 0, max: 1 },
}, { _id: false });

const TrendSnapshotSchema = new Schema({
  trust: { type: Number, default: 0.5 },
  sentiment: { type: Number, default: 0 },
  familiarity: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const PhaseHistorySchema = new Schema({
  phase: { type: String, required: true },
  enteredAt: { type: Date, required: true },
  exitedAt: { type: Date, default: undefined },
}, { _id: false });

const ConflictStateSchema = new Schema({
  isActive: { type: Boolean, default: false },
  severity: { type: Number, default: 0, min: 0, max: 1 },
  escalationLevel: { type: Number, default: 0, min: 0, max: 3 },
  triggerTurningPointId: { type: String },
  repairAttempts: { type: Number, default: 0 },
  lastRepairAt: { type: Date },
  resolved: { type: Boolean, default: false },
}, { _id: false });

const RelationshipSchema = new Schema<IRelationship>({
  botId: { type: Schema.Types.ObjectId, ref: 'Bot', required: true, index: true },
  externalCharacterId: { type: String, default: '' },
  characterName: { type: String, required: true },

  // Core metrics
  trust: { type: Number, default: 0.5, min: 0, max: 1 },
  familiarity: { type: Number, default: 0, min: 0, max: 1 },
  sentiment: { type: Number, default: 0, min: -1, max: 1 },
  interactionCount: { type: Number, default: 0 },
  qualityScore: { type: Number, default: 0 },
  lastInteraction: { type: Date, default: Date.now },
  emotionState: { type: Schema.Types.Mixed, default: () => ({ axes: {}, trigger: '', updatedAt: new Date() }) },

  // Trust decomposition
  trustDimensions: { type: TrustDimensionsSchema, default: () => ({ competence: 0.5, benevolence: 0.5, integrity: 0.5 }) },

  // Relationship phase (Knapp)
  phase: { type: String, enum: ['initiating', 'experimenting', 'intensifying', 'integrating', 'bonding', 'differentiating', 'circumscribing', 'stagnating', 'avoiding', 'terminating'], default: 'initiating' },
  phaseEnteredAt: { type: Date, default: Date.now },
  phaseHistory: { type: [PhaseHistorySchema], default: [] },

  // Turning points
  turningPoints: { type: [TurningPointSchema], default: [] },

  // Disclosure state
  disclosure: { type: DisclosureStateSchema, default: () => ({ breadth: 0, depth: 0, lastDepthLevel: 0 }) },

  // Reciprocity
  supportEvents: { type: [SupportEventSchema], default: [] },
  reciprocityMode: { type: String, enum: ['exchange', 'transitional', 'communal'], default: 'exchange' },

  // Social dynamics
  perceivedStatus: { type: String, enum: ['superior', 'equal', 'inferior', 'unknown'], default: 'unknown' },
  relationshipType: { type: String, enum: ['stranger', 'acquaintance', 'friend', 'rival', 'romantic', 'professional', 'mentor', 'protege', 'enemy'], default: 'stranger' },

  // Trend tracking
  trendSnapshots: { type: [TrendSnapshotSchema], default: [] },

  // Conflict state (Gottman model)
  activeConflict: { type: ConflictStateSchema, default: undefined },

  // Legacy (kept for migration — use select: false to hide from default queries)
  significantEvents: { type: [String], default: [], select: false },
  givenSupport: { type: Number, default: 0, select: false },
  receivedSupport: { type: Number, default: 0, select: false },
});

RelationshipSchema.index({ botId: 1, externalCharacterId: 1 }, { unique: true });

export const Relationship = mongoose.model<IRelationship>('Relationship', RelationshipSchema);
