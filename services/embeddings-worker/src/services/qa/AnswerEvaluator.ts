import { OllamaChat } from './OllamaChat';
import { logger } from '../../utils/logger';

interface ExtractKeywordsInput {
  question: string;
  answer: string;
}

interface ExtractKeywordsResult {
  keywords: string[];
}

const ollamaChat = new OllamaChat();

export async function extractKeywords(input: ExtractKeywordsInput): Promise<ExtractKeywordsResult> {
  const { question, answer } = input;

  const systemPrompt = `Sei un analista di testi di ambientazione e regolamento per un gioco di ruolo ambientato nell'epoca vittoriana.
Data una domanda e la relativa risposta, devi suggerire 2-3 parole chiave SPECIFICHE per cercare documenti correlati che potrebbero contenere informazioni aggiuntive.

Rispondi SOLO in formato JSON con questa struttura:
{
  "keywords": ["parola chiave 1", "parola chiave 2", "parola chiave 3"]
}

Regole:
- Le keywords devono essere specifiche, brevi (2-4 parole ciascuna) e utili per una ricerca semantica
- NON ripetere concetti già ampiamente coperti nella risposta
- Cerca di esplorare ASPETTI COLLEGATI ma diversi rispetto alla risposta già data
- Se la risposta è già molto completa e non c'è nulla da approfondire, rispondi con un array vuoto []
- Massimo 3 keywords`;

  const userMessage = `Domanda: ${question}

Risposta fornita: ${answer}

Suggerisci keywords per trovare documenti con informazioni aggiuntive:`;

  const startMs = Date.now();
  const { text, tokensUsed } = await ollamaChat.chatJSON(systemPrompt, userMessage, 128);
  const elapsed = Date.now() - startMs;

  logger.info('Keyword extraction completed', { elapsedMs: elapsed, tokensUsed });

  let result: ExtractKeywordsResult;
  try {
    result = JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
    } else {
      logger.warn('Failed to parse keywords response, defaulting to empty');
      return { keywords: [] };
    }
  }

  if (!Array.isArray(result.keywords)) {
    result.keywords = [];
  }

  result.keywords = result.keywords
    .filter((k: any) => typeof k === 'string' && k.trim().length > 0)
    .slice(0, 3);

  return result;
}
