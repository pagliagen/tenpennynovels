import { Request, Response, NextFunction } from 'express';
import { Character } from '@core/character/models/Character';
import type { SuccessResponse, ErrorResponse, ListResponse } from '@shared/types/responses';
import { logger } from '../logger';
import { errorResponse, getRequestId } from '@shared/utils/apiResponse';

/**
 * Middleware to require Master gameplayRole
 * Verifies that the authenticated character has 'master' in gameplayRoles
 */
export const requireMaster = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const characterId = req.character?.characterId;

    if (!characterId) {
      res.status(401).json(errorResponse(
        'Character non trovato nella richiesta',
        'CHARACTER_NOT_FOUND',
        undefined,
        401,
        getRequestId(req)
      ));
      return;
    }

    // Load character to verify gameplayRoles
    const character = await Character.findById(characterId);

    if (!character) {
      res.status(404).json(errorResponse(
        'Personaggio non trovato',
        'CHARACTER_NOT_FOUND',
        undefined,
        404,
        getRequestId(req)
      ));
      return;
    }

    // Check if character has 'master' role
    if (!character.gameplayRoles || !character.gameplayRoles.includes('master')) {
      logger.warn('Unauthorized master access attempt', {
        characterId,
        characterName: character.name,
        gameplayRoles: character.gameplayRoles
      });

      res.status(403).json(errorResponse(
        'Solo i master possono accedere a questa funzione',
        'MASTER_REQUIRED',
        undefined,
        403,
        getRequestId(req)
      ));
      return;
    }

    // Character is a master, proceed
    next();
  } catch (error) {
    logger.error('requireMaster middleware error:', error);
    res.status(500).json(errorResponse(
      'Errore verifica permessi master',
      'MASTER_CHECK_ERROR',
      undefined,
      500,
      getRequestId(req)
    ));
  }
};
