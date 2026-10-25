import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AiGatewayError } from '@core/ai';
import { errorResponse, getRequestId, successResponse } from '@shared/utils/apiResponse';
import { logger } from '@shared/utils/logger';
import { InsufficientInputError, LocationNotFoundError, suggestDescription, suggestPositions, suggestTags, type SuggestInput } from '../services/LocationSuggestionService';

type Suggest<T> = (locationId: string, input: SuggestInput) => Promise<T>;

/** Il testo nel form (anche non salvato): la base su cui l'AI lavora. */
const MAX_BASE_CHARS = 2000;

async function handle<T>(req: Request<{ locationId: string }>, res: Response, suggest: Suggest<T>, what: string): Promise<void> {
  const { locationId } = req.params;
  if (!mongoose.isValidObjectId(locationId)) {
    res.status(400).json(errorResponse('Id location non valido', 'VALIDATION_ERROR', undefined, 400, getRequestId(req)));
    return;
  }
  const raw = (req.body as { description?: unknown } | undefined)?.description;
  if (raw !== undefined && (typeof raw !== 'string' || raw.length > MAX_BASE_CHARS)) {
    res.status(400).json(errorResponse(`description deve essere un testo di al più ${MAX_BASE_CHARS} caratteri`, 'VALIDATION_ERROR', undefined, 400, getRequestId(req)));
    return;
  }
  try {
    res.json(successResponse(await suggest(locationId, { description: raw }), undefined, getRequestId(req)));
  } catch (error: unknown) {
    if (error instanceof InsufficientInputError) {
      res.status(422).json(errorResponse(error.message, 'INSUFFICIENT_INPUT', undefined, 422, getRequestId(req)));
      return;
    }
    if (error instanceof LocationNotFoundError) {
      res.status(404).json(errorResponse('Location non trovata', 'NOT_FOUND', undefined, 404, getRequestId(req)));
      return;
    }
    if (error instanceof AiGatewayError) {
      // Il messaggio è già in italiano e senza dettagli tecnici; 429/504 si propagano, il resto è «non disponibile».
      res.status(error.status).json(errorResponse(error.userMessage, 'AI_UNAVAILABLE', undefined, error.status, getRequestId(req)));
      return;
    }
    logger.error(`[Editorial] ${what} fallito`, { error, locationId });
    res.status(500).json(errorResponse('Errore interno', 'INTERNAL_ERROR', undefined, 500, getRequestId(req)));
  }
}

/** Suggerimenti AI per una location. Non scrivono mai: restituiscono una bozza che decide una persona. */
export class EditorialAiController {
  /** POST /admin/editorial/ai/locations/:locationId/suggest-description */
  static suggestDescription(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    return handle(req, res, suggestDescription, 'suggest-description');
  }

  /** POST /admin/editorial/ai/locations/:locationId/suggest-tags */
  static suggestTags(req: Request<{ locationId: string }>, res: Response): Promise<void> {
    return handle(req, res, suggestTags, 'suggest-tags');
  }

  /**
   * POST /admin/editorial/ai/suggest-positions — body {name, description?, tags?, existing?}.
   * Senza id: le posizioni si chiedono anche mentre si crea la location.
   */
  static async suggestPositions(req: Request, res: Response): Promise<void> {
    const body = (req.body ?? {}) as { name?: unknown; description?: unknown; tags?: unknown; existing?: unknown };
    const isTextList = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 20 && v.every((x) => typeof x === 'string' && x.length <= 200);
    const valid =
      typeof body.name === 'string' && body.name.trim() !== '' && body.name.length <= 200 &&
      (body.description === undefined || (typeof body.description === 'string' && body.description.length <= MAX_BASE_CHARS)) &&
      (body.tags === undefined || isTextList(body.tags)) &&
      (body.existing === undefined || isTextList(body.existing));
    if (!valid) {
      res.status(400).json(errorResponse('Dati non validi: servono nome e, facoltativi, descrizione, tag e posizioni esistenti', 'VALIDATION_ERROR', undefined, 400, getRequestId(req)));
      return;
    }
    try {
      const input = { name: (body.name as string).trim(), description: body.description as string | undefined, tags: body.tags as string[] | undefined, existing: body.existing as string[] | undefined };
      res.json(successResponse(await suggestPositions(input), undefined, getRequestId(req)));
    } catch (error: unknown) {
      if (error instanceof InsufficientInputError) {
        res.status(422).json(errorResponse(error.message, 'INSUFFICIENT_INPUT', undefined, 422, getRequestId(req)));
        return;
      }
      if (error instanceof AiGatewayError) {
        res.status(error.status).json(errorResponse(error.userMessage, 'AI_UNAVAILABLE', undefined, error.status, getRequestId(req)));
        return;
      }
      logger.error('[Editorial] suggest-positions fallito', { error });
      res.status(500).json(errorResponse('Errore interno', 'INTERNAL_ERROR', undefined, 500, getRequestId(req)));
    }
  }
}
