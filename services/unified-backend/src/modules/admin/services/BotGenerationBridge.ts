/**
 * BotGenerationBridge — SSE-based bridge
 *
 * Collega i callback asincroni di local-ai agli stream SSE aperti dal management panel.
 *
 * Flusso:
 *  1. BotController.generate → register(requestId)
 *  2. GET /admin/bots/events/:requestId → connectSse(requestId, res)
 *  3. local-ai invia callback HTTP → BotController.callback → pushEvent(requestId, event, data)
 *     - Gli eventi 'progress' vengono inviati da local-ai man mano che completa i passi reali.
 *     - Gli eventi terminali ('bot_ready', 'char_ready', 'error') chiudono lo stream.
 *
 * Buffer: se il callback arriva prima che l'SSE sia connesso, l'evento viene bufferizzato
 * e inviato appena il client si connette.
 */

import { Response } from 'express';
import { logger } from '../utils/logger';

const SSE_TTL_MS = 6 * 60 * 1000; // 6 minuti

interface BridgeEntry {
  createdAt: number;
  sseRes?: Response;
  buffered: Array<{ event: string; data: any }>;
  timer: NodeJS.Timeout;
}

const entries = new Map<string, BridgeEntry>();

function sendSseEvent(res: Response, event: string, data: any): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  if (typeof (res as any).flush === 'function') (res as any).flush();
}

export const BotGenerationBridge = {
  /**
   * Registra un nuovo requestId. Deve essere chiamato prima di aprire lo stream SSE.
   */
  register(requestId: string): void {
    if (entries.has(requestId)) return;

    const timer = setTimeout(() => {
      const entry = entries.get(requestId);
      if (entry) {
        if (entry.sseRes) {
          sendSseEvent(entry.sseRes, 'error', { message: `Timeout dopo ${SSE_TTL_MS / 1000}s` });
          entry.sseRes.end();
        }
        entries.delete(requestId);
        logger.warn(`[BotBridge] TTL scaduto per: ${requestId}`);
      }
    }, SSE_TTL_MS);

    entries.set(requestId, { createdAt: Date.now(), buffered: [], timer });
    logger.info(`[BotBridge] Registrato: ${requestId}`);
  },

  /**
   * Collega la risposta Express SSE al requestId.
   * Se ci sono eventi bufferizzati, li invia subito.
   */
  connectSse(requestId: string, res: Response): void {
    let entry = entries.get(requestId);
    if (!entry) {
      this.register(requestId);
      entry = entries.get(requestId)!;
    }

    entry.sseRes = res;

    // Replay eventi bufferizzati arrivati prima della connessione SSE
    for (const evt of entry.buffered) {
      sendSseEvent(res, evt.event, evt.data);
    }
    entry.buffered = [];

    // Ping ogni 20s per mantenere viva la connessione
    const ping = setInterval(() => {
      if (res.writableEnded) { clearInterval(ping); return; }
      res.write(': ping\n\n');
      if (typeof (res as any).flush === 'function') (res as any).flush();
    }, 20000);

    res.on('close', () => {
      clearInterval(ping);
    });
  },

  /**
   * Invia un evento SSE al client (o lo bufferizza se l'SSE non è ancora connesso).
   * Gli eventi terminali ('bot_ready', 'char_ready', 'error', 'complete') chiudono lo stream.
   */
  pushEvent(requestId: string, event: string, data: any): void {
    const entry = entries.get(requestId);
    if (!entry) {
      logger.warn(`[BotBridge] pushEvent: nessuna entry per ${requestId}`);
      return;
    }

    if (entry.sseRes && !entry.sseRes.writableEnded) {
      sendSseEvent(entry.sseRes, event, data);
    } else {
      entry.buffered.push({ event, data });
    }

    const isTerminal = event === 'complete' || event === 'error' || event === 'bot_ready' || event === 'char_ready';
    if (isTerminal) {
      setTimeout(() => {
        const e = entries.get(requestId);
        if (e) {
          clearTimeout(e.timer);
          if (e.sseRes && !e.sseRes.writableEnded) e.sseRes.end();
          entries.delete(requestId);
        }
      }, 200);
    }
  },

  /**
   * Controlla se esiste un'entry attiva per questo requestId.
   */
  has(requestId: string): boolean {
    return entries.has(requestId);
  },

  /**
   * Elimina l'entry (es. se l'admin cancella).
   */
  cleanup(requestId: string): void {
    const entry = entries.get(requestId);
    if (entry) {
      clearTimeout(entry.timer);
      if (entry.sseRes && !entry.sseRes.writableEnded) entry.sseRes.end();
      entries.delete(requestId);
    }
  },
};
