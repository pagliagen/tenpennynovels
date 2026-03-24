import { IAgent } from './IAgent';
import { IBot } from '../models/Bot';
import { ContextInsights } from './ContextAnalyzer';

export interface PostAnalysisResult {
  memorySummary: string;
  memoryImportance: number;
  memoryType: 'interaction' | 'observation' | 'emotional' | 'event';
  sentimentDelta: number;
  trustDelta: number;
  familiarityDelta: number;
  emotionalReaction: {
    emotion: string;
    intensity: number;
    trigger: string;
  } | null;
  significantEvent: string | null;
  characterLearned: string | null;
}

export class PostResponseAnalyzer {
  constructor(private agent: IAgent) {}

  async analyze(
    bot: IBot,
    displayName: string,
    insights: ContextInsights,
    maskedActions: Array<{ speaker: string; content: string }>,
    botResponse: string,
  ): Promise<PostAnalysisResult> {
    const systemPrompt = `Sei un analista psicologico per un GDR by chat. Analizzi l'interazione appena avvenuta DAL PUNTO DI VISTA del personaggio "${bot.name}".

Produci un JSON con:
{
  "memorySummary": "Riassunto dell'interazione in 1-2 frasi, scritto dal punto di vista del personaggio. Se non conosci il nome della persona, usa 'Uno sconosciuto' o 'Un uomo/Una donna'. Es: 'Uno sconosciuto e entrato al pub e mi ha chiesto del whisky. Gli ho consigliato il Redbreast.'",
  "memoryImportance": 0-100,
  "memoryType": "interaction" | "observation" | "emotional" | "event",
  "sentimentDelta": -0.2 a +0.2,
  "trustDelta": -0.1 a +0.1,
  "familiarityDelta": 0.01 a 0.1,
  "emotionalReaction": { "emotion": "...", "intensity": 0-1, "trigger": "..." } oppure null,
  "significantEvent": "Descrizione breve se successo qualcosa di significativo" oppure null,
  "characterLearned": "Cosa ho imparato di nuovo su questa persona (es. 'Si chiama Arthur Feldon', 'Preferisce il whisky', 'Ha una cicatrice sulla mano')" oppure null
}

CRITICO — Per characterLearned:
- Se la persona ha detto il suo nome nel messaggio (es. "Mi chiamo X", "Sono X", "Il mio nome e X"), registralo come "Si chiama X"
- Se la persona ha rivelato qualcosa su di se, registralo
- Se non ha rivelato nulla di nuovo, usa null

LINEE GUIDA per i valori numerici:
- memoryImportance: 10-30 per chiacchierata banale, 40-60 per conversazione interessante, 70-90 per rivelazione/conflitto/evento importante
- sentimentDelta: positivo se l'interazione e piacevole, negativo se sgradevole. 0 se neutra. Valori piccoli (-0.05/+0.05) per interazioni ordinarie
- trustDelta: positivo se la persona si e dimostrata affidabile/sincera, negativo se ha mentito/offeso. Di solito 0 o molto piccolo
- familiarityDelta: sempre positivo (ogni interazione aumenta la familiarita). 0.02-0.03 per scambi brevi, 0.05-0.08 per conversazioni approfondite
- emotionalReaction: null se l'interazione non ha provocato emozioni particolari. Usa emozioni concrete: "divertito", "irritato", "commosso", "sospettoso", "lusingato", etc.
- significantEvent: null per la maggior parte delle interazioni. Solo se succede qualcosa di memorabile

Rispondi SOLO col JSON, in italiano.`;

    const userMessage = this.buildInput(bot, displayName, insights, maskedActions, botResponse);

    const { result } = await this.agent.analyzeJSON<PostAnalysisResult>(
      'PostResponseAnalyzer',
      systemPrompt,
      userMessage,
      { temperature: 0.2, numPredict: 512 },
    );

    return {
      memorySummary: result.memorySummary || `Interazione con ${displayName}`,
      memoryImportance: clamp(result.memoryImportance ?? 40, 0, 100),
      memoryType: result.memoryType || 'interaction',
      sentimentDelta: clamp(result.sentimentDelta ?? 0, -0.2, 0.2),
      trustDelta: clamp(result.trustDelta ?? 0, -0.1, 0.1),
      familiarityDelta: clamp(result.familiarityDelta ?? 0.03, 0, 0.1),
      emotionalReaction: result.emotionalReaction || null,
      significantEvent: result.significantEvent || null,
      characterLearned: result.characterLearned || null,
    };
  }

  private buildInput(
    bot: IBot,
    displayName: string,
    insights: ContextInsights,
    maskedActions: Array<{ speaker: string; content: string }>,
    botResponse: string,
  ): string {
    const parts: string[] = [];

    parts.push(`=== PERSONAGGIO ===`);
    parts.push(`${bot.name} — ${bot.personality.traits.join(', ')}`);

    parts.push(`\n=== CONTESTO ===`);
    parts.push(`Primo incontro: ${insights.isFirstEncounter ? 'SI' : 'NO'}`);
    if (!insights.isFirstEncounter) {
      parts.push(`Rapporto attuale: ${insights.currentRelationship}`);
    }
    parts.push(`Tipo di interazione: ${insights.messageAnalysis.intent}`);

    parts.push(`\n=== CONVERSAZIONE ===`);
    for (const action of maskedActions.slice(-5)) {
      parts.push(`${action.speaker}: ${action.content}`);
    }
    parts.push(`${bot.name}: ${botResponse}`);

    parts.push(`\n=== PERSONA CON CUI HO INTERAGITO ===`);
    parts.push(displayName);

    return parts.join('\n');
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
