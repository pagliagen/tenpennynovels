// =============================================================================
// Game Permission Middleware
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { hasGamePermission, GamePermission } from '@config/permissions';
import { ApiResponse } from '../types/game';
import { logger } from '../logger';

/**
 * Middleware: Require specific game permission
 *
 * Usage:
 * router.post('/chat',
 *   AuthMiddleware.requireCharacterAuth,
 *   requireGamePermission('game:chat:send'),
 *   controller.createMessage
 * );
 *
 * Returns 403 Forbidden if permission denied
 */
export function requireGamePermission(permission: GamePermission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const character = req.character;

    // Character context is required
    if (!character) {
      const response: ApiResponse = {
        result: false,
        error: 'Contesto personaggio richiesto',
        code: 'NO_CHARACTER_CONTEXT',
        timestamp: new Date().toISOString()
      };
      res.status(401).json(response);
      return;
    }

    // Check permission
    const hasPermission = hasGamePermission(
      permission,
      character.playerStatus || 'draft',
      character.isGestore || false,
      character.gameplayRoles || [],
      character.characterPermissions || []
    );

    if (!hasPermission) {
      // Log denied permission for debugging
      logger.warn('Permission denied', {
        characterId: character.characterId,
        characterName: character.characterName,
        requiredPermission: permission,
        playerStatus: character.playerStatus,
        isGestore: character.isGestore,
        gameplayRoles: character.gameplayRoles,
        endpoint: req.path
      });

      const response: ApiResponse & { requiredPermission?: string } = {
        result: false,
        error: 'Non sei autorizzato ad eseguire questa operazione',
        code: 'PERMISSION_DENIED',
        requiredPermission: permission,
        timestamp: new Date().toISOString()
      };
      res.status(403).json(response);
      return;
    }

    // Permission granted, continue
    next();
  };
}
