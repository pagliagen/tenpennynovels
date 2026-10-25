import { Request, Response } from 'express';
import { errorResponse, getRequestId, successResponse } from '@shared/utils/apiResponse';
import { logger } from '@shared/utils/logger';
import { runCanonCheck } from '../services/CanonCheckService';

export class EditorialController {
  /**
   * Rapporto di coerenza di canone su documenti, sottotipi e location. Solo regole
   * deterministiche (nessun modello): non modifica nulla.
   * GET /admin/editorial/canon-check
   */
  static async getCanonCheck(req: Request, res: Response): Promise<void> {
    try {
      res.json(successResponse(await runCanonCheck(), undefined, getRequestId(req)));
    } catch (error: unknown) {
      logger.error('[Editorial] canon-check fallito', { error });
      res.status(500).json(errorResponse('Errore interno', 'INTERNAL_ERROR', undefined, 500, getRequestId(req)));
    }
  }
}
