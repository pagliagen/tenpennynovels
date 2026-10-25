/**
 * Bots API (strumento da sviluppo)
 *
 * Endpoint `/admin/bots` del backend. Esistono solo se l'AI dei bot è attiva (`featureFlagsStore.botAdminEnabled`).
 * La generazione risponde in **SSE**: una scheda richiede da 15 s a più di un minuto e il proxy `/admin` taglia a 30 s
 * le risposte ferme. `fetch` e non Axios: Axios non legge un flusso.
 */

import { apiClient } from './client';
import { API_CONFIG } from '@/constants/config';
import type { ApiResponse } from '@/types/api/common';
import type { BotDesignRequest, BotDesignResult, BotDraft, BotRow, CreatedBot } from '@/types/api/Bot';

export async function getBots(): Promise<BotRow[]> {
  const response = await apiClient.get<ApiResponse<{ bots: BotRow[] }>>('/admin/bots');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Il servizio dei bot non risponde');
  }
  return response.data.data.bots;
}

/** Crea personaggio, scheda e mapping, e il servizio si ricarica da solo: mai retry (un secondo tentativo darebbe 409). */
export async function createBot(request: { locationId: string; draft: BotDraft }): Promise<CreatedBot> {
  const response = await apiClient.post<ApiResponse<CreatedBot>>('/admin/bots', request, { timeout: 60_000 });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Creazione del bot non riuscita');
  }
  return response.data.data;
}

export interface SseEvent {
  event: string;
  data: string;
}

/** Spacchetta i blocchi `event:/data:` completi di un flusso SSE; `rest` è la coda ancora incompleta. */
export function takeSseEvents(buffer: string): { events: SseEvent[]; rest: string } {
  const blocks = buffer.replace(/\r\n/g, '\n').split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: SseEvent[] = [];
  for (const block of blocks) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue; // commento (battito)
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trim());
    }
    if (data.length > 0) events.push({ event, data: data.join('\n') });
  }
  return { events, rest };
}

export interface DesignOptions {
  signal?: AbortSignal;
  /** Chiamata a ogni battito del server (~5 s): serve a mostrare che sta lavorando. */
  onProgress?: (elapsedMs: number) => void;
}

/**
 * Genera la bozza di un bot. Gli errori di validazione arrivano come JSON normale, quelli del modello come evento `error`.
 * Non salva nulla.
 */
export async function designBot(request: BotDesignRequest, options: DesignOptions = {}): Promise<BotDesignResult> {
  const sessionId = typeof window !== 'undefined' ? sessionStorage.getItem('character_session_id') : null;
  const response = await fetch(`${API_CONFIG.BASE_URL}/admin/bots/design`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(sessionId ? { 'X-Session-Id': sessionId } : {}) },
    body: JSON.stringify(request),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Sessione scaduta: ricarica la pagina.');
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'Generazione non riuscita');
  }
  if (!response.body) throw new Error('Il browser non può leggere la risposta in streaming.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: !done });
    const { events, rest } = takeSseEvents(buffer);
    buffer = rest;
    for (const { event, data } of events) {
      const payload = JSON.parse(data) as Record<string, unknown>;
      if (event === 'progress') options.onProgress?.(Number(payload.elapsedMs) || 0);
      else if (event === 'result') return payload as unknown as BotDesignResult;
      else if (event === 'error') throw new Error(typeof payload.message === 'string' ? payload.message : 'Generazione non riuscita');
    }
    if (done) break;
  }
  throw new Error('Connessione interrotta prima della fine: riprova.');
}
