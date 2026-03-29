/**
 * ContextBuilder — Deterministic context analysis (ZERO LLM calls).
 *
 * Replaces the old ContextAnalyzer that used an LLM call to produce ContextInsights.
 * All fields that required free-form inference (whoIsThis, ourHistory, suggestedApproach,
 * theoryOfMind, etc.) are now built deterministically from relationship data, memories,
 * and bot personality — then injected directly into the system prompt by PromptBuilder.
 *
 * Fields that genuinely require LLM inference (theoryOfMind narratives, impression goals)
 * are delegated to the system prompt itself: the LLM infers them while generating the response.
 */

import { IBot, IPlutchikEmotions, INeed, IGoal } from '../models/Bot';
import { IMemory } from '../models/Memory';
import { IRelationship } from '../models/Relationship';
import { TimePassageInfo } from '../utils/SessionDetector';
import { describeEmotions } from './EmotionManager';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('ContextBuilder');

// ── Public interfaces ──

export interface PresentRelationshipInfo {
  characterId: string;
  displayName: string;
  relationshipType: string;
  perceivedStatus: string;
  sentiment: number;
}

export interface ContextData {
  // Deterministic fields (computed, no LLM)
  isFirstEncounter: boolean;
  frontStageMode: boolean;
  timePassage: TimePassageInfo;
  phase: string;
  perceivedStatus: string;
  relationshipType: string;
  reciprocityBalance: string;
  emotionalClimate: string;

  // Structured data for prompt injection
  relationship: IRelationship | null;
  memories: IMemory[];
  globalEmotions: IPlutchikEmotions;
  relationshipEmotions: IPlutchikEmotions;
  displayName: string;
  presentRelationships: PresentRelationshipInfo[];
  selfMonitoring: number;
  decayedNeeds: INeed[];
  activeGoals: IGoal[];

  // Pre-built text blocks for PromptBuilder
  memoryBlock: string;
  relationshipBlock: string;
  needsBlock: string;
  goalsBlock: string;
  audienceBlock: string;
  emotionBlock: string;
  relEmotionBlock: string;
}

export interface ContextBuilderParams {
  bot: IBot;
  relationship: IRelationship | null;
  memories: IMemory[];
  globalEmotions: IPlutchikEmotions;
  relationshipEmotions: IPlutchikEmotions;
  maskedActions: Array<{ speaker: string; content: string }>;
  displayName: string;
  location: { name: string; description?: string };
  timePassage: TimePassageInfo;
  presentRelationships?: PresentRelationshipInfo[];
  selfMonitoring?: number;
  needs?: INeed[];
  goals?: IGoal[];
  reciprocityDescription?: string;
  emotionalClimate?: string;
}

// ── Builder ──

export function buildContext(params: ContextBuilderParams): ContextData {
  const {
    bot, relationship, memories, globalEmotions, relationshipEmotions,
    displayName, timePassage, presentRelationships = [], selfMonitoring = 0.5,
    needs = [], goals = [],
    reciprocityDescription = '', emotionalClimate = '',
  } = params;

  // Deterministic flags
  const isFirstEncounter = !relationship || relationship.interactionCount === 0;
  const frontStageMode = presentRelationships.length > 0
    || !relationship
    || relationship.trust < 0.8;
  const phase = relationship?.phase || 'initiating';
  const perceivedStatus = relationship?.perceivedStatus || 'unknown';
  const relationshipType = relationship?.relationshipType || 'stranger';

  // Pre-build text blocks
  const memoryBlock = buildMemoryBlock(memories);
  const relationshipBlock = buildRelationshipBlock(relationship, displayName);
  const needsBlock = buildNeedsBlock(needs);
  const activeGoals = goals.filter(g => g.status === 'active');
  const goalsBlock = buildGoalsBlock(activeGoals);
  const audienceBlock = buildAudienceBlock(presentRelationships, selfMonitoring);
  const emotionBlock = describeEmotions(globalEmotions) || '';
  const relEmotionBlock = describeEmotions(relationshipEmotions) || '';

  return {
    isFirstEncounter,
    frontStageMode,
    timePassage,
    phase,
    perceivedStatus,
    relationshipType,
    reciprocityBalance: reciprocityDescription,
    emotionalClimate,
    relationship,
    memories,
    globalEmotions,
    relationshipEmotions,
    displayName,
    presentRelationships,
    selfMonitoring,
    decayedNeeds: needs,
    activeGoals,
    memoryBlock,
    relationshipBlock,
    needsBlock,
    goalsBlock,
    audienceBlock,
    emotionBlock,
    relEmotionBlock,
  };
}

// ── Text block builders ──

function buildMemoryBlock(memories: IMemory[]): string {
  if (memories.length === 0) return '';

  const parts: string[] = [];
  const arcSummaries = memories.filter(m => m.type === 'arc_summary');
  const patterns = memories.filter(m => m.type === 'pattern');
  const contradictions = memories.filter(m => m.type === 'contradiction');
  const regular = memories.filter(m =>
    m.type !== 'arc_summary' && m.type !== 'pattern' && m.type !== 'contradiction',
  );

  if (arcSummaries.length > 0) {
    parts.push('=== ARCO RELAZIONALE ===');
    for (const mem of arcSummaries) parts.push(mem.summary);
  }
  if (patterns.length > 0) {
    parts.push('=== PATTERN COMPORTAMENTALI ===');
    for (const mem of patterns) parts.push(`- ${mem.summary}`);
  }
  if (contradictions.length > 0) {
    parts.push('=== CONTRADDIZIONI RILEVATE ===');
    for (const mem of contradictions) parts.push(`- ${mem.summary}`);
  }
  if (regular.length > 0) {
    parts.push('=== MEMORIE RECENTI ===');
    for (const mem of regular) {
      const tag = mem.importance >= 70 ? ' [IMPORTANTE]' : '';
      parts.push(`- [${mem.type}] ${mem.summary} (${mem.sentiment})${tag}`);
    }
  }

  return parts.join('\n');
}

function buildRelationshipBlock(relationship: IRelationship | null, displayName: string): string {
  if (!relationship) return `Mai incontrato/a prima. Il suo nome ti è sconosciuto.`;

  const parts: string[] = [];
  const r = relationship;

  parts.push(`Nome: ${displayName}`);
  parts.push(`Incontri: ${r.interactionCount}`);
  parts.push(`Fiducia: ${Math.round(r.trust * 100)}%`);
  parts.push(`Familiarità: ${Math.round(r.familiarity * 100)}%`);
  parts.push(`Sentimento: ${r.sentiment > 0.2 ? 'positivo' : r.sentiment < -0.2 ? 'negativo' : 'neutro'} (${r.sentiment.toFixed(2)})`);

  if (r.perceivedStatus && r.perceivedStatus !== 'unknown') {
    parts.push(`Status percepito: ${r.perceivedStatus}`);
  }
  if (r.relationshipType && r.relationshipType !== 'stranger') {
    parts.push(`Tipo di rapporto: ${r.relationshipType}`);
  }
  if (r.phase && r.phase !== 'initiating') {
    parts.push(`Fase del rapporto: ${r.phase}`);
  }
  if (r.disclosure && r.disclosure.depth > 0.1) {
    parts.push(`Profondità apertura: ${Math.round(r.disclosure.depth * 100)}%`);
  }

  // Turning points
  if (r.turningPoints && r.turningPoints.length > 0) {
    const topTPs = [...r.turningPoints]
      .sort((a, b) => b.importanceWeight - a.importanceWeight)
      .slice(0, 3);
    parts.push(`Momenti chiave: ${topTPs.map(tp => tp.description).join('; ')}`);
  }

  return parts.join('\n');
}

function buildNeedsBlock(needs: INeed[]): string {
  const critical = needs.filter(n => n.satisfaction < 0.3 && n.salience > 0.4);
  if (critical.length === 0) return '';

  const lines = critical.map(n =>
    `- ${n.type}: soddisfazione ${Math.round(n.satisfaction * 100)}%, importanza ${Math.round(n.salience * 100)}%`,
  );
  return lines.join('\n');
}

function buildGoalsBlock(activeGoals: IGoal[]): string {
  if (activeGoals.length === 0) return '';
  return activeGoals.map((g, i) =>
    `- [${i}] ${g.description} (progresso: ${Math.round(g.progress * 100)}%)`,
  ).join('\n');
}

function buildAudienceBlock(presentRelationships: PresentRelationshipInfo[], selfMonitoring: number): string {
  if (presentRelationships.length === 0) return '';

  const parts: string[] = [];
  for (const pr of presentRelationships) {
    const sentLabel = pr.sentiment > 0.2 ? 'positivo' : pr.sentiment < -0.2 ? 'negativo' : 'neutro';
    parts.push(`- ${pr.displayName}: ${pr.relationshipType}, sentimento ${sentLabel} (${pr.sentiment.toFixed(2)})`);
  }

  if (selfMonitoring > 0.7) {
    parts.push('Sei molto attento a come appari. Adatti il comportamento al pubblico presente.');
  } else if (selfMonitoring < 0.3) {
    parts.push('Sei autentico e spontaneo. Non ti curi molto di come appari agli altri.');
  }

  return parts.join('\n');
}
