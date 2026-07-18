import {
  IRelationship, PerceivedStatus, RelationshipType, Relationship, computeTrust,
  ITurningPoint, ISupportEvent, ITrendSnapshot, ReciprocityMode, AttachmentStyle,
  TurningPointType,
} from '../models/Relationship';
import { deriveAttachmentStyle, getAttachmentDampeningMultiplier } from '../agent/AttachmentMapper';
import { computeReciprocityBalance, deriveReciprocityMode, addSupportEvent, ReciprocityResult } from '../agent/ReciprocityEngine';
import { Types } from 'mongoose';

const MAX_TURNING_POINTS = 15;
const MAX_TREND_SNAPSHOTS = 20;

// ── Phase 3 Dampening (sigmoid-based, attachment-aware) ─────────────

function computeDampening(interactionCount: number, attachmentStyle: AttachmentStyle): number {
  const base = 0.1 + 0.85 / (1 + Math.pow(interactionCount / 25, 1.5));
  return base * getAttachmentDampeningMultiplier(attachmentStyle);
}

// ── Delta interface for Phase 3 trust decomposition ─────────────────

export interface RelationshipDeltas {
  trustDeltas?: { competence?: number; benevolence?: number; integrity?: number };
  familiarity?: number;
  sentiment?: number;
  perceivedStatus?: PerceivedStatus;
  relationshipType?: RelationshipType;
  disclosureDelta?: { breadthDelta?: number; depthDelta?: number };
  // Legacy fields (mapped to new structures internally)
  trust?: number;
  givenSupportDelta?: number;
  receivedSupportDelta?: number;
}

export class RelationshipStore {
  async getRelationship(botId: string, characterId: string): Promise<IRelationship | null> {
    // Validate botId to prevent query injection
    if (!Types.ObjectId.isValid(botId)) {
      throw new Error('Invalid bot ID format');
    }
    return Relationship.findOne({
      botId: new Types.ObjectId(botId),
      externalCharacterId: characterId,
    }).lean();
  }

  async getRelationships(botId: string): Promise<IRelationship[]> {
    // Validate botId to prevent query injection
    if (!Types.ObjectId.isValid(botId)) {
      throw new Error('Invalid bot ID format');
    }
    return Relationship.find({
      botId: new Types.ObjectId(botId),
    }).sort({ lastInteraction: -1 }).limit(10).lean();
  }

  /**
   * Fetch relazioni per multipli character IDs (per audience awareness).
   */
  async getRelationshipsForCharacters(botId: string, characterIds: string[]): Promise<IRelationship[]> {
    if (characterIds.length === 0) return [];
    // Validate botId to prevent query injection
    if (!Types.ObjectId.isValid(botId)) {
      throw new Error('Invalid bot ID format');
    }
    return Relationship.find({
      botId: new Types.ObjectId(botId),
      externalCharacterId: { $in: characterIds },
    }).lean();
  }

  async updateRelationship(
    botId: string,
    characterId: string,
    characterName: string,
    deltas: RelationshipDeltas = {},
    botTraits: string[] = [],
  ): Promise<IRelationship> {
    const existing = await Relationship.findOne({
      botId: new Types.ObjectId(botId),
      externalCharacterId: characterId,
    });

    const attachmentStyle = deriveAttachmentStyle(botTraits);

    if (existing) {
      const dampening = computeDampening(existing.interactionCount, attachmentStyle);

      // ── Trust dimensions: apply dampened deltas individually ──
      const dims = existing.trustDimensions || { competence: 0.5, benevolence: 0.5, integrity: 0.5 };

      if (deltas.trustDeltas) {
        dims.competence = clamp(dims.competence + (deltas.trustDeltas.competence || 0) * dampening, 0, 1);
        dims.benevolence = clamp(dims.benevolence + (deltas.trustDeltas.benevolence || 0) * dampening, 0, 1);
        dims.integrity = clamp(dims.integrity + (deltas.trustDeltas.integrity || 0) * dampening, 0, 1);
      } else if (deltas.trust !== undefined) {
        // Legacy path: distribute single trust delta across all dimensions equally
        const perDim = deltas.trust / 3;
        dims.competence = clamp(dims.competence + perDim * dampening, 0, 1);
        dims.benevolence = clamp(dims.benevolence + perDim * dampening, 0, 1);
        dims.integrity = clamp(dims.integrity + perDim * dampening, 0, 1);
      }
      existing.trustDimensions = dims;

      // Recompute composite trust from dimensions
      existing.trust = clamp(computeTrust(dims), 0, 1);

      // ── Familiarity & sentiment ──
      existing.familiarity = clamp(existing.familiarity + (deltas.familiarity ?? 0.05) * dampening, 0, 1);
      existing.sentiment = clamp(existing.sentiment + (deltas.sentiment || 0) * dampening, -1, 1);

      // ── Interaction tracking ──
      existing.interactionCount += 1;
      existing.lastInteraction = new Date();

      // ── Perceived status ──
      if (deltas.perceivedStatus && deltas.perceivedStatus !== 'unknown') {
        existing.perceivedStatus = deltas.perceivedStatus;
      }

      // ── Relationship type ──
      // L'LLM può suggerire un tipo, ma garantiamo una progressione minima:
      // - >= 3 interazioni e tipo ancora "stranger" → almeno "acquaintance"
      // - L'LLM può promuovere oltre "acquaintance" solo se ha >= 3 interazioni
      if (deltas.relationshipType && deltas.relationshipType !== 'stranger'
          && deltas.relationshipType !== existing.relationshipType
          && existing.interactionCount >= 3) {
        existing.relationshipType = deltas.relationshipType;
      }
      // Fallback: non restare "stranger" dopo 3+ interazioni
      if (existing.relationshipType === 'stranger' && existing.interactionCount >= 3) {
        existing.relationshipType = 'acquaintance';
      }

      // ── Disclosure state (Social Penetration Theory) ──
      if (deltas.disclosureDelta) {
        const disc = existing.disclosure || { breadth: 0, depth: 0, lastDepthLevel: 0 };
        disc.breadth = clamp(disc.breadth + (deltas.disclosureDelta.breadthDelta || 0) * dampening, 0, 1);
        const newDepth = clamp(disc.depth + (deltas.disclosureDelta.depthDelta || 0) * dampening, 0, 1);
        disc.lastDepthLevel = disc.depth;
        disc.depth = newDepth;
        existing.disclosure = disc;
      }

      // ── Reciprocity mode (derived from phase + type) ──
      existing.reciprocityMode = deriveReciprocityMode(
        existing.phase || 'initiating',
        existing.relationshipType || 'stranger',
      );

      return existing.save();
    }

    // ── NEW relationship: initialize all Phase 3 fields ──
    const initialDims = { competence: 0.5, benevolence: 0.5, integrity: 0.5 };

    // Apply initial deltas if provided
    if (deltas.trustDeltas) {
      initialDims.competence = clamp(0.5 + (deltas.trustDeltas.competence || 0), 0, 1);
      initialDims.benevolence = clamp(0.5 + (deltas.trustDeltas.benevolence || 0), 0, 1);
      initialDims.integrity = clamp(0.5 + (deltas.trustDeltas.integrity || 0), 0, 1);
    } else if (deltas.trust !== undefined) {
      const perDim = deltas.trust / 3;
      initialDims.competence = clamp(0.5 + perDim, 0, 1);
      initialDims.benevolence = clamp(0.5 + perDim, 0, 1);
      initialDims.integrity = clamp(0.5 + perDim, 0, 1);
    }

    const now = new Date();

    return Relationship.create({
      botId: new Types.ObjectId(botId),
      externalCharacterId: characterId,
      characterName,
      trust: clamp(computeTrust(initialDims), 0, 1),
      familiarity: clamp(deltas.familiarity || 0.05, 0, 1),
      sentiment: clamp(deltas.sentiment || 0, -1, 1),
      interactionCount: 1,
      lastInteraction: now,
      trustDimensions: initialDims,
      phase: 'initiating',
      phaseEnteredAt: now,
      phaseHistory: [{ phase: 'initiating', enteredAt: now }],
      disclosure: { breadth: 0, depth: 0, lastDepthLevel: 0 },
      supportEvents: [],
      reciprocityMode: 'exchange',
      perceivedStatus: deltas.perceivedStatus || 'unknown',
      relationshipType: 'stranger',
      turningPoints: [],
      trendSnapshots: [],
    });
  }

  /**
   * Add a turning point to the relationship.
   * Sorted by importanceWeight desc, max 15 entries.
   * 'first_meeting' entries are always preserved.
   */
  async addTurningPoint(botId: string, characterId: string, turningPoint: ITurningPoint): Promise<void> {
    const rel = await Relationship.findOne({
      botId: new Types.ObjectId(botId),
      externalCharacterId: characterId,
    });
    if (!rel) return;

    const points = [...(rel.turningPoints || []), turningPoint];

    // Sort by importanceWeight descending
    points.sort((a, b) => b.importanceWeight - a.importanceWeight);

    // If over limit, trim — but always keep 'first_meeting' entries
    if (points.length > MAX_TURNING_POINTS) {
      const firstMeetings = points.filter(p => p.type === 'first_meeting');
      const others = points.filter(p => p.type !== 'first_meeting');
      const slotsForOthers = MAX_TURNING_POINTS - firstMeetings.length;
      const trimmed = [...firstMeetings, ...others.slice(0, Math.max(0, slotsForOthers))];
      trimmed.sort((a, b) => b.importanceWeight - a.importanceWeight);
      rel.turningPoints = trimmed;
    } else {
      rel.turningPoints = points;
    }

    await rel.save();
  }

  /**
   * Legacy wrapper — calls addTurningPoint internally.
   * Kept for backward compatibility with routes.ts calls.
   */
  async addSignificantEvent(botId: string, characterId: string, event: string): Promise<void> {
    const turningPoint: ITurningPoint = {
      type: 'revelation' as TurningPointType,
      description: event,
      emotionalImpact: 0,
      importanceWeight: 5,
      timestamp: new Date(),
      trustDeltaAtTime: 0,
      sentimentDeltaAtTime: 0,
    };
    await this.addTurningPoint(botId, characterId, turningPoint);

    // Also push to legacy significantEvents for any code still reading it
    await Relationship.updateOne(
      { botId: new Types.ObjectId(botId), externalCharacterId: characterId },
      { $push: { significantEvents: { $each: [event], $slice: -5 } } },
    );
  }

  /**
   * Record a trend snapshot (trust, sentiment, familiarity at this point in time).
   * Keeps max 20 via $slice.
   */
  async recordTrendSnapshot(botId: string, characterId: string): Promise<void> {
    const rel = await Relationship.findOne({
      botId: new Types.ObjectId(botId),
      externalCharacterId: characterId,
    }).lean();
    if (!rel) return;

    const snapshot: ITrendSnapshot = {
      trust: rel.trust,
      sentiment: rel.sentiment,
      familiarity: rel.familiarity,
      timestamp: new Date(),
    };

    await Relationship.updateOne(
      { botId: new Types.ObjectId(botId), externalCharacterId: characterId },
      {
        $push: {
          trendSnapshots: { $each: [snapshot], $slice: -MAX_TREND_SNAPSHOTS },
        },
      },
    );
  }

  /**
   * Calcola il bilancio di reciprocità usando il ReciprocityEngine.
   * Returns { ratio, description } for backward compatibility.
   */
  getReciprocityBalance(relationship: IRelationship): { ratio: number; description: string } {
    const result = computeReciprocityBalance(relationship);
    return { ratio: result.ratio, description: result.description };
  }

  /**
   * Full reciprocity result (for callers that need the complete analysis).
   */
  getFullReciprocityBalance(relationship: IRelationship): ReciprocityResult {
    return computeReciprocityBalance(relationship);
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
