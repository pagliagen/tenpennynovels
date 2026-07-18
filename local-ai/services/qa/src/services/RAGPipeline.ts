import { OllamaChat } from './OllamaChat';
import { createLogger } from '../../../../shared/logger';

const logger = createLogger('RAGPipeline');

interface ContextChunk {
  heading: string;
  content: string;
  source?: { documentId?: string; slug?: string; fullPath?: string; title?: string; subtypeTitle?: string };
}

interface RAGResult {
  answer: string;
  sources: Array<{ heading: string; slug?: string; fullPath?: string; title?: string; used: boolean }>;
  metadata: { model: string; tokensUsed: number };
}

const ollamaChat = new OllamaChat();

export async function askWithContext(
  question: string,
  contextChunks: ContextChunk[],
  locale: string = 'it',
  maxTokens: number = 400
): Promise<RAGResult> {
  const contextText = contextChunks
    .map(c => `${c.heading}\n${c.content}`)
    .join('\n\n---\n\n');

  const lang = locale === 'it' ? 'italiano' : 'English';

  const systemPrompt = `Sei il Bibliotecario, l'assistente esperto di un gioco di ruolo play-by-chat ambientato nell'epoca vittoriana (Londra, 1885-1895).

Rispondi alla domanda del giocatore usando SOLO le informazioni nel contesto.
Scrivi una risposta fluida e naturale come se fosse conoscenza tua: MAI dire "il documento", "nel contesto", "secondo le fonti" o simili.
Motiva sempre brevemente la risposta.
Se il contesto non contiene abbastanza informazioni, dillo.
Rispondi in ${lang}, in 2-4 frasi sintetiche ma complete.`;

  const userMessage = `Documenti di contesto:\n${contextText}\n\nDomanda del giocatore: ${question}`;

  const startMs = Date.now();
  const { text, tokensUsed } = await ollamaChat.chat(systemPrompt, userMessage, maxTokens);
  const elapsed = Date.now() - startMs;

  logger.info(`RAG answer generated in ${elapsed}ms (${tokensUsed} tokens)`);

  const answer = text.replace(/\[\d+\]/g, '').replace(/  +/g, ' ').trim();

  const seen = new Set<string>();
  const sources = contextChunks
    .filter(c => {
      const key = c.source?.fullPath || c.source?.slug || c.heading;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(c => ({
      heading: c.heading,
      slug: c.source?.slug,
      fullPath: c.source?.fullPath,
      title: c.source?.title,
      used: answer.toLowerCase().includes(c.heading.toLowerCase().substring(0, 20)),
    }));

  return {
    answer,
    sources,
    metadata: {
      model: process.env.OLLAMA_MODEL || 'qwen3:8b',
      tokensUsed,
    },
  };
}
