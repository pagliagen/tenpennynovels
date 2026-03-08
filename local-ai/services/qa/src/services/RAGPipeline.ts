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
  maxTokens: number = 500
): Promise<RAGResult> {
  const contextText = contextChunks
    .map((c, i) => `[${i + 1}] ${c.heading}\n${c.content}`)
    .join('\n\n---\n\n');

  const lang = locale === 'it' ? 'italiano' : 'English';

  const systemPrompt = `Sei un assistente che risponde a domande basandosi ESCLUSIVAMENTE sul contesto fornito.

Regole:
- Rispondi SOLO in ${lang}
- Usa SOLO le informazioni presenti nel contesto
- Se il contesto non contiene la risposta, dillo chiaramente
- NON citare numeri di fonti nel testo (niente [1], [2], ecc.)
- Sii conciso e preciso`;

  const userMessage = `Contesto:\n${contextText}\n\nDomanda: ${question}`;

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
      model: process.env.OLLAMA_MODEL || 'mistral:7b-instruct',
      tokensUsed,
    },
  };
}
