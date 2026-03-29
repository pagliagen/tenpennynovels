/**
 * PostResponseAnalyzer — Unified background analysis (1 LLM call).
 *
 * Merges the old PostResponseAnalyzer + ArcSummarizer into a single LLM call.
 * Runs in background after the response is sent to the player.
 * When the interaction count is a multiple of 10, the prompt also requests
 * an arc summary, eliminating the separate ArcSummarizer LLM call.
 */

import { IAgent } from './IAgent';
import { IBot, IPlutchikEmotions, NeedType } from '../models/Bot';
import { IMemory } from '../models/Memory';
import { PerceivedStatus, RelationshipType } from '../models/Relationship';
import { ContextData } from './ContextBuilder';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('PostResponseAnalyzer');

export interface TrustDeltas {
  competence: number;
  benevolence: number;
  integrity: number;
}

export interface TurningPoint {
  type: 'self_disclosure' | 'shared_experience' | 'conflict' | 'support_given' | 'support_received' | 'betrayal' | 'reconciliation' | 'milestone' | 'abandonment' | null;
  description: string | null;
  emotionalImpact: number;
  importanceWeight: number;
}

export interface SupportEvent {
  direction: 'given' | 'received' | 'mutual' | 'none';
  type: 'emotional' | 'practical' | 'informational' | null;
  description: string | null;
}

export interface PostAnalysisResult {
  memorySummary: string;
  memoryImportance: number;
  memoryType: 'interaction' | 'observation' | 'emotional' | 'event';
  sentimentDelta: number;
  trustDeltas: TrustDeltas | null;
  familiarityDelta: number;
  disclosureDelta: number;
  globalEmotions: Partial<IPlutchikEmotions> | null;
  relationshipEmotions: Partial<IPlutchikEmotions> | null;
  turningPoint: TurningPoint | null;
  characterLearned: string | null;
  perceivedStatus: PerceivedStatus;
  relationshipType: RelationshipType;
  supportEvent: SupportEvent;
  detectedPattern: string | null;
  potentialContradiction: string | null;
  emotionSuppressed: boolean;
  needsSatisfaction: Array<{ need: NeedType; delta: number }> | null;
  goalProgress: Array<{ goalIndex: number; delta: number }> | null;
  faceThreatened: boolean;
  // Arc summary (only present every 10 interactions)
  arcSummary: string | null;
}

export class PostResponseAnalyzer {
  private creativeAgent: IAgent;
  private analyticalAgent: IAgent;

  constructor(creativeAgent: IAgent, analyticalAgent: IAgent) {
    this.creativeAgent = creativeAgent;
    this.analyticalAgent = analyticalAgent;
  }

  async analyze(
    bot: IBot,
    displayName: string,
    ctx: ContextData,
    maskedActions: Array<{ speaker: string; content: string }>,
    botResponse: string,
    isNewSession: boolean = false,
    existingMemories: IMemory[] = [],
    shouldGenerateArc: boolean = false,
    arcContext?: { interactionCount: number; trust: number; familiarity: number; sentiment: number },
  ): Promise<PostAnalysisResult> {
    const systemPrompt = this.buildSystemPrompt(bot, shouldGenerateArc);
    const userMessage = this.buildInput(bot, displayName, ctx, maskedActions, botResponse, isNewSession, existingMemories, shouldGenerateArc, arcContext);

    // Arc summaries are creative narrative → use Claude.
    // Standard analysis is structured JSON at temp=0.2 → use Ollama (free).
    const agent = shouldGenerateArc ? this.creativeAgent : this.analyticalAgent;

    let result: Partial<PostAnalysisResult> = {};
    try {
      const numPredict = shouldGenerateArc ? 1600 : 1200;
      ({ result } = await agent.analyzeJSON<PostAnalysisResult>(
        'PostResponseAnalyzer',
        systemPrompt,
        userMessage,
        { temperature: 0.2, numPredict },
      ));
    } catch (err: any) {
      logger.warn(`[PostResponseAnalyzer] Analysis failed (${err.message}) — using defaults`);
    }

    const tp = sanitizeTurningPoint(result.turningPoint);
    const impactMultiplier = tp && tp.importanceWeight >= 7
      ? 1 + (tp.importanceWeight - 6) * 0.5
      : 1.0;

    return {
      memorySummary: result.memorySummary || `Interazione con ${displayName}`,
      memoryImportance: clamp(result.memoryImportance ?? 40, 0, 100),
      memoryType: result.memoryType || 'interaction',
      sentimentDelta: clamp(result.sentimentDelta ?? 0, -0.1 * impactMultiplier, 0.1 * impactMultiplier),
      trustDeltas: sanitizeTrustDeltas(result.trustDeltas, impactMultiplier),
      familiarityDelta: clamp(result.familiarityDelta ?? 0.02, 0, 0.05),
      disclosureDelta: clamp(result.disclosureDelta ?? 0, -0.05, 0.05),
      globalEmotions: sanitizeAxes(result.globalEmotions),
      relationshipEmotions: sanitizeAxes(result.relationshipEmotions),
      turningPoint: tp,
      characterLearned: result.characterLearned || null,
      perceivedStatus: validateEnum(result.perceivedStatus, ['superior', 'equal', 'inferior', 'unknown'], 'unknown') as PerceivedStatus,
      relationshipType: validateEnum(result.relationshipType, ['stranger', 'acquaintance', 'friend', 'rival', 'romantic', 'professional', 'mentor', 'protege', 'enemy'], 'stranger') as RelationshipType,
      supportEvent: sanitizeSupportEvent(result.supportEvent),
      detectedPattern: result.detectedPattern || null,
      potentialContradiction: result.potentialContradiction || null,
      emotionSuppressed: result.emotionSuppressed ?? false,
      needsSatisfaction: Array.isArray(result.needsSatisfaction) ? result.needsSatisfaction : null,
      goalProgress: Array.isArray(result.goalProgress) ? result.goalProgress : null,
      faceThreatened: result.faceThreatened ?? false,
      arcSummary: shouldGenerateArc && typeof result.arcSummary === 'string' && result.arcSummary.length >= 30
        ? result.arcSummary
        : null,
    };
  }

  private buildSystemPrompt(bot: IBot, includeArc: boolean): string {
    let prompt = `Sei un analista psicologico per un GDR by chat. Analizzi l'interazione appena avvenuta DAL PUNTO DI VISTA del personaggio "${bot.name}".

Produci un JSON con:
{
  "memorySummary": "Riassunto dell'interazione in 1-2 frasi dal punto di vista del personaggio. Se non conosci il nome, usa 'Uno sconosciuto'.",
  "memoryImportance": 0-100,
  "memoryType": "interaction" | "observation" | "emotional" | "event",
  "sentimentDelta": -0.1 a +0.1,
  "trustDeltas": { "competence": -0.05 a +0.05, "benevolence": -0.05 a +0.05, "integrity": -0.05 a +0.05 } oppure null,
  "familiarityDelta": 0.01 a 0.05,
  "disclosureDelta": -0.05 a +0.05,
  "globalEmotions": { assi Plutchik che cambiano A LIVELLO GENERALE } oppure null,
  "relationshipEmotions": { assi Plutchik che cambiano VERSO QUESTA PERSONA },
  "turningPoint": { "type": "...", "description": "...", "emotionalImpact": -1.0 a +1.0, "importanceWeight": 1-10 } oppure null,
  "characterLearned": "cosa ho imparato di nuovo su questa persona" oppure null,
  "perceivedStatus": "superior" | "equal" | "inferior" | "unknown",
  "relationshipType": "stranger" | "acquaintance" | "friend" | "rival" | "romantic" | "professional" | "mentor" | "protege" | "enemy",
  "supportEvent": { "direction": "given" | "received" | "mutual" | "none", "type": "emotional" | "practical" | "informational" | null, "description": "..." oppure null },
  "detectedPattern": "se noti un COMPORTAMENTO RIPETUTO da parte dell'interlocutore, descrivilo. Altrimenti null.",
  "potentialContradiction": "se l'interlocutore ha detto qualcosa che CONTRADDICE una memoria esistente, descrivi come 'Prima disse X, ora dice Y'. Altrimenti null.",
  "emotionSuppressed": true/false,
  "needsSatisfaction": [{"need": "status"|"security"|"belonging"|"autonomy"|"purpose", "delta": -0.1 a +0.2}] oppure null,
  "goalProgress": [{"goalIndex": 0, "delta": -0.1 a +0.3}] oppure null,
  "faceThreatened": true/false${includeArc ? `,
  "arcSummary": "Riassunto dell'arco relazionale in 3-5 frasi dal punto di vista del personaggio. Cattura: evoluzione del rapporto, pattern ricorrenti, momenti chiave, stato attuale. Solo testo, in italiano."` : ''}
}

=== SISTEMA EMOTIVO PLUTCHIK ===
Le emozioni sono 8 assi con valore 0.0-1.0. L'intensità determina la sfumatura:

  gioia:          0.0-0.3 serenità, 0.4-0.7 gioia, 0.8-1.0 estasi
  fiducia:        0.0-0.3 accettazione, 0.4-0.7 fiducia, 0.8-1.0 ammirazione
  paura:          0.0-0.3 apprensione, 0.4-0.7 paura, 0.8-1.0 terrore
  sorpresa:       0.0-0.3 distrazione, 0.4-0.7 sorpresa, 0.8-1.0 stupore
  tristezza:      0.0-0.3 pensierosità, 0.4-0.7 tristezza, 0.8-1.0 angoscia
  disgusto:       0.0-0.3 noia, 0.4-0.7 disgusto, 0.8-1.0 odio
  rabbia:         0.0-0.3 irritazione, 0.4-0.7 rabbia, 0.8-1.0 collera
  anticipazione:  0.0-0.3 interesse, 0.4-0.7 anticipazione, 0.8-1.0 vigilanza

Includi SOLO gli assi con valore > 0. Ometti quelli a 0.
IMPORTANTE: Valuta le emozioni in base a COSA È SUCCESSO nella scena, non in base al carattere del personaggio.
Indica l'intensità emotiva che l'EVENTO giustifica. Il sistema applicherà automaticamente i filtri del carattere.

globalEmotions: RARO. Solo se l'evento cambia l'umore GENERALE (tradimento, shock, grande gioia). null nella maggior parte dei casi.
relationshipEmotions: Come il personaggio si sente VERSO QUESTA PERSONA dopo l'interazione.

=== FIDUCIA TRIDIMENSIONALE ===
- competence: fiducia nelle CAPACITÀ. Sale con abilità dimostrata, scende con fallimenti.
- benevolence: fiducia nelle INTENZIONI. Sale con gentilezza, scende con egoismo.
- integrity: fiducia nella COERENZA MORALE. Sale con onestà, scende con menzogne.
trustDeltas: null se non rilevante. Max +0.03, -0.05 per tradimento.

=== TURNING POINTS ===
Tipi: "self_disclosure", "shared_experience", "conflict", "support_given", "support_received", "betrayal", "reconciliation", "milestone", "abandonment"
emotionalImpact: -1.0 a +1.0. importanceWeight: 1-10 (la maggior parte 3-5).
Solo per momenti davvero significativi.

=== LINEE GUIDA DELTA ===
CRITICO: I delta misurano l'IMPATTO OGGETTIVO dell'evento, NON la percezione soggettiva del personaggio.
Se qualcuno ti fa un complimento sincero → sentimentDelta POSITIVO, anche se il tuo personaggio e diffidente.
Se qualcuno ti dice il suo nome → disclosureDelta POSITIVO, anche se non ti fidi.
Il CARATTERE del personaggio influenza la RISPOSTA, non i delta. I delta misurano la realta.

- sentimentDelta: +0.01 scambio banale, +0.03 conversazione piacevole, +0.05 momento intimo/confessione. NEGATIVO solo per insulti, minacce, tradimenti.
- familiarityDelta: 0.02 scambi brevi, 0.03-0.05 conversazioni profonde. Ogni interazione AUMENTA la familiarita.
- disclosureDelta: +0.02 per ogni informazione personale condivisa (nome, professione). +0.04 per rivelazioni intime. +0.05 per confessioni. 0 SOLO se NULLA di personale e stato rivelato.

=== MEMORYTYPE — GUIDA ALLA SCELTA ===
- "interaction": dialogo ordinario, convenevoli, scambio di battute
- "observation": hai NOTATO qualcosa di nuovo (aspetto, abitudine, dettaglio)
- "emotional": momento emotivamente forte PER TE
- "event": qualcosa di CONCRETO e SUCCESSO. Esempi: contatto fisico, scambio di nomi, arrivo/partenza, promessa, regalo, bacio, tradimento, rivelazione importante, qualcuno che se ne va
Se nell'interazione e successo un FATTO (non solo parole), usa "event".

=== PERCEIVEDSTATUS ===
Valuta lo status sociale DELL'INTERLOCUTORE in base a indizi CONCRETI: abbigliamento, linguaggio, portamento, titoli usati.
- Un uomo colto che usa un linguaggio ricercato e veste bene = "equal" o "superior", NON "inferior"
- Un mendicante in stracci = "inferior"
- Se non ci sono indizi chiari = "unknown"

Rispondi SOLO col JSON, in italiano.`;

    return prompt;
  }

  private buildInput(
    bot: IBot,
    displayName: string,
    ctx: ContextData,
    maskedActions: Array<{ speaker: string; content: string }>,
    botResponse: string,
    isNewSession: boolean,
    existingMemories: IMemory[] = [],
    includeArc: boolean = false,
    arcContext?: { interactionCount: number; trust: number; familiarity: number; sentiment: number },
  ): string {
    const parts: string[] = [];

    parts.push(`=== PERSONAGGIO ===`);
    parts.push(`${bot.name} — ${bot.personality.traits.join(', ')}`);

    parts.push(`\n=== CONTESTO ===`);
    parts.push(`Primo incontro: ${ctx.isFirstEncounter ? 'SI' : 'NO'}`);
    if (!ctx.isFirstEncounter && ctx.relationshipBlock) {
      parts.push(`Rapporto attuale: ${ctx.relationshipBlock}`);
    }
    if (isNewSession) {
      parts.push(`Nota: questa è una ripresa del contatto dopo un'assenza prolungata.`);
    }

    // Memories for contradiction detection
    const relevantMemories = existingMemories.filter(m =>
      m.type !== 'arc_summary' && m.type !== 'pattern' && m.type !== 'contradiction',
    );
    if (relevantMemories.length > 0) {
      parts.push(`\n=== MEMORIE ESISTENTI SU QUESTA PERSONA ===`);
      for (const mem of relevantMemories.slice(0, 8)) {
        parts.push(`- [${mem.type}] ${mem.summary} (${mem.sentiment})`);
      }
    }

    parts.push(`\n=== CONVERSAZIONE ===`);
    for (const action of maskedActions.slice(-5)) {
      parts.push(`${action.speaker}: ${action.content}`);
    }
    parts.push(`${bot.name}: ${botResponse}`);

    parts.push(`\n=== PERSONA CON CUI HO INTERAGITO ===`);
    parts.push(displayName);

    // Arc summary context (when needed)
    if (includeArc && arcContext) {
      parts.push(`\n=== CONTESTO PER ARC SUMMARY ===`);
      parts.push(`Interazioni totali: ${arcContext.interactionCount}`);
      parts.push(`Fiducia: ${Math.round(arcContext.trust * 100)}%`);
      parts.push(`Familiarità: ${Math.round(arcContext.familiarity * 100)}%`);
      const sentLabel = arcContext.sentiment > 0.2 ? 'positivo' : arcContext.sentiment < -0.2 ? 'negativo' : 'neutro';
      parts.push(`Sentimento: ${sentLabel} (${arcContext.sentiment.toFixed(2)})`);
      if (ctx.relationship?.turningPoints && ctx.relationship.turningPoints.length > 0) {
        const topTPs = [...ctx.relationship.turningPoints]
          .sort((a, b) => b.importanceWeight - a.importanceWeight)
          .slice(0, 5);
        parts.push(`Momenti chiave: ${topTPs.map(tp => tp.description).join('; ')}`);
      }
    }

    return parts.join('\n');
  }
}

// ── Sanitization helpers ──

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

const VALID_AXES = new Set(['gioia', 'fiducia', 'paura', 'sorpresa', 'tristezza', 'disgusto', 'rabbia', 'anticipazione']);

function validateEnum<T extends string>(value: any, allowed: T[], fallback: T): T {
  return allowed.includes(value) ? value : fallback;
}

function sanitizeAxes(axes: any): Partial<IPlutchikEmotions> | null {
  if (!axes || typeof axes !== 'object') return null;
  const clean: Record<string, number> = {};
  let hasAny = false;
  for (const [key, val] of Object.entries(axes)) {
    if (VALID_AXES.has(key) && typeof val === 'number' && val > 0) {
      clean[key] = clamp(val, 0, 1);
      hasAny = true;
    }
  }
  return hasAny ? clean as Partial<IPlutchikEmotions> : null;
}

function sanitizeTrustDeltas(raw: any, impactMultiplier: number = 1): TrustDeltas | null {
  if (!raw || typeof raw !== 'object') return null;
  const maxPos = 0.05 * impactMultiplier;
  const maxNeg = -0.05 * impactMultiplier;
  const competence = typeof raw.competence === 'number' ? clamp(raw.competence, maxNeg, maxPos) : 0;
  const benevolence = typeof raw.benevolence === 'number' ? clamp(raw.benevolence, maxNeg, maxPos) : 0;
  const integrity = typeof raw.integrity === 'number' ? clamp(raw.integrity, maxNeg, maxPos) : 0;
  if (competence === 0 && benevolence === 0 && integrity === 0) return null;
  return { competence, benevolence, integrity };
}

const VALID_TP_TYPES = new Set([
  'self_disclosure', 'shared_experience', 'conflict', 'support_given', 'support_received',
  'betrayal', 'reconciliation', 'milestone', 'abandonment',
]);

function sanitizeTurningPoint(raw: any): TurningPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  if (!raw.type || !VALID_TP_TYPES.has(raw.type)) return null;
  return {
    type: raw.type,
    description: typeof raw.description === 'string' ? raw.description : null,
    emotionalImpact: clamp(typeof raw.emotionalImpact === 'number' ? raw.emotionalImpact : 0, -1, 1),
    importanceWeight: clamp(typeof raw.importanceWeight === 'number' ? Math.round(raw.importanceWeight) : 3, 1, 10),
  };
}

function sanitizeSupportEvent(raw: any): SupportEvent {
  const defaultEvent: SupportEvent = { direction: 'none', type: null, description: null };
  if (!raw || typeof raw !== 'object') return defaultEvent;
  const direction = validateEnum(raw.direction, ['given', 'received', 'mutual', 'none'], 'none') as SupportEvent['direction'];
  if (direction === 'none') return defaultEvent;
  return {
    direction,
    type: validateEnum(raw.type, ['emotional', 'practical', 'informational'], null as any) as SupportEvent['type'],
    description: typeof raw.description === 'string' ? raw.description : null,
  };
}
