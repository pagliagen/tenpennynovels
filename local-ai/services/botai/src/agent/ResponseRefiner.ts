import { IAgent } from './IAgent';
import { IBot, IActiveEmotion, INarrativeStyle } from '../models/Bot';
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
    activeEmotions: IActiveEmotion[],
    budget = REFINE_BUDGET,
  ): Promise<RefineOutput> {
    // Step 1: apply deterministic fixes for free (no LLM needed)
    let current = applyFormatRules(draftResponse);
    const wasFormattedDeterministically = current !== draftResponse;

    // Deterministic length check: if narrativeStyle requires richness but response is too short, flag immediately
    const MIN_NARRATIVE_CHARS = 400;
    if (bot.narrativeStyle && current.length < MIN_NARRATIVE_CHARS) {
      logger.warn(`[Refiner] Response too short (${current.length} chars < ${MIN_NARRATIVE_CHARS} required) — will force refinement`);
    }

    // Step 2: LLM refinement loop with budget
    let attempts = 0;
    let wasRefined = wasFormattedDeterministically;

    for (let i = 0; i < budget; i++) {
      attempts++;

      let evaluation: RefineResult;
      try {
        evaluation = await this.evaluate(bot, current, insights, maskedActions, activeEmotions);
      } catch (err: any) {
        // JSON parse failures from the LLM are non-fatal: treat the response as consistent
        logger.warn(`[Refiner] Attempt ${attempts}: evaluation failed (${err.message}) — treating as consistent`);
        break;
      }

      if (evaluation.isConsistent) {
        logger.info(`[Refiner] Attempt ${attempts}: response consistent, stopping`);
        break;
      }

      if (!evaluation.hasFixableIssues) {
        logger.warn(`[Refiner] Attempt ${attempts}: unfixable issues detected — ${evaluation.issues.join('; ')}`);
        break;
      }

      logger.info(`[Refiner] Attempt ${attempts}: issues found — ${evaluation.issues.join('; ')}`);

      const refined = applyFormatRules(evaluation.refinedResponse);
      if (refined === current) {
        logger.warn(`[Refiner] Attempt ${attempts}: refinement produced identical output, stopping`);
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
    activeEmotions: IActiveEmotion[],
  ): Promise<RefineResult> {
    const systemPrompt = this.buildPrompt(bot, activeEmotions, response.length);
    const userMessage = this.buildInput(bot, response, insights, maskedActions, activeEmotions);

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

  private buildPrompt(bot: IBot, activeEmotions: IActiveEmotion[], responseLength = 0): string {
    const emotionCtx = activeEmotions.length > 0
      ? `\nStato emotivo attuale del personaggio: ${describeEmotions(activeEmotions)}`
      : '';

    const styleCtx = bot.narrativeStyle
      ? `\nStile narrativo richiesto (${bot.narrativeStyle.author}): ${bot.narrativeStyle.guidance}`
      : '';

    const styleCriterion = bot.narrativeStyle
      ? `\n11. La risposta rispetta lo stile narrativo di ${bot.narrativeStyle.author}? Deve essere vivida e atmosferica, non piatta. (ERRORE se completamente piatta e senza descrizioni fisiche/sensoriali)`
      : '';

    return `Sei un regista teatrale severo che rivede le battute di un attore in un GDR by chat.

L'attore interpreta "${bot.name}".${emotionCtx}${styleCtx}

Analizza la risposta e produci un JSON:
- Se va bene: { "isConsistent": true, "hasFixableIssues": false, "issues": [] }
- Se ci sono problemi correggibili: { "isConsistent": false, "hasFixableIssues": true, "issues": ["problema"], "refinedResponse": "testo corretto" }
- Se problemi non correggibili: { "isConsistent": false, "hasFixableIssues": false, "issues": ["problema"] }

IMPORTANTE: includi "refinedResponse" SOLO quando "isConsistent" è false e "hasFixableIssues" è true.

Controlla RIGOROSAMENTE questi aspetti:

1. Il personaggio rivela il suo nome senza che gli sia stato chiesto? (ERRORE se primo incontro)
2. Il personaggio sa cose che non dovrebbe sapere in base al contesto? (ERRORE)
3. Il personaggio chiama per nome qualcuno indicato come "Sconosciuto"? (ERRORE GRAVE)
4. Il personaggio esce dal ruolo o fa meta-commenti? (ERRORE)
5. Il tono della risposta e coerente col carattere del personaggio e la situazione? (ERRORE se no)
6. ${bot.narrativeStyle ? `LUNGHEZZA: la risposta ha ${responseLength} caratteri. Se ha meno di 400 E' UN ERRORE — espandi con dettagli sensoriali. Se ha piu di 700 E' UN ERRORE — e troppo lunga e ripetitiva, accorcia eliminando le ripetizioni.` : `La risposta e sproporzionatamente lunga rispetto al tipo di interazione? Un saluto non richiede un monologo. (ERRORE se sproporzionata)`}
7. La risposta risponde effettivamente a quanto detto/chiesto? (ERRORE se ignora il messaggio)
8. Le azioni fisiche sono SOLO tra asterischi (*azione*)? NON devono esserci parentesi quadre [*azione*] o qualsiasi altro delimitatore. (ERRORE GRAVE se formato sbagliato)
9. Il tono emotivo della risposta e coerente con lo stato emotivo attuale del personaggio? (ERRORE se incoerente)
10. COERENZA REATTIVA — Il personaggio dice solo cose motivate da quello che e stato effettivamente detto o fatto nella scena? (ERRORE GRAVE se no) Il personaggio puo essere diffidente, riservato, brusco — ma solo in REAZIONE a cio che e stato detto, non in anticipo su argomenti che nessuno ha toccato.
12. RIPETIZIONE — La risposta ripete lo stesso concetto, la stessa azione o la stessa frase piu di una volta? (ERRORE se si — elimina le ripetizioni)
13. VOCABOLARIO — La risposta contiene parole italiane inesistenti, verbi inventati o costruzioni grammaticali impossibili? (ERRORE GRAVE se si — sostituisci con il termine corretto)${styleCriterion}

Per "hasFixableIssues":
- true: i problemi rilevati possono essere corretti riscrivendo la risposta
- false: il problema e strutturale e non correggibile (risposta in altra lingua, completamente fuori contesto)

Se la risposta va bene: "isConsistent": true, "hasFixableIssues": false, "refinedResponse" uguale all'originale.
Se ci sono problemi correggibili: riscrivi MANTENENDO lo spirito della risposta originale, in italiano corretto.
Rispondi SOLO col JSON, in italiano.`;
  }

  private buildInput(
    bot: IBot,
    response: string,
    insights: ContextInsights,
    maskedActions: Array<{ speaker: string; content: string }>,
    activeEmotions: IActiveEmotion[],
  ): string {
    const parts: string[] = [];

    parts.push(`=== IL PERSONAGGIO ===`);
    parts.push(`Nome: ${bot.name}`);
    parts.push(`Tratti: ${bot.personality.traits.join(', ')}`);
    parts.push(`Stile di parlata: ${bot.personality.speech_style}`);

    if (bot.narrativeStyle) {
      parts.push(`Stile narrativo (${bot.narrativeStyle.author}): ${bot.narrativeStyle.guidance}`);
    }

    parts.push(`\n=== SITUAZIONE ===`);
    parts.push(`Primo incontro: ${insights.isFirstEncounter ? 'SI' : 'NO'}`);
    parts.push(`Tipo di messaggio ricevuto: ${insights.messageAnalysis.intent} (tono: ${insights.messageAnalysis.emotionalTone})`);
    if (!insights.isFirstEncounter) {
      parts.push(`Rapporto con l'interlocutore: ${insights.currentRelationship}`);
    }

    if (activeEmotions.length > 0) {
      parts.push(`\n=== STATO EMOTIVO ATTUALE ===`);
      for (const emo of activeEmotions) {
        const level = emo.intensity > 0.7 ? 'fortemente' : emo.intensity > 0.4 ? '' : 'leggermente';
        parts.push(`- ${level} ${emo.emotion} (causa: ${emo.trigger || 'non specificata'})`);
      }
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
