import { OllamaChat } from './OllamaChat';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('DocumentInsight');

interface ExtractInsightInput {
  question: string;
  existingAnswer: string;
  documentContent: string;
  documentTitle: string;
}

interface ExtractInsightResult {
  hasNewInfo: boolean;
  insight: string;
}

const ollamaChat = new OllamaChat();

export async function extractInsight(input: ExtractInsightInput): Promise<ExtractInsightResult> {
  const { question, existingAnswer, documentContent, documentTitle } = input;

  const systemPrompt = `Analizzi documenti di un gioco di ruolo vittoriano per trovare info aggiuntive.

Rispondi SOLO in formato JSON:
{
  "hasNewInfo": true/false,
  "insight": "una sola frase con l'info nuova (solo se hasNewInfo=true, stringa vuota altrimenti)"
}

Regole:
- hasNewInfo=true SOLO se il documento aggiunge qualcosa di SIGNIFICATIVO e NON ridondante rispetto alla risposta già data
- L'insight deve essere UNA SOLA FRASE, massimo 20 parole, in italiano
- NON ripetere informazioni già nella risposta esistente
- Se il documento non è pertinente alla domanda, hasNewInfo=false`;

  const truncatedContent = documentContent.substring(0, 1200);

  const userMessage = `Domanda: ${question}

Risposta già fornita: ${existingAnswer}

Documento "${documentTitle}":
${truncatedContent}

Ci sono informazioni nuove e rilevanti in questo documento?`;

  const startMs = Date.now();
  const { text, tokensUsed } = await ollamaChat.chatJSON(systemPrompt, userMessage, 100);
  const elapsed = Date.now() - startMs;

  logger.info(`Document insight extraction for "${documentTitle}" completed in ${elapsed}ms (${tokensUsed} tokens)`);

  let result: ExtractInsightResult;
  try {
    result = JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
    } else {
      logger.warn('Failed to parse insight response, defaulting to no new info');
      return { hasNewInfo: false, insight: '' };
    }
  }

  if (typeof result.hasNewInfo !== 'boolean') {
    result.hasNewInfo = false;
  }
  if (!result.insight) {
    result.insight = '';
  }

  return result;
}
