import { OllamaChat } from './OllamaChat';
import { logger } from '../../utils/logger';
import { config } from '../../config';

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

/**
 * Taglia a fine frase (o a fine parola) entro il limite, così il modello non
 * riceve un troncamento a metà token di senso.
 */
function truncateAtBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const cut = text.slice(0, maxChars);
  const lastSentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'));
  if (lastSentence > maxChars * 0.6) return cut.slice(0, lastSentence + 1).trim();

  const lastWord = cut.lastIndexOf(' ');
  return (lastWord > 0 ? cut.slice(0, lastWord) : cut).trim() + '…';
}

/**
 * I chunk sono sezioni H2/H3 di documento, di lunghezza non limitata: cinque
 * sezioni lunghe sfondano la context window e vengono troncate in silenzio da
 * Ollama, con il doppio costo di un prefill lento e di un contesto mutilato in
 * un punto arbitrario. Qui il budget è esplicito: cap per singolo chunk, poi
 * cap complessivo, scartando i chunk meno rilevanti (arrivano già ordinati per
 * score dalla ricerca semantica) invece di tagliare l'ultimo a metà.
 */
function fitContextToBudget(contextChunks: ContextChunk[]): { kept: ContextChunk[]; contextText: string; droppedChunks: number } {
  const kept: ContextChunk[] = [];
  let used = 0;

  for (const chunk of contextChunks) {
    const content = truncateAtBoundary(chunk.content || '', config.qa.maxChunkChars);
    const cost = (chunk.heading?.length || 0) + content.length;
    if (used + cost > config.qa.maxContextChars) break;

    kept.push({ ...chunk, content });
    used += cost;
  }

  // Garantisce che almeno il chunk più rilevante arrivi al modello, anche se da
  // solo eccede il budget: senza contesto la pipeline risponde "non lo so".
  if (kept.length === 0 && contextChunks.length > 0) {
    const first = contextChunks[0]!;
    kept.push({ ...first, content: truncateAtBoundary(first.content || '', config.qa.maxContextChars) });
  }

  return {
    kept,
    contextText: kept.map(c => `${c.heading}\n${c.content}`).join('\n\n---\n\n'),
    droppedChunks: contextChunks.length - kept.length,
  };
}

export async function askWithContext(
  question: string,
  contextChunks: ContextChunk[],
  locale: string = 'it',
  maxTokens: number = config.qa.maxAnswerTokens
): Promise<RAGResult> {
  const { kept, contextText, droppedChunks } = fitContextToBudget(contextChunks);

  const lang = locale === 'it' ? 'italiano' : 'English';

  // CRITICAL: If no context provided, be explicit that answer cannot be given
  const hasContext = kept.length > 0 && contextText.trim().length > 0;

  const systemPrompt = hasContext
    ? `Sei il Bibliotecario, l'assistente esperto di un gioco di ruolo play-by-chat ambientato nell'epoca vittoriana (Londra, 1885-1895).

Rispondi alla domanda del giocatore usando SOLO le informazioni nel contesto.
Scrivi una risposta fluida e naturale come se fosse conoscenza tua: MAI dire "il documento", "nel contesto", "secondo le fonti" o simili.
Sii esauriente: usa i dettagli rilevanti presenti nel contesto invece di riassumerli via, così il giocatore non deve andare a leggere le fonti per capire il quadro.
Se il contesto non contiene abbastanza informazioni, dillo.
Rispondi in ${lang}, in un paragrafo completo (indicativamente 5-8 frasi).`
    : `ISTRUZIONE CRITICA: Non hai alcuna documentazione di contesto fornita.
DEVI RISPONDERE OBBLIGATORIAMENTE CON: "Non dispongo di informazioni nel contesto fornito per rispondere a questa domanda. Ti prego di fornire la documentazione rilevante."
NON PUOI usare conoscenza generale o storica.
Rispondi SEMPRE con il messaggio sopra, indipendentemente dalla domanda.
Rispondi in ${lang}.`;

  const userMessage = hasContext
    ? `Documenti di contesto:\n${contextText}\n\nDomanda del giocatore: ${question}`
    : `Domanda del giocatore: ${question}`;

  const startMs = Date.now();
  const { text, tokensUsed, metrics } = await ollamaChat.chat(systemPrompt, userMessage, maxTokens);
  const elapsed = Date.now() - startMs;

  // Prefill e decode vanno letti separati: sono i due numeri che dicono se il
  // limite è la lunghezza del prompt o la velocità di generazione.
  logger.info('RAG answer generated', {
    elapsedMs: elapsed,
    tokensUsed,
    contextChunks: kept.length,
    droppedChunks,
    contextChars: contextText.length,
    promptTokens: metrics.promptTokens,
    answerTokens: metrics.answerTokens,
    promptEvalMs: metrics.promptEvalMs,
    evalMs: metrics.evalMs,
    tokensPerSecond: metrics.answerTokensPerSecond,
  });

  const answer = text.replace(/\[\d+\]/g, '').replace(/  +/g, ' ').trim();

  const seen = new Set<string>();
  const sources = kept
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
      model: config.services.ollama.model,
      tokensUsed,
    },
  };
}

interface EnrichResult {
  enrichment: string | null;
  metadata: { model: string; tokensUsed: number };
}

// Sentinella richiesta al modello per il caso "questa fonte non aggiunge
// nulla di nuovo": più affidabile di un campo booleano separato che
// costringerebbe a un secondo giro o a un JSON strutturato per una risposta
// che deve restare un singolo blocco di testo libero.
const NOTHING_NEW_MARKER = 'NIENTE_DI_NUOVO';

/**
 * Arricchimento progressivo (Bibliotecario): dato che il giocatore ha già
 * ricevuto `previousAnswer` (la risposta iniziale più gli arricchimenti già
 * mandati), genera un blocco breve con SOLO ciò che questa fonte aggiunge di
 * nuovo — non un'altra risposta completa alla domanda. Usata da
 * bibliotecario/extensions/searchStream.ts in un loop rank-per-rank: una
 * chiamata per fonte, non un'unica chiamata con tutto il contesto insieme
 * (quella resta askWithContext, usata solo per il rank più alto).
 */
export async function enrichAnswer(
  question: string,
  previousAnswer: string,
  chunk: ContextChunk,
  locale: string = 'it',
  maxTokens: number = config.qa.maxEnrichmentTokens
): Promise<EnrichResult> {
  const lang = locale === 'it' ? 'italiano' : 'English';
  const content = truncateAtBoundary(chunk.content || '', config.qa.maxChunkChars);

  const systemPrompt = `Sei il Bibliotecario, l'assistente esperto di un gioco di ruolo play-by-chat ambientato nell'epoca vittoriana (Londra, 1885-1895).
Hai già risposto alla domanda del giocatore. Ora hai trovato un'altra fonte pertinente: il tuo compito è dire SOLO le informazioni nuove che questa fonte aggiunge, non ripetere quanto già detto.
Scrivi 1-3 frasi brevi, fluide, come se fosse conoscenza tua: MAI dire "il documento", "nel contesto", "questa fonte" o simili.
Se questa fonte non contiene nulla di rilevante che non sia già coperto dalla risposta già data, rispondi ESATTAMENTE con: ${NOTHING_NEW_MARKER}
Rispondi in ${lang}.`;

  const userMessage = `Domanda del giocatore: ${question}

Risposta già data al giocatore:
${previousAnswer}

Fonte aggiuntiva da valutare:
${chunk.heading}
${content}`;

  const startMs = Date.now();
  const { text, tokensUsed, metrics } = await ollamaChat.chat(systemPrompt, userMessage, maxTokens);
  const elapsed = Date.now() - startMs;

  const cleaned = text.replace(/\[\d+\]/g, '').replace(/  +/g, ' ').trim();
  const isNothingNew = cleaned.toUpperCase().includes(NOTHING_NEW_MARKER);

  logger.info('RAG enrichment generated', {
    elapsedMs: elapsed,
    tokensUsed,
    heading: chunk.heading,
    isNothingNew,
    promptTokens: metrics.promptTokens,
    answerTokens: metrics.answerTokens,
  });

  return {
    enrichment: isNothingNew ? null : cleaned,
    metadata: {
      model: config.services.ollama.model,
      tokensUsed,
    },
  };
}
