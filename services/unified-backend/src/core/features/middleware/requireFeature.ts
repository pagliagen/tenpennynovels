/**
 * Gate di una route su una feature. 404, non 403 (§3.5/§7 del piano):
 * una feature spenta non deve rivelare la propria esistenza. Delega a
 * notFoundHandler invece di costruire una risposta simile a mano, cosi
 * la risposta resta byte-per-byte quella di una route che non esiste
 * affatto, oggi e se notFoundHandler cambia in futuro.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { notFoundHandler } from '@shared/middleware/errorHandler';
import { FeatureFlagService } from '../flags';
import type { FeatureKey } from '../types';

export function requireFeature(key: FeatureKey): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (await FeatureFlagService.isEnabled(key)) {
      next();
      return;
    }
    notFoundHandler(req, res, next);
  };
}
