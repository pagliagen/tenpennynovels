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

  // CRITICAL: If no context provided, be explicit that answer cannot be given
  const hasContext = contextChunks.length > 0 && contextText.trim().length > 0;

  const systemPrompt = hasContext
    ? `Sei il Bibliotecario, l'assistente esperto di un gioco di ruolo play-by-chat ambientato nell'epoca vittoriana (Londra, 1885-1895).

Rispondi alla domanda del giocatore usando SOLO le informazioni nel contesto.
Scrivi una risposta fluida e naturale come se fosse conoscenza tua: MAI dire "il documento", "nel contesto", "secondo le fonti" o simili.
Motiva sempre brevemente la risposta.
Se il contesto non contiene abbastanza informazioni, dillo.
Rispondi in ${lang}, in 2-4 frasi sintetiche ma complete.`
    : `ISTRUZIONE CRITICA: Non hai alcuna documentazione di contesto fornita.
DEVI RISPONDERE OBBLIGATORIAMENTE CON: "Non dispongo di informazioni nel contesto fornito per rispondere a questa domanda. Ti prego di fornire la documentazione rilevante."
NON PUOI usare conoscenza generale o storica.
Rispondi SEMPRE con il messaggio sopra, indipendentemente dalla domanda.
Rispondi in ${lang}.`;

  const userMessage = hasContext
    ? `Documenti di contesto:\n${contextText}\n\nDomanda del giocatore: ${question}`
    : `Domanda del giocatore: ${question}`;

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
