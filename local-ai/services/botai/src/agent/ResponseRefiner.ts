import { OllamaAgent } from './OllamaAgent';
import { IBot } from '../models/Bot';
import { ContextInsights } from './ContextAnalyzer';

interface RefineResult {
  isConsistent: boolean;
  issues: string[];
  refinedResponse: string;
}

export class ResponseRefiner {
  constructor(private agent: OllamaAgent) {}

  async refine(
    bot: IBot,
    draftResponse: string,
    insights: ContextInsights,
    maskedActions: Array<{ speaker: string; content: string }>,
  ): Promise<string> {
    const systemPrompt = `Sei un regista teatrale severo che rivede le battute di un attore in un GDR by chat.

L'attore interpreta "${bot.name}". Devi verificare che la sua risposta sia coerente col personaggio.

Analizza la risposta e produci un JSON:
{
  "isConsistent": true/false,
  "issues": ["problema 1", "problema 2"],
  "refinedResponse": "versione corretta se non e coerente, oppure la stessa risposta se va bene"
}

Controlla RIGOROSAMENTE:
1. Il personaggio rivela il suo nome senza che gli sia stato chiesto? (ERRORE se primo incontro)
2. Il personaggio sa cose che non dovrebbe sapere? (ERRORE)
3. Il personaggio chiama per nome qualcuno che e indicato come "Sconosciuto"? (ERRORE GRAVE — il bot non puo conoscere il nome se non gli e stato detto)
4. Il personaggio esce dal ruolo o fa meta-commenti? (ERRORE)
5. Il tono e coerente col carattere del personaggio e la situazione? (ERRORE se no)
6. La risposta e troppo lunga per il tipo di interazione? Un saluto non richiede un monologo. (ERRORE se sproporzionata)
7. La risposta risponde effettivamente a quello che e stato detto/chiesto? (ERRORE se ignora il messaggio)
8. Le azioni sono tra asterischi (*azione*) e i dialoghi fuori? (ERRORE se formato sbagliato)
9. La risposta e su UNA SOLA riga senza andare a capo? (ERRORE se multi-riga)

Se la risposta va bene, "isConsistent": true e "refinedResponse" uguale all'originale.
Se ci sono problemi, correggi MANTENENDO lo spirito della risposta originale.
Rispondi SOLO col JSON, in italiano.`;

    const userMessage = this.buildInput(bot, draftResponse, insights, maskedActions);

    const { result } = await this.agent.analyzeJSON<RefineResult>(
      'ResponseRefiner',
      systemPrompt,
      userMessage,
      { temperature: 0.4, numPredict: 1024 },
    );

    if (result.isConsistent || !result.refinedResponse) {
      return draftResponse;
    }

    return result.refinedResponse;
  }

  private buildInput(
    bot: IBot,
    draftResponse: string,
    insights: ContextInsights,
    maskedActions: Array<{ speaker: string; content: string }>,
  ): string {
    const parts: string[] = [];

    parts.push(`=== IL PERSONAGGIO ===`);
    parts.push(`Nome: ${bot.name}`);
    parts.push(`Tratti: ${bot.personality.traits.join(', ')}`);
    parts.push(`Stile di parlata: ${bot.personality.speech_style}`);

    parts.push(`\n=== SITUAZIONE ===`);
    parts.push(`Primo incontro: ${insights.isFirstEncounter ? 'SI' : 'NO'}`);
    parts.push(`Tipo di messaggio ricevuto: ${insights.messageAnalysis.intent} (tono: ${insights.messageAnalysis.emotionalTone})`);
    if (!insights.isFirstEncounter) {
      parts.push(`Rapporto con l'interlocutore: ${insights.currentRelationship}`);
    }

    parts.push(`\n=== ULTIMI MESSAGGI ===`);
    for (const action of maskedActions.slice(-5)) {
      parts.push(`${action.speaker}: ${action.content}`);
    }

    parts.push(`\n=== RISPOSTA DA VALUTARE ===`);
    parts.push(draftResponse);

    return parts.join('\n');
  }
}
