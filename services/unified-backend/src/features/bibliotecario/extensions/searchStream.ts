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
 */

import { logger } from '@shared/utils/logger';
import type { HookMap } from '@core/extensions/points';
import { KeeperClient } from '../services/KeeperClient';

export async function onSearchStream({ question, chunks, sse, signal }: HookMap['documents.search.stream']): Promise<void> {
  if (signal.aborted) return;

  const healthy = await KeeperClient.isAiAvailable();
  if (!healthy) {
    logger.warn('[Bibliotecario] AI gateway non disponibile, nessuna risposta generata');
    return;
  }

  const answer = await KeeperClient.ask({
    question,
    context: chunks,
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
}
