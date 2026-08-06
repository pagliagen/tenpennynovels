import { OllamaChat } from './OllamaChat';
import { logger } from '../../utils/logger';

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
- Se il documento non è pertinente alla domanda, hasNewInfo=false
- L'insight deve CONTENERE l'informazione stessa, non descriverla o riassumerla genericamente

SBAGLIATO (descrive il contenuto invece di riportarlo):
"insight": "Informazioni nuove sulla gestione domestica vittoriana"

CORRETTO (riporta l'informazione stessa):
"insight": "Le donne sposate perdevano l'autonomia giuridica sui propri beni fino al Married Women's Property Act del 1882"`;

  const truncatedContent = documentContent.substring(0, 1200);

  const userMessage = `Domanda: ${question}

Risposta già fornita: ${existingAnswer}

Documento "${documentTitle}":
${truncatedContent}

Ci sono informazioni nuove e rilevanti in questo documento?`;

  const startMs = Date.now();
  const { text, tokensUsed } = await ollamaChat.chatJSON(systemPrompt, userMessage, 100);
  const elapsed = Date.now() - startMs;

  logger.info(`Document insight extraction for "${documentTitle}" completed`, { elapsedMs: elapsed, tokensUsed });

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
