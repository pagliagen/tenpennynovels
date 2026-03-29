/**
 * BaselineComputer — Computes emotional baselines from relationship history and personality.
 *
 * Baselines are the emotional "floor" that emotions decay toward instead of zero.
 * A bot that was betrayed will have elevated paura/disgusto baseline toward that person.
 * A melancholic bot will have persistent tristezza as personality baseline.
 *
 * All computation is deterministic (ZERO LLM calls).
 */

import { IPlutchikEmotions, PLUTCHIK_AXES } from '../models/Bot';
import { IRelationship } from '../models/Relationship';
import { TRAIT_EMOTION_RULES } from '../models/Bot';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('BaselineComputer');

export interface EmotionalBaseline {
  axes: IPlutchikEmotions;
  sourceFactors: string[];
}

const EMPTY_AXES: IPlutchikEmotions = {
  gioia: 0, fiducia: 0, paura: 0, sorpresa: 0,
  tristezza: 0, disgusto: 0, rabbia: 0, anticipazione: 0,
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Compute emotional baseline toward a specific character based on relationship history.
 * Returns the emotional "floor" that felt emotions decay toward.
 */
export function computeRelationshipBaseline(relationship: IRelationship): EmotionalBaseline {
  const axes = { ...EMPTY_AXES };
  const factors: string[] = [];

  if (!relationship) return { axes, sourceFactors: [] };

  // ── 1. Turning points impact ──
  if (relationship.turningPoints && relationship.turningPoints.length > 0) {
    for (const tp of relationship.turningPoints) {
      const ageMs = Date.now() - new Date(tp.timestamp).getTime();
      // Turning points older than 30 days have reduced impact
      const recencyFactor = ageMs < THIRTY_DAYS_MS ? 1.0 : Math.pow(0.5, ageMs / THIRTY_DAYS_MS);
      const weight = (tp.importanceWeight / 10) * recencyFactor;

      if (tp.type === 'betrayal' || tp.type === 'abandonment') {
        axes.paura += 0.15 * weight;
        axes.disgusto += 0.10 * weight;
        axes.rabbia += 0.10 * weight;
        axes.fiducia = Math.max(0, axes.fiducia - 0.1 * weight);
        factors.push(`${tp.type}_tp`);
      }
      if (tp.type === 'reconciliation') {
        axes.fiducia += 0.05 * weight;
        axes.gioia += 0.03 * weight;
        // Reconciliation reduces negative baseline from earlier betrayals
        axes.paura = Math.max(0, axes.paura - 0.05 * weight);
        axes.rabbia = Math.max(0, axes.rabbia - 0.05 * weight);
        factors.push('reconciliation_tp');
      }
      if (tp.type === 'first_vulnerability' || tp.type === 'shared_crisis') {
        axes.fiducia += 0.05 * weight;
        axes.anticipazione += 0.03 * weight;
        factors.push(`${tp.type}_tp`);
      }
      if (tp.type === 'gift_or_favor') {
        axes.gioia += 0.03 * weight;
        axes.fiducia += 0.02 * weight;
      }
      if (tp.type === 'first_conflict') {
        axes.anticipazione += 0.05 * weight;
        axes.paura += 0.03 * weight;
        factors.push('conflict_tp');
      }
    }
  }

  // ── 2. Trust dimensions ──
  if (relationship.trustDimensions) {
    const td = relationship.trustDimensions;
    // Low benevolence → wariness
    if (td.benevolence < 0.3) {
      axes.paura += 0.08;
      axes.anticipazione += 0.05;
      factors.push('low_benevolence');
    }
    // Low integrity → disgust/anger
    if (td.integrity < 0.3) {
      axes.disgusto += 0.06;
      axes.rabbia += 0.04;
      factors.push('low_integrity');
    }
    // High trust across all dimensions → warmth
    if (td.competence > 0.7 && td.benevolence > 0.7 && td.integrity > 0.7) {
      axes.fiducia += 0.10;
      axes.gioia += 0.05;
      factors.push('high_trust');
    }
  }

  // ── 3. Relationship phase ──
  const regressivePhases = ['differentiating', 'circumscribing', 'stagnating', 'avoiding', 'terminating'];
  if (regressivePhases.includes(relationship.phase)) {
    axes.tristezza += 0.05;
    if (relationship.phase === 'avoiding' || relationship.phase === 'terminating') {
      axes.rabbia += 0.05;
      axes.disgusto += 0.03;
    }
    factors.push(`regressive_phase:${relationship.phase}`);
  }

  // ── 4. Sentiment ──
  if (relationship.sentiment < -0.3) {
    axes.rabbia += 0.05;
    axes.disgusto += 0.03;
    factors.push('negative_sentiment');
  } else if (relationship.sentiment > 0.3) {
    axes.gioia += 0.05;
    axes.fiducia += 0.03;
    factors.push('positive_sentiment');
  }

  // Clamp all axes to [0, 0.3] — baseline should never be overwhelming
  for (const axis of PLUTCHIK_AXES) {
    axes[axis] = Math.min(0.3, Math.max(0, axes[axis]));
  }

  return { axes, sourceFactors: [...new Set(factors)] };
}

/**
 * Compute personality-based emotional baseline — the character's resting emotional state.
 * A melancholic character always carries some tristezza; an anxious one always has paura.
 */
export function computePersonalityBaseline(traits: string[]): IPlutchikEmotions {
  const axes = { ...EMPTY_AXES };
  if (!traits || traits.length === 0) return axes;

  const traitsLower = traits.map(t => t.toLowerCase());

  // Mapping personality traits to resting emotional state
  const PERSONALITY_BASELINES: Array<{ keywords: string[]; axis: keyof IPlutchikEmotions; value: number }> = [
    { keywords: ['melanconico', 'triste', 'cupo', 'malinconico'], axis: 'tristezza', value: 0.15 },
    { keywords: ['ansioso', 'nervoso', 'apprensivo', 'preoccupato'], axis: 'paura', value: 0.12 },
    { keywords: ['allegro', 'ottimista', 'gioioso', 'solare'], axis: 'gioia', value: 0.12 },
    { keywords: ['diffidente', 'sospettoso', 'paranoico'], axis: 'anticipazione', value: 0.10 },
    { keywords: ['irascibile', 'collerico', 'aggressivo', 'rancoroso'], axis: 'rabbia', value: 0.12 },
    { keywords: ['cinico', 'sprezzante', 'disgustato'], axis: 'disgusto', value: 0.10 },
    { keywords: ['fiducioso', 'leale', 'fedele'], axis: 'fiducia', value: 0.10 },
    { keywords: ['curioso', 'vivace', 'intraprendente'], axis: 'anticipazione', value: 0.08 },
  ];

  for (const rule of PERSONALITY_BASELINES) {
    for (const keyword of rule.keywords) {
      if (traitsLower.some(t => t.includes(keyword))) {
        axes[rule.axis] = Math.max(axes[rule.axis], rule.value);
      }
    }
  }

  // Clamp to [0, 0.2] — personality baseline is subtle
  for (const axis of PLUTCHIK_AXES) {
    axes[axis] = Math.min(0.2, axes[axis]);
  }

  return axes;
}

/**
 * Merge personality baseline with relationship baseline.
 * Takes the max of each axis (they don't stack additively).
 */
export function mergeBaselines(personality: IPlutchikEmotions, relationship: IPlutchikEmotions): IPlutchikEmotions {
  const merged = { ...EMPTY_AXES };
  for (const axis of PLUTCHIK_AXES) {
    merged[axis] = Math.max(personality[axis] || 0, relationship[axis] || 0);
  }
  return merged;
}
