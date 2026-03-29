import {
  IBot, IPlutchikEmotions, IEmotionState, PLUTCHIK_AXES, PLUTCHIK_LABELS,
  AXIS_HALF_LIFE_MS, TRAIT_EMOTION_RULES, IPersonalityProfile,
} from '../models/Bot';
import { IRelationship } from '../models/Relationship';

const MIN_AXIS_VALUE = 0.05; // sotto questo valore, l'asse è considerato 0

export function emptyAxes(): IPlutchikEmotions {
  return { gioia: 0, fiducia: 0, paura: 0, sorpresa: 0, tristezza: 0, disgusto: 0, rabbia: 0, anticipazione: 0 };
}

// ── Emotion Regulation Types ──────────────────────────────────────────

export interface EmotionPair {
  felt: IPlutchikEmotions;
  expressed: IPlutchikEmotions;
  suppressionBurden: number;
  breakthroughOccurred: boolean;
}

// ── Personality Profile ─────────────────────────────────────────────

/**
 * Costruisce un profilo di modulazione emotiva dai tratti di personalità.
 * Scansiona i tratti (stringhe) per keyword match e accumula modificatori per asse.
 * Se nessun tratto matcha, restituisce default neutri (cap=1, amplifier=1, decay=1).
 */
const _profileCache = new Map<string, IPersonalityProfile>();

export function buildPersonalityProfile(traits: string[]): IPersonalityProfile {
  const cacheKey = [...traits].sort().join('|').toLowerCase();
  const cached = _profileCache.get(cacheKey);
  if (cached) return cached;

  const lowerTraits = traits.map(t => t.toLowerCase());

  let globalCap = 1.0;
  let globalAmplifier = 1.0;
  const axisData: Record<string, { decayMultiplier: number; cap: number; amplifier: number }> = {};

  for (const axis of PLUTCHIK_AXES) {
    axisData[axis] = { decayMultiplier: 1.0, cap: 1.0, amplifier: 1.0 };
  }

  for (const rule of TRAIT_EMOTION_RULES) {
    const matched = rule.keywords.some(kw => lowerTraits.some(t => t.includes(kw)));
    if (!matched) continue;

    for (const axis of rule.modifier.axes) {
      if (rule.modifier.decayMultiplier !== undefined) {
        axisData[axis].decayMultiplier = Math.max(axisData[axis].decayMultiplier, rule.modifier.decayMultiplier);
      }
      if (rule.modifier.capOverride !== undefined) {
        axisData[axis].cap = Math.min(axisData[axis].cap, rule.modifier.capOverride);
      }
      if (rule.modifier.amplifier !== undefined) {
        axisData[axis].amplifier = Math.max(axisData[axis].amplifier, rule.modifier.amplifier);
      }
    }

    if (rule.modifier.axes.length === PLUTCHIK_AXES.length) {
      if (rule.modifier.capOverride !== undefined) globalCap = Math.min(globalCap, rule.modifier.capOverride);
      if (rule.modifier.amplifier !== undefined) globalAmplifier = Math.max(globalAmplifier, rule.modifier.amplifier);
    }
  }

  // Derive emotionalControl from trait keywords
  // High control: freddo, riservato, stoico, controllato, aristocratico, nobile
  // Low control: passionale, emotivo, impulsivo, esuberante, focoso
  let emotionalControl = 0.5;
  const controlUp = ['freddo', 'riservat', 'distaccat', 'stoic', 'impassibile', 'controllat', 'aristocratic', 'nobile', 'composto', 'misurato'];
  const controlDown = ['passionale', 'emotiv', 'impulsiv', 'esuberante', 'focos', 'ardente', 'irascibile', 'colleric'];
  if (controlUp.some(kw => lowerTraits.some(t => t.includes(kw)))) {
    emotionalControl = Math.min(1.0, emotionalControl + 0.3);
  }
  if (controlDown.some(kw => lowerTraits.some(t => t.includes(kw)))) {
    emotionalControl = Math.max(0.0, emotionalControl - 0.3);
  }

  const result: IPersonalityProfile = { globalCap, globalAmplifier, emotionalControl, axisModifiers: new Map() };
  for (const axis of PLUTCHIK_AXES) {
    result.axisModifiers.set(axis as typeof PLUTCHIK_AXES[number], axisData[axis]);
  }
  _profileCache.set(cacheKey, result);
  return result;
}

// ── Decay differenziato per asse ────────────────────────────────────

function applyDecayToAxes(
  axes: IPlutchikEmotions,
  updatedAt: Date | undefined,
  profile?: IPersonalityProfile,
  baseline?: IPlutchikEmotions,
): IPlutchikEmotions {
  if (!updatedAt) return axes;
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  if (ageMs <= 0) return axes;

  const decayed = { ...axes };
  for (const axis of PLUTCHIK_AXES) {
    let halfLife = AXIS_HALF_LIFE_MS[axis];

    if (profile) {
      const mod = profile.axisModifiers.get(axis);
      if (mod) halfLife *= mod.decayMultiplier;
    }

    const decayFactor = Math.pow(0.5, ageMs / halfLife);
    const floor = baseline?.[axis] || 0;
    // Decay toward baseline instead of zero
    decayed[axis] = floor + ((axes[axis] || 0) - floor) * decayFactor;
    if (decayed[axis] < MIN_AXIS_VALUE) decayed[axis] = 0;
  }
  return decayed;
}

// ── API pubblica ────────────────────────────────────────────────────

/** Ritorna gli assi emotivi globali del bot con decay + profilo personalità */
export function getGlobalEmotions(bot: IBot, personalityBaseline?: IPlutchikEmotions): IPlutchikEmotions {
  const state = bot.emotionState;
  if (!state?.axes) return personalityBaseline || emptyAxes();
  const profile = buildPersonalityProfile(bot.personality?.traits || []);
  return applyDecayToAxes(state.axes, state.updatedAt, profile, personalityBaseline);
}

/** Ritorna gli assi emotivi relazionali con decay + profilo personalità */
export function getRelationshipEmotions(relationship: IRelationship | null, bot?: IBot, baseline?: IPlutchikEmotions): IPlutchikEmotions {
  if (!relationship?.emotionState?.axes) return baseline || emptyAxes();
  const profile = bot ? buildPersonalityProfile(bot.personality?.traits || []) : undefined;
  return applyDecayToAxes(relationship.emotionState.axes, relationship.emotionState.updatedAt, profile, baseline);
}

/** Descrive le emozioni attive in italiano per il prompt LLM */
export function describeEmotions(axes: IPlutchikEmotions): string {
  const descriptions: string[] = [];

  for (const axis of PLUTCHIK_AXES) {
    const value = axes[axis] || 0;
    if (value < MIN_AXIS_VALUE) continue;

    const labels = PLUTCHIK_LABELS[axis];
    const label = value > 0.7 ? labels[2] : value > 0.4 ? labels[1] : labels[0];
    descriptions.push(label);
  }

  if (descriptions.length === 0) return '';
  return `In questo momento ti senti: ${descriptions.join(', ')}.`;
}

/**
 * Mergia nuovi valori Plutchik con quelli esistenti come emozioni SENTITE (felt).
 *
 * IMPORTANTE: amplifier e cap NON vengono applicati qui.
 * Sono modificatori di ESPRESSIONE, non di SENTIMENTO.
 * Un personaggio "freddo" SENTE normalmente ma ESPRIME con amplifier/cap.
 * Vedi computeExpressedEmotions() per la regolazione dell'espressione.
 *
 * Features:
 * - Decay differenziato per asse (rabbia decade lenta, sorpresa veloce)
 * - Inerzia emotiva: emozioni ad alta intensità resistono al cambio
 * - Personality decay multipliers (rancoroso = rabbia decade più lenta)
 */
export function mergeEmotions(
  existing: IEmotionState | undefined,
  newAxes: Partial<IPlutchikEmotions> | null,
  trigger: string,
  traits?: string[],
): IEmotionState {
  const profile = buildPersonalityProfile(traits || []);
  // Decay usa solo decayMultiplier dalla personalità, NON amplifier/cap
  const current = existing?.axes
    ? applyDecayToAxes(existing.axes, existing.updatedAt, profile)
    : emptyAxes();

  if (!newAxes) {
    return {
      axes: current,
      trigger: existing?.trigger || '',
      updatedAt: new Date(),
      suppressionBurden: existing?.suppressionBurden,
    };
  }

  const merged = { ...current };
  for (const axis of PLUTCHIK_AXES) {
    const newVal = newAxes[axis];
    if (newVal === undefined || newVal <= 0) continue;

    // NO amplifier qui — le emozioni RAW vengono mergiate come sentite
    if (current[axis] > 0) {
      // Inerzia emotiva: ad alta intensità, l'emozione esistente resiste al cambio
      const blendWeight = Math.max(0.3, 1 - current[axis] * 0.5);
      merged[axis] = current[axis] * (1 - blendWeight) + newVal * blendWeight;
    } else {
      merged[axis] = newVal;
    }

    // NO cap qui — il cap si applica solo all'espressione
    // Clamp a 1.0 come limite fisico
    merged[axis] = Math.min(1.0, merged[axis]);
  }

  return {
    axes: merged,
    trigger,
    updatedAt: new Date(),
    suppressionBurden: existing?.suppressionBurden,
  };
}

/** Determina il mood dominante dagli assi Plutchik */
export function deriveMoodFromAxes(axes: IPlutchikEmotions): string {
  // Phase 2: Check secondary emotions first — they may dominate
  const { deriveSecondaryEmotions, detectAmbivalence } = require('./SecondaryEmotions');
  const secondaries = deriveSecondaryEmotions(axes);

  // Find max primary axis
  let maxAxis = '';
  let maxValue = 0;
  for (const axis of PLUTCHIK_AXES) {
    if ((axes[axis] || 0) > maxValue) {
      maxValue = axes[axis] || 0;
      maxAxis = axis;
    }
  }

  if (maxValue < MIN_AXIS_VALUE || !maxAxis) return 'neutro';

  // If strongest secondary emotion intensity > max primary, use the secondary
  if (secondaries.length > 0 && secondaries[0].intensity > maxValue) {
    return secondaries[0].nameIT;
  }

  // Check for ambivalence (two opposing axes close in value and both strong)
  const ambivalence = detectAmbivalence(axes);
  if (ambivalence) {
    // Find the two strongest axes
    const sorted = PLUTCHIK_AXES.map(a => ({ axis: a, val: axes[a] || 0 }))
      .sort((a, b) => b.val - a.val);
    if (sorted[0].val > 0.3 && sorted[1].val > 0.3 && Math.abs(sorted[0].val - sorted[1].val) < 0.15) {
      const labels0 = PLUTCHIK_LABELS[sorted[0].axis];
      const labels1 = PLUTCHIK_LABELS[sorted[1].axis];
      const label0 = sorted[0].val > 0.4 ? labels0[1] : labels0[0];
      const label1 = sorted[1].val > 0.4 ? labels1[1] : labels1[0];
      return `${label0}/${label1}`;
    }
  }

  // Fallback: single dominant primary
  const labels = PLUTCHIK_LABELS[maxAxis];
  return maxValue > 0.7 ? labels[2] : maxValue > 0.4 ? labels[1] : labels[0];
}

// ── Emotion Regulation ────────────────────────────────────────────────

/**
 * Calcola le emozioni ESPRESSE dal felt, applicando amplifier/cap della personalità.
 * Quando suppressionBurden è alto, le emozioni "trapelano" (leaking quadratico).
 *
 * Un personaggio freddo (amplifier 0.6, cap 0.4) SENTE rabbia a 0.8
 * ma ESPRIME rabbia a 0.8*0.6 = 0.48, poi capped a 0.4.
 * Se burden = 0.7 → leakFactor = 0.49 → expressed = 0.4 + (0.8-0.4)*0.49 = 0.596
 */
export interface ExpressedResult {
  axes: IPlutchikEmotions;
  breakthroughOccurred: boolean;
}

const BREAKTHROUGH_THRESHOLD = 0.85;
const POST_BREAKTHROUGH_BURDEN = 0.15;

export function computeExpressedEmotions(
  feltAxes: IPlutchikEmotions,
  profile: IPersonalityProfile,
  suppressionBurden: number = 0,
): ExpressedResult {
  // BREAKTHROUGH: when suppression burden exceeds threshold, control collapses.
  // All felt emotions are expressed unfiltered. Burden resets (relief after explosion).
  if (suppressionBurden > BREAKTHROUGH_THRESHOLD) {
    return { axes: { ...feltAxes }, breakthroughOccurred: true };
  }

  const expressed = { ...feltAxes };

  for (const axis of PLUTCHIK_AXES) {
    const feltVal = feltAxes[axis] || 0;
    if (feltVal < MIN_AXIS_VALUE) {
      expressed[axis] = 0;
      continue;
    }

    const mod = profile.axisModifiers.get(axis);
    let val = feltVal;
    if (mod) {
      val = feltVal * mod.amplifier;
      const cap = Math.min(mod.cap, profile.globalCap);
      val = Math.min(cap, val);
    }

    const leakFactor = suppressionBurden * suppressionBurden;
    expressed[axis] = val + (feltVal - val) * leakFactor;

    if (expressed[axis] < MIN_AXIS_VALUE) expressed[axis] = 0;
  }

  return { axes: expressed, breakthroughOccurred: false };
}

/**
 * Calcola il costo cumulativo della soppressione emotiva.
 * Accumula quando felt > expressed, decade lentamente tra interazioni.
 * Quando burden raggiunge ~0.6+, le emozioni iniziano a "trapelare".
 */
export function computeSuppressionBurden(
  feltAxes: IPlutchikEmotions,
  expressedAxes: IPlutchikEmotions,
  existingBurden: number = 0,
): number {
  let totalSuppression = 0;
  for (const axis of PLUTCHIK_AXES) {
    const diff = Math.max(0, (feltAxes[axis] || 0) - (expressedAxes[axis] || 0));
    totalSuppression += diff;
  }
  // Normalizza: 8 assi, diff max 1 ciascuno → max totalSuppression = 8
  const newBurden = totalSuppression / 8;

  const BURDEN_ACCUMULATION = 0.3; // velocità di accumulo
  const BURDEN_DECAY = 0.9;        // ritenzione del burden tra interazioni
  const result = existingBurden * BURDEN_DECAY + newBurden * BURDEN_ACCUMULATION;
  return Math.min(1.0, result);
}

/**
 * Descrive emozioni sentite e espresse separatamente per il prompt LLM.
 * Identifica anche quali emozioni vengono attivamente represse.
 */
export function describeEmotionsSplit(
  feltAxes: IPlutchikEmotions,
  expressedAxes: IPlutchikEmotions,
): { felt: string; expressed: string; suppressing: string } {
  const felt = describeEmotions(feltAxes);
  const expressed = describeEmotions(expressedAxes);

  // Identifica emozioni significativamente represse (felt - expressed > 0.15)
  const suppressedLabels: string[] = [];
  for (const axis of PLUTCHIK_AXES) {
    const feltVal = feltAxes[axis] || 0;
    const expressedVal = expressedAxes[axis] || 0;
    if (feltVal - expressedVal > 0.15) {
      const labels = PLUTCHIK_LABELS[axis];
      const label = feltVal > 0.7 ? labels[2] : feltVal > 0.4 ? labels[1] : labels[0];
      suppressedLabels.push(label);
    }
  }
  const suppressing = suppressedLabels.length > 0
    ? `Stai reprimendo: ${suppressedLabels.join(', ')}.`
    : '';

  return { felt, expressed, suppressing };
}

/**
 * Ritorna la coppia felt/expressed per le emozioni globali del bot.
 * Applica decay al felt, poi calcola expressed tramite il profilo personalità.
 */
export function getGlobalEmotionPair(bot: IBot, personalityBaseline?: IPlutchikEmotions): EmotionPair {
  const state = bot.emotionState;
  if (!state?.axes) {
    const base = personalityBaseline || emptyAxes();
    return { felt: base, expressed: base, suppressionBurden: 0, breakthroughOccurred: false };
  }
  const profile = buildPersonalityProfile(bot.personality?.traits || []);
  const felt = applyDecayToAxes(state.axes, state.updatedAt, profile, personalityBaseline);
  const burden = state.suppressionBurden || 0;
  const result = computeExpressedEmotions(felt, profile, burden);
  return { felt, expressed: result.axes, suppressionBurden: burden, breakthroughOccurred: result.breakthroughOccurred };
}

/**
 * Ritorna la coppia felt/expressed per le emozioni relazionali.
 * Accepts optional baseline from relationship history (Phase 1).
 */
export function getRelationshipEmotionPair(
  relationship: IRelationship | null,
  bot?: IBot,
  relationshipBaseline?: IPlutchikEmotions,
): EmotionPair {
  if (!relationship?.emotionState?.axes) {
    const base = relationshipBaseline || emptyAxes();
    return { felt: base, expressed: base, suppressionBurden: 0, breakthroughOccurred: false };
  }
  const profile = bot ? buildPersonalityProfile(bot.personality?.traits || []) : undefined;
  const felt = applyDecayToAxes(
    relationship.emotionState.axes,
    relationship.emotionState.updatedAt,
    profile,
    relationshipBaseline,
  );
  const burden = relationship.emotionState.suppressionBurden || 0;
  if (profile) {
    const result = computeExpressedEmotions(felt, profile, burden);
    return { felt, expressed: result.axes, suppressionBurden: burden, breakthroughOccurred: result.breakthroughOccurred };
  }
  return { felt, expressed: felt, suppressionBurden: burden, breakthroughOccurred: false };
}
