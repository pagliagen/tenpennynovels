/**
 * ConflictEngine — Conflict tracking, repair mechanics, and Gottman escalation.
 *
 * Tracks active conflicts between characters. Detects repair attempts.
 * Enables relationship recovery from regressive phases through dialogue.
 * All computation is deterministic (ZERO LLM calls).
 *
 * Gottman's Four Horsemen escalation:
 * 0 = criticism (normal conflict)
 * 1 = contempt (disgust > 0.5 during conflict)
 * 2 = defensiveness (repeated failed repair attempts)
 * 3 = stonewalling (avoiding phase + active conflict)
 */

import { IRelationship, IConflictState, ITurningPoint, AttachmentStyle } from '../models/Relationship';
import { PostAnalysisResult } from './PostResponseAnalyzer';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('ConflictEngine');

export interface RepairResult {
  repairSucceeded: boolean;
  severityReduction: number;
  resolved: boolean;
}

// ── Conflict Detection ──

/**
 * Detect if a new conflict should be activated based on recent turning points.
 * A conflict activates when a negative TP with importance >= 6 occurs.
 */
export function detectConflictActivation(
  relationship: IRelationship,
  newTurningPoint: ITurningPoint | null,
): IConflictState | null {
  // Don't create a new conflict if one is already active
  if (relationship.activeConflict?.isActive) return null;

  if (!newTurningPoint) return null;

  const negativeTpTypes = new Set(['betrayal', 'first_conflict', 'abandonment', 'rejection']);
  if (!negativeTpTypes.has(newTurningPoint.type)) return null;
  if (newTurningPoint.importanceWeight < 6) return null;

  logger.info(`[ConflictEngine] Conflict activated: ${newTurningPoint.type} (weight: ${newTurningPoint.importanceWeight})`);

  return {
    isActive: true,
    severity: Math.min(1.0, newTurningPoint.importanceWeight / 10),
    escalationLevel: 0, // Starts at criticism
    repairAttempts: 0,
    resolved: false,
  };
}

// ── Repair Evaluation ──

/**
 * Evaluate a repair attempt during an active conflict.
 * Repair success depends on: severity, prior attempts, trust integrity, attachment style.
 */
export function evaluateRepairAttempt(
  conflict: IConflictState,
  analysis: PostAnalysisResult,
  relationship: IRelationship,
  attachmentStyle: AttachmentStyle,
): RepairResult {
  if (!conflict.isActive || conflict.resolved) {
    return { repairSucceeded: false, severityReduction: 0, resolved: false };
  }

  // Detect repair signals from post-analysis
  const hasRepairSignal =
    (analysis.turningPoint?.type === 'reconciliation') ||
    (analysis.supportEvent.direction === 'given' && analysis.sentimentDelta > 0) ||
    (analysis.sentimentDelta > 0.05);

  if (!hasRepairSignal) {
    return { repairSucceeded: false, severityReduction: 0, resolved: false };
  }

  // Base repair chance decreases with severity and prior failed attempts
  let repairChance = 0.7; // Base 70% chance
  repairChance -= conflict.severity * 0.3; // High severity reduces chance
  repairChance -= conflict.repairAttempts * 0.15; // Each failed attempt reduces chance
  repairChance += (relationship.trustDimensions?.integrity || 0.5) * 0.2; // High integrity helps

  // Attachment style modifiers
  switch (attachmentStyle) {
    case 'secure':
      repairChance += 0.1; // Secure: better at repair
      break;
    case 'anxious':
      repairChance += 0.05; // Anxious: motivated to repair, sometimes too eager
      break;
    case 'avoidant':
      repairChance -= 0.15; // Avoidant: resistant to repair
      break;
    case 'disorganized':
      repairChance -= 0.1; // Disorganized: unpredictable
      break;
  }

  repairChance = Math.max(0.1, Math.min(0.9, repairChance));

  // Deterministic threshold based on sentiment improvement + turning point impact
  const repairStrength = Math.abs(analysis.sentimentDelta) + (analysis.turningPoint?.emotionalImpact || 0);
  const succeeded = repairStrength > (1 - repairChance) * 0.3;

  if (succeeded) {
    const severityReduction = Math.min(conflict.severity, 0.3 + repairStrength * 0.5);
    const newSeverity = conflict.severity - severityReduction;
    const resolved = newSeverity < 0.15;

    logger.info(`[ConflictEngine] Repair succeeded: severity ${conflict.severity.toFixed(2)} → ${newSeverity.toFixed(2)}${resolved ? ' (RESOLVED)' : ''}`);

    return {
      repairSucceeded: true,
      severityReduction,
      resolved,
    };
  }

  logger.info(`[ConflictEngine] Repair attempt failed (strength: ${repairStrength.toFixed(2)}, needed: ${((1 - repairChance) * 0.3).toFixed(2)})`);
  return { repairSucceeded: false, severityReduction: 0, resolved: false };
}

// ── Escalation ──

/**
 * Compute Gottman escalation level based on relationship state during active conflict.
 * 0 = criticism, 1 = contempt, 2 = defensiveness, 3 = stonewalling
 */
export function computeEscalationLevel(
  relationship: IRelationship,
  emotionDisgusto: number = 0,
): number {
  const conflict = relationship.activeConflict;
  if (!conflict?.isActive) return 0;

  let level = conflict.escalationLevel;

  // Level 1: Contempt — disgust > 0.5 during active conflict
  if (emotionDisgusto > 0.5 && level < 1) {
    level = 1;
  }

  // Level 2: Defensiveness — 2+ failed repair attempts
  if (conflict.repairAttempts >= 2 && level < 2) {
    level = 2;
  }

  // Level 3: Stonewalling — avoiding phase + active conflict
  if ((relationship.phase === 'avoiding' || relationship.phase === 'terminating') && level < 3) {
    level = 3;
  }

  return level;
}

// ── Conflict State Update ──

/**
 * Update conflict state after interaction analysis.
 * Returns updated conflict state or null if no conflict exists.
 */
export function updateConflictState(
  relationship: IRelationship,
  analysis: PostAnalysisResult,
  attachmentStyle: AttachmentStyle,
  disgustoLevel: number = 0,
): IConflictState | null {
  const conflict = relationship.activeConflict;

  // Check if a new conflict should be activated
  if (!conflict?.isActive) {
    const tp = analysis.turningPoint ? {
      type: analysis.turningPoint.type as any,
      description: analysis.turningPoint.description || '',
      emotionalImpact: analysis.turningPoint.emotionalImpact,
      importanceWeight: analysis.turningPoint.importanceWeight,
      timestamp: new Date(),
      trustDeltaAtTime: 0,
      sentimentDeltaAtTime: analysis.sentimentDelta,
    } : null;
    return detectConflictActivation(relationship, tp);
  }

  // Evaluate repair attempt
  const repairResult = evaluateRepairAttempt(conflict, analysis, relationship, attachmentStyle);

  const updated: IConflictState = { ...conflict };

  if (repairResult.repairSucceeded) {
    updated.severity -= repairResult.severityReduction;
    updated.repairAttempts++;
    updated.lastRepairAt = new Date();
    if (repairResult.resolved) {
      updated.isActive = false;
      updated.resolved = true;
    }
  } else if (analysis.sentimentDelta > 0.03) {
    // Positive but not enough to count as full repair
    updated.repairAttempts++;
    updated.lastRepairAt = new Date();
  }

  // Update escalation level
  updated.escalationLevel = computeEscalationLevel(
    { ...relationship, activeConflict: updated } as any,
    disgustoLevel,
  );

  // Escalation increases severity if unchecked
  if (analysis.sentimentDelta < -0.03 && !repairResult.repairSucceeded) {
    updated.severity = Math.min(1.0, updated.severity + 0.05);
  }

  return updated;
}

// ── Prompt Guidance ──

/**
 * Generate conflict-aware guidance text for the system prompt.
 */
export function getConflictGuidance(conflict: IConflictState | undefined): string {
  if (!conflict?.isActive) return '';

  const parts: string[] = ['--- CONFLITTO IN CORSO ---'];

  if (conflict.severity > 0.7) {
    parts.push('C\'è un conflitto GRAVE irrisolto con questa persona. La tensione è palpabile.');
  } else if (conflict.severity > 0.4) {
    parts.push('C\'è un conflitto significativo irrisolto con questa persona.');
  } else {
    parts.push('C\'è una tensione irrisolta con questa persona, anche se non grave.');
  }

  const escalationDesc = [
    'La situazione è ancora gestibile con dialogo.', // 0: criticism
    'Il disprezzo sta emergendo — attenzione a non peggiorare.', // 1: contempt
    'Entrambi siete sulla difensiva. Ogni parola può essere mal interpretata.', // 2: defensiveness
    'Il muro del silenzio si sta alzando. La comunicazione si è quasi interrotta.', // 3: stonewalling
  ];
  parts.push(escalationDesc[conflict.escalationLevel] || escalationDesc[0]);

  if (conflict.repairAttempts > 0) {
    parts.push(`Ci sono stati ${conflict.repairAttempts} tentativi di riconciliazione${conflict.repairAttempts > 1 ? ', non tutti riusciti' : ''}.`);
  }

  parts.push('Questo conflitto colora ogni interazione. In base al tuo carattere, potresti: cercare di riparare, irrigidirti, attaccare, o evitare il confronto.');

  return parts.join('\n');
}
