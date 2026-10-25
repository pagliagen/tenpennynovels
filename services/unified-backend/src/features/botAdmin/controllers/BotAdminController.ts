import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AiGatewayError } from '@core/ai';
import { errorResponse, getRequestId, successResponse } from '@shared/utils/apiResponse';
import { logger } from '@shared/utils/logger';
import { BotAdminError, createBot, listBots, prepareDesign, runDesign, type BotAdminDeps } from '../services/BotAdminService';
import { defaultDeps } from '../services/wiring';

const MAX_DESCRIPTION_CHARS = 2000;
/** Ogni quanto si scrive sul flusso mentre il modello lavora: tiene viva la connessione dietro ai proxy. */
const HEARTBEAT_MS = 5_000;

function fail(req: Request, res: Response, error: unknown, what: string): void {
  if (error instanceof BotAdminError) {
    res.status(error.status).json(errorResponse(error.message, error.code, undefined, error.status, getRequestId(req)));
    return;
  }
  if (error instanceof AiGatewayError) {
    // Il messaggio è già in italiano e senza dettagli tecnici; 400/409/429 dei servizi passano con il loro codice.
    res.status(error.status).json(errorResponse(error.userMessage, error.code ?? 'AI_UNAVAILABLE', undefined, error.status, getRequestId(req)));
    return;
  }
  logger.error(`[BotAdmin] ${what} fallito`, { error });
  res.status(500).json(errorResponse('Errore interno', 'INTERNAL_ERROR', undefined, 500, getRequestId(req)));
}

/** Elenco, generazione e creazione dei bot. Solo con `ENABLE_BOT_CHARACTERS` e il character-bot raggiungibile (feature `botAdmin`). */
export class BotAdminController {
  /** Dipendenze sostituibili nei test. */
  static deps: BotAdminDeps = defaultDeps;

  /** GET /admin/bots */
  static async list(req: Request, res: Response): Promise<void> {
    try {
      res.json(successResponse(await listBots(BotAdminController.deps), undefined, getRequestId(req)));
    } catch (error: unknown) {
      fail(req, res, error, 'list');
    }
  }

  /**
   * POST /admin/bots/design — body `{locationId, description}`. Risponde in **SSE**: una scheda richiede da 15 s a più
   * di un minuto, e il proxy `/admin` dell'api-gateway taglia a 30 s le risposte ferme. Eventi: `progress`
   * (battito ogni 5 s), poi `result` (`{draft, checks, attempts, ms}`) oppure `error` (`{message, code}`).
   * Gli errori di validazione arrivano prima come JSON normale. Non salva nulla.
   */
  static async design(req: Request, res: Response): Promise<void> {
    const { locationId, description } = (req.body ?? {}) as { locationId?: unknown; description?: unknown };
    if (typeof locationId !== 'string' || !mongoose.isValidObjectId(locationId) || typeof description !== 'string' || description.length > MAX_DESCRIPTION_CHARS) {
      res.status(400).json(errorResponse(`Servono locationId e una descrizione di al più ${MAX_DESCRIPTION_CHARS} caratteri`, 'VALIDATION_ERROR', undefined, 400, getRequestId(req)));
      return;
    }

    let prepared;
    try {
      prepared = await prepareDesign(BotAdminController.deps, { locationId, description });
    } catch (error: unknown) {
      fail(req, res, error, 'design');
      return;
    }

    res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    // `compression()` bufferizza: dopo ogni scrittura va forzato l'invio.
    const send = (event: string, data: unknown): void => {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      (res as unknown as { flush?: () => void }).flush?.();
    };

    const startedAt = Date.now();
    send('progress', { elapsedMs: 0 });
    const heartbeat = setInterval(() => send('progress', { elapsedMs: Date.now() - startedAt }), HEARTBEAT_MS);
    res.on('close', () => clearInterval(heartbeat));

    try {
      send('result', await runDesign(BotAdminController.deps, prepared));
    } catch (error: unknown) {
      if (error instanceof BotAdminError) send('error', { message: error.message, code: error.code });
      else if (error instanceof AiGatewayError) send('error', { message: error.userMessage, code: error.code ?? 'AI_UNAVAILABLE' });
      else {
        logger.error('[BotAdmin] design fallito', { error });
        send('error', { message: 'Errore interno', code: 'INTERNAL_ERROR' });
      }
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  }

  /** POST /admin/bots — body `{locationId, draft}`: crea il personaggio e registra la scheda nel bot-service. */
  static async create(req: Request, res: Response): Promise<void> {
    const { locationId, draft } = (req.body ?? {}) as { locationId?: unknown; draft?: unknown };
    if (typeof locationId !== 'string' || !mongoose.isValidObjectId(locationId)) {
      res.status(400).json(errorResponse('locationId non valido', 'VALIDATION_ERROR', undefined, 400, getRequestId(req)));
      return;
    }
    try {
      res.status(201).json(successResponse(await createBot(BotAdminController.deps, { locationId, draft }), undefined, getRequestId(req)));
    } catch (error: unknown) {
      fail(req, res, error, 'create');
    }
  }
}
