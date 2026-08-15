/**
 * Handler dell'hook 'documents.search.stream'. Portato da
 * modules/documents/services/DocumentSearchAgent.ts (Fase 2 del refactor,
 * vedi docs/refactor/FEATURE-MODULES-PLAN.md).
 *
 * Il controllo del flag keeper_qa_enabled non c'è più qui: lo fa
 * ExtensionRegistry.emit() prima di invocare l'handler. Niente
 * sendSSE('complete')/res.end(): il core li manda subito dopo che emit()
 * risolve, sempre — un handler che li richiamasse qui produrrebbe una
 * doppia chiusura dello stream. Niente try/catch: emit() isola già ogni
 * handler, un errore qui viene loggato dal registry e il flusso del core
 * prosegue comunque.
 *
 * Risposta progressiva rank-per-rank (non un'unica chiamata con tutto il
 * contesto): `chunks` arriva già ordinato per rilevanza da
 * DocumentController.semanticSearch. Il rank più alto genera la risposta
 * principale (ai_answer) da solo — non l'intero contesto insieme, altrimenti
 * il giocatore aspetta l'intera generazione multi-fonte prima di vedere
 * qualunque cosa. I rank successivi arrivano uno alla volta come blocchi di
 * arricchimento separati (ai_reading prima della chiamata per mostrare quale
 * fonte si sta leggendo, poi ai_enrichment col risultato) — mai un'unica
 * risposta che si riscrive da capo ad ogni fonte, il contratto del frontend
 * (apps/documents/src/hooks/useSearch.ts) già accumula blocchi in lista.
 * Se il rank più alto fallisce o è vuoto, l'intero flusso si ferma qui:
 * mostrare arricchimenti senza una risposta base non avrebbe senso.
 */

import { logger } from '@shared/utils/logger';
import type { HookMap, ContextChunk } from '@core/extensions/points';
import { KeeperClient } from '../services/KeeperClient';

// Rank 1 (risposta principale) + al più questi arricchimenti: oltre un certo
// punto ogni fonte in più allunga la sequenza di chiamate LLM sequenziali
// senza aggiungere molto al giocatore, che nel frattempo aspetta.
const MAX_ENRICHMENT_STEPS = 3;

function sourceLabel(chunk: ContextChunk): { title: string; fullPath?: string } {
  return {
    title: chunk.source?.title || chunk.heading,
    fullPath: chunk.source?.fullPath,
  };
}

export async function onSearchStream({ question, chunks, sse, signal }: HookMap['documents.search.stream']): Promise<void> {
  if (signal.aborted || chunks.length === 0) return;

  const healthy = await KeeperClient.isAiAvailable();
  if (!healthy) {
    logger.warn('[Bibliotecario] AI gateway non disponibile, nessuna risposta generata');
    return;
  }

  const [topChunk, ...restChunks] = chunks;

  const answer = await KeeperClient.ask({
    question,
    context: [topChunk!],
    options: { maxTokens: 800, locale: 'it' },
  });

  if (signal.aborted) return;

  if (!answer?.success || !answer.answer) {
    logger.warn('[Bibliotecario] Risposta AI fallita o vuota');
    return;
  }

  sse.send('ai_answer', {
    answer: answer.answer,
    sources: answer.sources ?? [],
    model: answer.metadata?.model,
  });

  let runningAnswer = answer.answer;

  for (const [index, chunk] of restChunks.slice(0, MAX_ENRICHMENT_STEPS).entries()) {
    if (signal.aborted) return;

    const source = sourceLabel(chunk);
    sse.send('ai_reading', source);

    const enrichment = await KeeperClient.enrich({
      question,
      previousAnswer: runningAnswer,
      chunk,
      options: { locale: 'it' },
    });

    if (signal.aborted) return;

    if (!enrichment?.success || !enrichment.enrichment) {
      // Fonte senza nulla di nuovo o chiamata fallita: si passa alla
      // prossima, l'indicatore "sto leggendo" scompare da solo lato
      // frontend quando arriva l'evento successivo (o la fine dello stream).
      continue;
    }

    sse.send('ai_enrichment', {
      enrichment: enrichment.enrichment,
      source,
      step: index + 1,
    });

    runningAnswer += `\n\n${enrichment.enrichment}`;
  }
}
