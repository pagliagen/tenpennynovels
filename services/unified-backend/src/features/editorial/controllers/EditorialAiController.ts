import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AiGatewayError } from '@core/ai';
import { errorResponse, getRequestId, successResponse } from '@shared/utils/apiResponse';
import { logger } from '@shared/utils/logger';
import { LocationNotFoundError, suggestDescription, suggestTags } from '../services/LocationSuggestionService';

type Suggest<T> = (locationId: string) => Promise<T>;

async function handle<T>(req: Request<{ locationId: string }>, res: Response, suggest: Suggest<T>, what: string): Promise<void> {
  const { locationId } = req.params;
  if (!mongoose.isValidObjectId(locationId)) {
    res.status(400).json(errorResponse('Id location non valido', 'VALIDATION_ERROR', undefined, 400, getRequestId(req)));
    return;
  }
  try {
    res.json(successResponse(await suggest(locationId), undefined, getRequestId(req)));
  } catch (error: unknown) {
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
}
