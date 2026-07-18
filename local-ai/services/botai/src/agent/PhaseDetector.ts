import {
  IRelationship, RelationshipPhase, ITrendSnapshot, IPhaseHistoryEntry,
} from '../models/Relationship';
import { AttachmentStyle } from '../models/Relationship';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('PhaseDetector');

const PHASE_ORDER: RelationshipPhase[] = [
  'initiating', 'experimenting', 'intensifying', 'integrating', 'bonding',
];

const REGRESSION_PHASES: RelationshipPhase[] = [
  'differentiating', 'circumscribing', 'stagnating', 'avoiding', 'terminating',
];

// Cooldown: minimum interactions between phase changes
const PHASE_COOLDOWN = 3;

interface PhaseSignals {
  interactionCount: number;
  qualityScore: number;
  familiarity: number;
  trust: number;
  sentiment: number;
  disclosureDepth: number;
  positiveTurningPoints: number;
  negativeTurningPoints: number;
  highWeightPositiveTPs: number;  // TPs with weight >= 6
  veryHighWeightPositiveTPs: number; // TPs with weight >= 7
  recentSentimentTrend: 'improving' | 'declining' | 'stable' | 'volatile';
  recentTrustTrend: 'improving' | 'declining' | 'stable' | 'volatile';
  timeSinceLastInteraction: number; // ms
  hasBetrayalTP: boolean;          // recent betrayal/abandonment with weight >= 9
  consecutiveNegativeSentiments: number; // consecutive trend snapshots with declining sentiment
}

// ── Phase Advancement Thresholds ──────────────────────────────────────

interface AdvancementThreshold {
  target: RelationshipPhase;
  conditions: (signals: PhaseSignals, attachment: AttachmentStyle) => boolean;
}

function avoidantPenalty(val: number, attachment: AttachmentStyle): number {
  return attachment === 'avoidant' ? val * 1.3 : val;
}

// Quality-weighted thresholds: phase transitions depend on interaction DEPTH, not just count.
// qualityScore accumulates based on sentimentDelta, familiarityDelta, and turningPoints.
// A deep crisis conversation might add 1.0+, while a superficial "hello" adds ~0.2.
const ADVANCEMENT_THRESHOLDS: AdvancementThreshold[] = [
  {
    target: 'experimenting',
    conditions: (s, a) =>
      s.interactionCount >= 2 &&
      s.qualityScore >= avoidantPenalty(0.5, a) &&
      s.familiarity >= avoidantPenalty(0.1, a),
  },
  {
    target: 'intensifying',
    conditions: (s, a) =>
      s.qualityScore >= avoidantPenalty(3.0, a) &&
      s.familiarity >= avoidantPenalty(0.3, a) &&
      s.trust >= avoidantPenalty(0.55, a) &&
      s.disclosureDepth >= 0.3 &&
      s.sentiment >= 0.1,
  },
  {
    target: 'integrating',
    conditions: (s, a) =>
      s.qualityScore >= avoidantPenalty(8.0, a) &&
      s.familiarity >= avoidantPenalty(0.6, a) &&
      s.trust >= avoidantPenalty(0.7, a) &&
      s.disclosureDepth >= 0.5 &&
      s.highWeightPositiveTPs >= 1,
  },
  {
    target: 'bonding',
    conditions: (s, a) =>
      s.qualityScore >= avoidantPenalty(15.0, a) &&
      s.trust >= avoidantPenalty(0.85, a) &&
      s.sentiment >= 0.4 &&
      s.veryHighWeightPositiveTPs >= 2,
  },
];

// ── Regression Triggers ───────────────────────────────────────────────

interface RegressionTrigger {
  target: RelationshipPhase;
  condition: (signals: PhaseSignals) => boolean;
}

const REGRESSION_TRIGGERS: RegressionTrigger[] = [
  {
    target: 'differentiating',
    condition: (s) => s.consecutiveNegativeSentiments >= 3 && s.recentSentimentTrend === 'declining',
  },
  {
    target: 'circumscribing',
    condition: (s) => s.trust < 0.4 && s.disclosureDepth < 0.2,
  },
  {
    target: 'stagnating',
    condition: (s) => s.timeSinceLastInteraction > 60 * 24 * 60 * 60 * 1000 && s.recentSentimentTrend !== 'improving',
  },
  {
    target: 'avoiding',
    condition: (s) => s.sentiment < -0.5 && s.trust < 0.3,
  },
  {
    target: 'terminating',
    condition: (s) => s.hasBetrayalTP && s.trust < 0.15,
  },
];

// ── Phase Detection ───────────────────────────────────────────────────

export function extractPhaseSignals(r: IRelationship): PhaseSignals {
  const turningPoints = r.turningPoints || [];
  const trendSnapshots = r.trendSnapshots || [];

  return {
    interactionCount: r.interactionCount,
    qualityScore: r.qualityScore || 0,
    familiarity: r.familiarity,
    trust: r.trust,
    sentiment: r.sentiment,
    disclosureDepth: r.disclosure?.depth || 0,
    positiveTurningPoints: turningPoints.filter(tp => tp.emotionalImpact > 0).length,
    negativeTurningPoints: turningPoints.filter(tp => tp.emotionalImpact < 0).length,
    highWeightPositiveTPs: turningPoints.filter(tp => tp.emotionalImpact > 0 && tp.importanceWeight >= 6).length,
    veryHighWeightPositiveTPs: turningPoints.filter(tp => tp.emotionalImpact > 0 && tp.importanceWeight >= 7).length,
    recentSentimentTrend: computeTrend(trendSnapshots, 'sentiment'),
    recentTrustTrend: computeTrend(trendSnapshots, 'trust'),
    timeSinceLastInteraction: Date.now() - new Date(r.lastInteraction).getTime(),
    hasBetrayalTP: turningPoints.some(tp =>
      (tp.type === 'betrayal' || tp.type === 'abandonment') && tp.importanceWeight >= 9,
    ),
    consecutiveNegativeSentiments: countConsecutiveDeclines(trendSnapshots, 'sentiment'),
  };
}

/**
 * Detects if a phase transition should occur based on current relationship state.
 * Returns the new phase if transition happens, null otherwise.
 *
 * Rules:
 * - Advancement: max 1 phase forward per interaction, ALL conditions must be met
 * - Regression: can skip multiple phases for severe events
 * - Cooldown: minimum PHASE_COOLDOWN interactions since last phase change
 */
export function detectPhaseTransition(
  relationship: IRelationship,
  attachmentStyle: AttachmentStyle,
): RelationshipPhase | null {
  const signals = extractPhaseSignals(relationship);
  const currentPhase = relationship.phase || 'initiating';

  // Check cooldown: estimate interactions since last phase change using phaseHistory length
  // Each phase entry = 1 transition. Total interactions minus transitions gives a rough proxy.
  // More robust: compare phaseEnteredAt to lastInteraction relative to interactionCount.
  const phaseHistory = relationship.phaseHistory || [];
  const lastEntry = phaseHistory.length > 0 ? phaseHistory[phaseHistory.length - 1] : null;
  const phaseEnteredAt = lastEntry?.enteredAt ? new Date(lastEntry.enteredAt).getTime() : 0;
  const lastInteractionAt = relationship.lastInteraction ? new Date(relationship.lastInteraction).getTime() : Date.now();
  // If phase was entered very recently (within last PHASE_COOLDOWN interactions worth of time),
  // use a heuristic: average ~1 interaction per 10 minutes in active play
  const timeSincePhaseEntry = lastInteractionAt - phaseEnteredAt;
  const estimatedInteractionsSincePhaseChange = phaseHistory.length <= 1
    ? relationship.interactionCount // first phase = all interactions
    : Math.max(1, Math.floor(timeSincePhaseEntry / (10 * 60 * 1000))); // ~1 per 10 min

  // Check regression first (higher priority than advancement, bypasses cooldown)
  for (const trigger of REGRESSION_TRIGGERS) {
    if (trigger.condition(signals)) {
      const regressionIdx = REGRESSION_PHASES.indexOf(trigger.target);
      const currentComingTogetherIdx = PHASE_ORDER.indexOf(currentPhase);
      const currentRegressionIdx = REGRESSION_PHASES.indexOf(currentPhase);

      // Only regress if this is a worse phase than current
      if (currentComingTogetherIdx >= 0 || (currentRegressionIdx >= 0 && regressionIdx > currentRegressionIdx)) {
        logger.info(`Phase REGRESSION: ${currentPhase} → ${trigger.target} (signals triggered)`);
        return trigger.target;
      }
    }
  }

  // Phase 3: Check RECOVERY from regressive phases (conflict resolved + positive signals)
  const REGRESSION_PHASE_SET = new Set(REGRESSION_PHASES);
  if (REGRESSION_PHASE_SET.has(currentPhase as any)) {
    const conflictResolved = relationship.activeConflict?.resolved === true;
    const trustRecovering = relationship.trust > 0.4;
    const sentimentImproving = relationship.sentiment > -0.1;

    if (conflictResolved && trustRecovering && sentimentImproving) {
      // Recovery target depends on current regressive phase (never jump more than 2 phases)
      const recoveryMap: Record<string, RelationshipPhase> = {
        'differentiating': 'experimenting',
        'circumscribing': 'experimenting',
        'stagnating': 'experimenting',
        'avoiding': 'differentiating',
        'terminating': 'circumscribing',
      };
      const recoveryTarget = recoveryMap[currentPhase];
      if (recoveryTarget) {
        logger.info(`Phase RECOVERY: ${currentPhase} → ${recoveryTarget} (conflict resolved)`);
        return recoveryTarget;
      }
    }
  }

  // Check advancement (only from coming-together phases, with cooldown)
  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  if (currentIdx < 0) return null; // already in regression phase, can't advance

  // Enforce cooldown: must have at least PHASE_COOLDOWN interactions since last phase change
  if (estimatedInteractionsSincePhaseChange < PHASE_COOLDOWN) {
    return null;
  }

  // Can only advance one step at a time
  const nextIdx = currentIdx + 1;
  if (nextIdx >= PHASE_ORDER.length) return null; // already at bonding

  const nextPhase = PHASE_ORDER[nextIdx];
  const threshold = ADVANCEMENT_THRESHOLDS.find(t => t.target === nextPhase);
  if (!threshold) return null;

  if (threshold.conditions(signals, attachmentStyle)) {
    logger.info(`Phase ADVANCEMENT: ${currentPhase} → ${nextPhase}`);
    return nextPhase;
  }

  return null;
}

/**
 * Creates a phase history entry and returns updated history.
 */
export function recordPhaseTransition(
  currentHistory: IPhaseHistoryEntry[],
  newPhase: RelationshipPhase,
): IPhaseHistoryEntry[] {
  const history = [...currentHistory];

  // Close the current phase entry
  if (history.length > 0) {
    history[history.length - 1].exitedAt = new Date();
  }

  // Add new phase entry
  history.push({ phase: newPhase, enteredAt: new Date() });

  return history;
}

// ── Trend Computation ─────────────────────────────────────────────────

export function computeTrend(
  snapshots: ITrendSnapshot[],
  field: 'trust' | 'sentiment' | 'familiarity',
): 'improving' | 'declining' | 'stable' | 'volatile' {
  if (snapshots.length < 3) return 'stable';
  const recent = snapshots.slice(-5);
  const deltas = recent.slice(1).map((s, i) => (s as any)[field] - (recent[i] as any)[field]);
  const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance = deltas.reduce((a, d) => a + Math.pow(d - avgDelta, 2), 0) / deltas.length;

  if (variance > 0.01) return 'volatile';
  if (avgDelta > 0.005) return 'improving';
  if (avgDelta < -0.005) return 'declining';
  return 'stable';
}

function countConsecutiveDeclines(snapshots: ITrendSnapshot[], field: 'trust' | 'sentiment'): number {
  if (snapshots.length < 2) return 0;
  let count = 0;
  for (let i = snapshots.length - 1; i > 0; i--) {
    if ((snapshots[i] as any)[field] < (snapshots[i - 1] as any)[field]) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ── Phase Guidance (for PromptBuilder) ────────────────────────────────

export const PHASE_GUIDANCE: Record<RelationshipPhase, string> = {
  initiating: 'Primo contatto. Stai valutando questa persona — impressioni iniziali, aspetto, linguaggio.',
  experimenting: 'Vi state conoscendo. Conversazioni leggere, alla ricerca di punti in comune. Non condividere troppo.',
  intensifying: 'Il rapporto si sta approfondendo. Puoi condividere qualcosa di più personale, mostrare affetto o fiducia.',
  integrating: 'Siete parte della vita l\'uno dell\'altro. Riferimenti condivisi, battute interne, fiducia consolidata.',
  bonding: 'Legame profondo. Lealtà, protezione reciproca, vulnerabilità accettata.',
  differentiating: 'Qualcosa non va. Stai riscoprendo i confini tra "io" e "te". Tensione sottile.',
  circumscribing: 'Ci sono argomenti che eviti. Le conversazioni sono diventate superficiali per scelta.',
  stagnating: 'Il rapporto è immobile. Interagite per inerzia, senza vera connessione.',
  avoiding: 'Preferiresti non incontrare questa persona. Disagio, freddezza, risposte minime.',
  terminating: 'Il rapporto è finito. Indifferenza o ostilità aperta.',
};
