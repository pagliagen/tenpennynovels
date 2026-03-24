import { IAgent } from './IAgent';
import { IBot, IActiveEmotion } from '../models/Bot';
import { IMemory } from '../models/Memory';
import { IRelationship } from '../models/Relationship';

export interface ContextInsights {
  isFirstEncounter: boolean;
  whoIsThis: string;
  ourHistory: string;
  currentRelationship: string;
  messageAnalysis: {
    intent: string;
    emotionalTone: string;
    isQuestionDirected: boolean;
    requiresSpecificKnowledge: boolean;
  };
  myCurrentState: string;
  suggestedApproach: string;
}

interface AnalyzeParams {
  bot: IBot;
  relationship: IRelationship | null;
  memories: IMemory[];
  activeEmotions: IActiveEmotion[];
  maskedActions: Array<{ speaker: string; content: string }>;
  displayName: string;
  location: { name: string; description?: string };
}

export class ContextAnalyzer {
  constructor(private agent: IAgent) {}

  async analyze(params: AnalyzeParams): Promise<ContextInsights> {
    const systemPrompt = this.buildPrompt(params);
    const userMessage = this.buildInput(params);

    const { result } = await this.agent.analyzeJSON<ContextInsights>(
      'ContextAnalyzer',
      systemPrompt,
      userMessage,
      { temperature: 0.3, numPredict: 900 },
    );

    return {
      isFirstEncounter: result.isFirstEncounter ?? !params.relationship,
      whoIsThis: result.whoIsThis || 'Uno sconosciuto',
      ourHistory: result.ourHistory || '',
      currentRelationship: result.currentRelationship || '',
      messageAnalysis: {
        intent: result.messageAnalysis?.intent || 'unknown',
        emotionalTone: result.messageAnalysis?.emotionalTone || 'neutral',
        isQuestionDirected: result.messageAnalysis?.isQuestionDirected ?? false,
        requiresSpecificKnowledge: result.messageAnalysis?.requiresSpecificKnowledge ?? false,
      },
      myCurrentState: result.myCurrentState || '',
      suggestedApproach: result.suggestedApproach || '',
    };
  }

  private buildPrompt(params: AnalyzeParams): string {
    return `Sei un analista di contesto per un GDR by chat. Il tuo compito e analizzare la situazione DAL PUNTO DI VISTA del personaggio "${params.bot.name}".

Devi produrre un JSON con questa struttura:
{
  "isFirstEncounter": true/false,
  "whoIsThis": "Chi e questa persona, cosa sai di lei",
  "ourHistory": "Riassunto delle interazioni passate, se ce ne sono",
  "currentRelationship": "Come ti senti verso questa persona e perche",
  "messageAnalysis": {
    "intent": "tipo di messaggio (greeting, question, provocation, farewell, storytelling, request, flirtation, threat, casual_chat, etc.)",
    "emotionalTone": "tono emotivo percepito (friendly, hostile, curious, nervous, flirtatious, desperate, formal, informal, etc.)",
    "isQuestionDirected": true/false,
    "requiresSpecificKnowledge": true/false
  },
  "myCurrentState": "Come mi sento ora, cosa stavo facendo, che umore ho",
  "suggestedApproach": "Come dovrei rispondere tenendo conto del mio carattere, della relazione, e del contesto"
}

IMPORTANTE:
- Analizza SOLO in base alle informazioni fornite. Non inventare fatti.
- Se non ci sono memorie o relazioni, e un primo incontro.
- Il campo "suggestedApproach" deve riflettere la personalita del personaggio, NON essere generico.
- NON inventare il nome della persona se non e presente nelle memorie. Se non lo sai, e "Uno sconosciuto".
- Rispondi SOLO col JSON, in italiano.`;
  }

  private buildInput(params: AnalyzeParams): string {
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
      if (r.significantEvents.length > 0) {
        parts.push(`Eventi significativi: ${r.significantEvents.join('; ')}`);
      }
    } else {
      parts.push('Mai incontrato/a prima.');
    }

    if (params.memories.length > 0) {
      parts.push(`\n=== MEMORIE RILEVANTI ===`);
      for (const mem of params.memories) {
        const tag = mem.importance >= 70 ? ' [IMPORTANTE]' : '';
        parts.push(`- [${mem.type}] ${mem.summary} (${mem.sentiment})${tag}`);
      }
    }

    if (params.activeEmotions.length > 0) {
      parts.push(`\n=== IL MIO STATO EMOTIVO ATTUALE ===`);
      for (const emo of params.activeEmotions) {
        parts.push(`- ${emo.emotion} (intensita: ${emo.intensity.toFixed(1)}, causa: ${emo.trigger})`);
      }
    }

    parts.push(`\n=== MESSAGGI RECENTI ===`);
    const recent = params.maskedActions.slice(-10);
    for (const action of recent) {
      parts.push(`${action.speaker}: ${action.content}`);
    }

    return parts.join('\n');
  }
}
