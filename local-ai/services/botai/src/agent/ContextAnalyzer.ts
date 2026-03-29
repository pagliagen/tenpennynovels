/**
 * ContextAnalyzer — LLM-powered context analysis.
 *
 * Takes the deterministic ContextData and enriches it with LLM inference:
 * - Who is this person? What do I know about them?
 * - What is their intent? What tone are they using?
 * - How should I approach this interaction?
 *
 * This is Step 1 of the pipeline and adds ~2000 tokens per interaction.
 */
import { IAgent } from './IAgent';
import { IBot, IPlutchikEmotions } from '../models/Bot';
import { IRelationship } from '../models/Relationship';
import { IMemory } from '../models/Memory';
import { TimePassageInfo } from '../utils/SessionDetector';
import { describeEmotions } from './EmotionManager';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('ContextAnalyzer');

export interface ContextInsights {
  whoIsThis: string;
  ourHistory: string;
  currentRelationship: string;
  messageAnalysis: {
    intent: string;
    emotionalTone: string;
    isQuestionDirected: boolean;
  };
  myCurrentState: string;
  suggestedApproach: string;
}

export interface ContextAnalyzerParams {
  bot: IBot;
  relationship: IRelationship | null;
  memories: IMemory[];
  globalEmotions: IPlutchikEmotions;
  relationshipEmotions: IPlutchikEmotions;
  maskedActions: Array<{ speaker: string; content: string }>;
  displayName: string;
  location: { name: string; description?: string };
  timePassage: TimePassageInfo;
}

export class ContextAnalyzer {
  constructor(private agent: IAgent) {}

  async analyze(params: ContextAnalyzerParams): Promise<ContextInsights> {
    const systemPrompt = this.buildPrompt(params);
    const userMessage = this.buildInput(params);

    let result: Partial<ContextInsights> = {};
    try {
      ({ result } = await this.agent.analyzeJSON<ContextInsights>(
        'ContextAnalyzer',
        systemPrompt,
        userMessage,
        { temperature: 0.3, numPredict: 900 },
      ));
    } catch (err: any) {
      logger.warn(`[ContextAnalyzer] Analysis failed (${err.message}) — using defaults`);
    }

    return {
      whoIsThis: result.whoIsThis || 'Uno sconosciuto',
      ourHistory: result.ourHistory || '',
      currentRelationship: result.currentRelationship || '',
      messageAnalysis: {
        intent: result.messageAnalysis?.intent || 'unknown',
        emotionalTone: result.messageAnalysis?.emotionalTone || 'neutral',
        isQuestionDirected: result.messageAnalysis?.isQuestionDirected ?? false,
      },
      myCurrentState: result.myCurrentState || '',
      suggestedApproach: result.suggestedApproach || '',
    };
  }

  private buildPrompt(params: ContextAnalyzerParams): string {
    return `Sei un analista di contesto per un GDR by chat. Analizzi la situazione DAL PUNTO DI VISTA del personaggio "${params.bot.name}".

Produci un JSON:
{
  "whoIsThis": "Chi e questa persona, cosa sai di lei. Se non la conosci, descrivi cosa VEDI.",
  "ourHistory": "Riassunto delle interazioni passate, se ce ne sono. Vuoto se primo incontro.",
  "currentRelationship": "Come ti senti verso questa persona e perche.",
  "messageAnalysis": {
    "intent": "tipo di messaggio (greeting, question, provocation, farewell, flirtation, threat, confession, casual_chat, etc.)",
    "emotionalTone": "tono emotivo percepito (friendly, hostile, curious, nervous, flirtatious, desperate, formal, etc.)",
    "isQuestionDirected": true/false
  },
  "myCurrentState": "Come mi sento ora, cosa stavo facendo, che umore ho. Tieni conto delle emozioni attive.",
  "suggestedApproach": "Come dovrei rispondere tenendo conto del mio carattere, della relazione, del contesto, e delle emozioni."
}

IMPORTANTE:
- Analizza SOLO in base alle informazioni fornite. Non inventare fatti.
- Il campo "suggestedApproach" deve riflettere la PERSONALITA del personaggio — non essere generico.
- NON inventare il nome della persona se non e nelle memorie.
- Se e indicato un tempo trascorso, integra la consapevolezza del tempo nel suggestedApproach.
- Rispondi SOLO col JSON, in italiano.`;
  }

  private buildInput(params: ContextAnalyzerParams): string {
    const parts: string[] = [];

    parts.push(`=== IL MIO PERSONAGGIO ===`);
    parts.push(`Nome: ${params.bot.name}`);
    parts.push(`Tratti: ${params.bot.personality.traits.join(', ')}`);
    parts.push(`Stile: ${params.bot.personality.speech_style}`);
    parts.push(`Background: ${params.bot.personality.background}`);

    parts.push(`\n=== LUOGO ===`);
    parts.push(`${params.location.name}${params.location.description ? `: ${params.location.description}` : ''}`);

    parts.push(`\n=== LA PERSONA CHE MI PARLA ===`);
    parts.push(params.displayName);

    if (params.relationship) {
      const r = params.relationship;
      parts.push(`Incontri precedenti: ${r.interactionCount}`);
      parts.push(`Fiducia: ${Math.round(r.trust * 100)}%`);
      parts.push(`Familiarita: ${Math.round(r.familiarity * 100)}%`);
      parts.push(`Sentimento: ${r.sentiment > 0.2 ? 'positivo' : r.sentiment < -0.2 ? 'negativo' : 'neutro'} (${r.sentiment.toFixed(2)})`);
      if (r.perceivedStatus && r.perceivedStatus !== 'unknown') {
        parts.push(`Status percepito: ${r.perceivedStatus}`);
      }
      if (r.relationshipType && r.relationshipType !== 'stranger') {
        parts.push(`Tipo di rapporto: ${r.relationshipType}`);
      }
      if (r.significantEvents && r.significantEvents.length > 0) {
        parts.push(`Eventi significativi: ${r.significantEvents.join('; ')}`);
      }
    } else {
      parts.push('Mai incontrato/a prima.');
    }

    if (params.timePassage.category !== 'same_session' && params.timePassage.narrativeHint) {
      parts.push(`\n=== TEMPO TRASCORSO ===`);
      parts.push(params.timePassage.narrativeHint);
    }

    if (params.memories.length > 0) {
      parts.push(`\n=== MEMORIE RILEVANTI ===`);
      for (const mem of params.memories.slice(0, 8)) {
        const tag = mem.importance >= 70 ? ' [IMPORTANTE]' : '';
        parts.push(`- [${mem.type}] ${mem.summary} (${mem.sentiment})${tag}`);
      }
    }

    const globalDesc = describeEmotions(params.globalEmotions);
    if (globalDesc) {
      parts.push(`\n=== IL MIO STATO D'ANIMO GENERALE ===`);
      parts.push(globalDesc);
    }

    const relDesc = describeEmotions(params.relationshipEmotions);
    if (relDesc) {
      parts.push(`\n=== COME MI SENTO VERSO QUESTA PERSONA ===`);
      parts.push(relDesc);
    }

    parts.push(`\n=== MESSAGGI RECENTI ===`);
    for (const action of params.maskedActions.slice(-10)) {
      parts.push(`${action.speaker}: ${action.content}`);
    }

    return parts.join('\n');
  }
}
