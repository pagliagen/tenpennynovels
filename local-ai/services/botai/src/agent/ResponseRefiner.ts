/**
 * ResponseRefiner — LLM-powered self-critique.
 *
 * Step 3 of the pipeline. Evaluates the generated response against character
 * consistency, emotional coherence, format rules, and reactive coherence.
 * Uses a budget of max 2 refinement loops.
 */
import { IAgent } from './IAgent';
import { IBot, IPlutchikEmotions } from '../models/Bot';
import { ContextInsights } from './ContextAnalyzer';
import { applyFormatRules } from './ResponseFormatter';
import { describeEmotions } from './EmotionManager';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('ResponseRefiner');

const REFINE_BUDGET = 2;

interface RefineResult {
  isConsistent: boolean;
  hasFixableIssues: boolean;
  issues: string[];
  refinedResponse: string;
}

export interface RefineOutput {
  response: string;
  wasRefined: boolean;
  attempts: number;
}

export class ResponseRefiner {
  constructor(private agent: IAgent) {}

  async refine(
    bot: IBot,
    draftResponse: string,
    insights: ContextInsights,
    maskedActions: Array<{ speaker: string; content: string }>,
    globalEmotions: IPlutchikEmotions,
    isFirstEncounter: boolean,
    budget = REFINE_BUDGET,
  ): Promise<RefineOutput> {
    let current = applyFormatRules(draftResponse);
    const wasFormattedDeterministically = current !== draftResponse;

    let attempts = 0;
    let wasRefined = wasFormattedDeterministically;

    for (let i = 0; i < budget; i++) {
      attempts++;
      let evaluation: RefineResult;
      try {
        evaluation = await this.evaluate(bot, current, insights, maskedActions, globalEmotions, isFirstEncounter);
      } catch (err: any) {
        logger.warn(`[Refiner] Attempt ${attempts}: evaluation failed (${err.message}) — keeping current`);
        break;
      }

      if (evaluation.isConsistent) {
        logger.info(`[Refiner] Attempt ${attempts}: response consistent`);
        break;
      }

      if (!evaluation.hasFixableIssues) {
        logger.warn(`[Refiner] Attempt ${attempts}: unfixable — ${evaluation.issues.join('; ')}`);
        break;
      }

      logger.info(`[Refiner] Attempt ${attempts}: issues — ${evaluation.issues.join('; ')}`);

      const refined = applyFormatRules(evaluation.refinedResponse);
      if (refined === current) {
        logger.warn(`[Refiner] Attempt ${attempts}: identical output, stopping`);
        break;
      }

      current = refined;
      wasRefined = true;
    }

    return { response: current, wasRefined, attempts };
  }

  private async evaluate(
    bot: IBot,
    response: string,
    insights: ContextInsights,
    maskedActions: Array<{ speaker: string; content: string }>,
    globalEmotions: IPlutchikEmotions,
    isFirstEncounter: boolean,
  ): Promise<RefineResult> {
    const systemPrompt = this.buildPrompt(bot, globalEmotions, response.length);
    const userMessage = this.buildInput(bot, response, insights, maskedActions, globalEmotions, isFirstEncounter);

    const { result } = await this.agent.analyzeJSON<RefineResult>(
      'ResponseRefiner',
      systemPrompt,
      userMessage,
      { temperature: 0.3, numPredict: 1500 },
    );

    return {
      isConsistent: result.isConsistent ?? true,
      hasFixableIssues: result.hasFixableIssues ?? false,
      issues: result.issues || [],
      refinedResponse: result.refinedResponse || response,
    };
  }

  private buildPrompt(bot: IBot, globalEmotions: IPlutchikEmotions, responseLength: number): string {
    const emotionDesc = describeEmotions(globalEmotions);
    const emotionCtx = emotionDesc ? `\nStato emotivo attuale: ${emotionDesc}` : '';

    const styleCtx = bot.narrativeStyle
      ? `\nStile narrativo (${bot.narrativeStyle.author}): ${bot.narrativeStyle.guidance}`
      : '';

    const styleCriterion = bot.narrativeStyle
      ? `\n11. Rispetta lo stile narrativo di ${bot.narrativeStyle.author}? Vivido e atmosferico, non piatto. (ERRORE se piatto)`
      : '';

    return `Sei un regista teatrale severo che rivede le battute di un attore in un GDR by chat.
L'attore interpreta "${bot.name}".${emotionCtx}${styleCtx}

Produci un JSON:
{
  "isConsistent": true/false,
  "hasFixableIssues": true/false,
  "issues": ["problema"],
  "refinedResponse": "versione corretta se non coerente, stessa risposta se va bene"
}

Controlla RIGOROSAMENTE:
1. Rivela il nome senza che gli sia stato chiesto? (ERRORE se primo incontro)
2. Sa cose che non dovrebbe sapere? (ERRORE)
3. Chiama per nome qualcuno indicato come "Sconosciuto"? (ERRORE GRAVE)
4. Esce dal ruolo o fa meta-commenti? (ERRORE)
5. Tono coerente col carattere e la situazione? (ERRORE se no)
6. ${bot.narrativeStyle ? `LUNGHEZZA: ${responseLength} chars. < 400 = ERRORE (espandi). > 700 = ERRORE (accorcia, elimina ripetizioni).` : `Lunghezza sproporzionata per il tipo di interazione? (ERRORE se monologo per un saluto)`}
7. Risponde a quanto detto/chiesto? (ERRORE se ignora)
8. Azioni solo tra *asterischi*? No [*parentesi*]. (ERRORE GRAVE)
9. Tono emotivo coerente con lo stato emotivo? (ERRORE se incoerente)
10. COERENZA REATTIVA — Dice solo cose motivate da cio che e stato detto/fatto? (ERRORE GRAVE se anticipa argomenti non toccati)
11. RIPETIZIONE — Ripete lo stesso concetto/azione/frase? (ERRORE — elimina)
12. VOCABOLARIO — Parole italiane inesistenti o verbi inventati? (ERRORE GRAVE)${styleCriterion}
13. ECCESSO DI INTROSPEZIONE — Descrive i propri meccanismi interni come un narratore onnisciente? (ERRORE — il personaggio AGISCE, non si auto-analizza)

Rispondi SOLO col JSON, in italiano.`;
  }

  private buildInput(
    bot: IBot,
    response: string,
    insights: ContextInsights,
    maskedActions: Array<{ speaker: string; content: string }>,
    globalEmotions: IPlutchikEmotions,
    isFirstEncounter: boolean,
  ): string {
    const parts: string[] = [];

    parts.push(`=== PERSONAGGIO ===`);
    parts.push(`${bot.name} — ${bot.personality.traits.join(', ')}`);
    parts.push(`Stile: ${bot.personality.speech_style}`);
    if (bot.narrativeStyle) parts.push(`Narrativa: ${bot.narrativeStyle.author}`);

    parts.push(`\n=== SITUAZIONE ===`);
    parts.push(`Primo incontro: ${isFirstEncounter ? 'SI' : 'NO'}`);
    parts.push(`Intent: ${insights.messageAnalysis.intent} (tono: ${insights.messageAnalysis.emotionalTone})`);
    if (!isFirstEncounter && insights.currentRelationship) {
      parts.push(`Rapporto: ${insights.currentRelationship}`);
    }

    const emotionDesc = describeEmotions(globalEmotions);
    if (emotionDesc) {
      parts.push(`\n=== STATO EMOTIVO ===`);
      parts.push(emotionDesc);
    }

    parts.push(`\n=== ULTIMI MESSAGGI ===`);
    for (const action of maskedActions.slice(-5)) {
      parts.push(`${action.speaker}: ${action.content}`);
    }

    parts.push(`\n=== RISPOSTA DA VALUTARE ===`);
    parts.push(response);

    return parts.join('\n');
  }
}
