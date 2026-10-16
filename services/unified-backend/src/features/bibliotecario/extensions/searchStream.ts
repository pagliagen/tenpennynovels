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
 * Prima di qualunque chiamata al modello `decideRoute` sceglie tra risposta
 * diretta (nessuna AI: il link alla sezione è già in cima), sintesi su più
 * documenti, o messaggio statico "non coperta" (vedi utils/answerRouting.ts).
 * La sintesi manda all'AI fino a 3 chunk di documenti diversi.
 *
 * Gli arricchimenti rank-per-rank (ai_reading / ai_enrichment) restano nel
 * codice ma sono spenti da MAX_ENRICHMENT_STEPS = 0: su CPU ogni chiamata
 * sfora il timeout di 30s. Il contratto del frontend (useSearch.ts) accumula
 * già blocchi in lista, quindi riaccenderli non richiede modifiche lato UI.
 */

import { logger } from '@shared/utils/logger';
import type { HookMap, ContextChunk } from '@core/extensions/points';
import { KeeperClient } from '../services/KeeperClient';
import { decideRoute, notCoveredMessage } from '../utils/answerRouting';

// Rank 1 (risposta principale) + al più questi arricchimenti: oltre un certo
// punto ogni fonte in più allunga la sequenza di chiamate LLM sequenziali
// senza aggiungere molto al giocatore, che nel frattempo aspetta.
// 0 = arricchimenti disattivati: sulla CPU del server (qwen3.5:4b, prefill
// ~30 tok/s) ogni chiamata sfora il timeout di 30s di KeeperClient.enrich,
// quindi il giocatore vedeva "sto leggendo" per 90s senza alcun risultato,
// mentre il worker continuava a generare per richieste già abbandonate.
// Da riportare a 3 su hardware più veloce (SYS-1 / GPU).
const MAX_ENRICHMENT_STEPS = 0;

function sourceLabel(chunk: ContextChunk): { title: string; fullPath?: string } {
  return {
    title: chunk.source?.title || chunk.heading,
    fullPath: chunk.source?.fullPath,
  };
}

export async function onSearchStream({ question, chunks, scope, sse, signal }: HookMap['documents.search.stream']): Promise<void> {
  if (signal.aborted) return;

  // Il routing viene prima di tutto, anche del health check dell'AI: due esiti
  // su tre non la usano. Decisioni loggate per ritarare le soglie con traffico vero.
  const route = decideRoute(question, chunks);
  logger.info('[Bibliotecario] route', {
    mode: route.mode,
    question: question.slice(0, 120),
    scope,
    topCosine: Math.max(0, ...chunks.map((c) => c.vectorScore ?? 0)),
    candidates: chunks.length,
    ...(route.mode === 'direct' ? { matchedHeading: route.matchedHeading } : {}),
    ...(route.mode === 'synthesis' ? { contextChunks: route.chunks.length } : {}),
  });

  if (route.mode === 'direct') return; // il link alla sezione è già in cima ai risultati

  if (route.mode === 'not_covered') {
    // Stesso evento della risposta vera: la UI lo mostra senza modifiche e anche
    // nelle schede con il JS vecchio. Nessuna chiamata al modello.
    sse.send('ai_answer', { answer: notCoveredMessage(scope), sources: [], model: 'static' });
    return;
  }

  const healthy = await KeeperClient.isAiAvailable();
  if (!healthy) {
    logger.warn('[Bibliotecario] AI gateway non disponibile, nessuna risposta generata');
    return;
  }

  // Sintesi: più documenti, un chunk ciascuno. maxTokens non si passa, vale
  // QA_MAX_ANSWER_TOKENS del worker: l'800 che c'era prima sovrascriveva il
  // tetto e, a ~8 tok/s su CPU, poteva sforare il timeout di 60s.
  const answer = await KeeperClient.ask({
    question,
    context: route.chunks,
    options: { locale: 'it' },
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

  const restChunks = chunks.filter((c) => !route.chunks.includes(c));
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
