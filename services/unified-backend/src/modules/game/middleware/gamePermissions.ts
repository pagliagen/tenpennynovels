// =============================================================================
// Game Permission Middleware
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { hasGamePermission } from '../utils/gamePermissions';
import { ApiResponse } from '../types/game';
import { logger } from '../utils/logger';

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
export function requireGamePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const character = req.character;

    // Character context is required
    if (!character) {
      const response: ApiResponse = {
        result: false,
        success: false,
        error: 'Character context required',
        code: 'NO_CHARACTER_CONTEXT',
        timestamp: new Date().toISOString()
      };
      res.status(401).json(response);
      return;
    }

    // Check permission
    const hasPermission = hasGamePermission(
      permission,
      character.status || 'DRAFT',
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
        status: character.status,
        isGestore: character.isGestore,
        gameplayRoles: character.gameplayRoles,
        endpoint: req.path
      });

      const response: ApiResponse = {
        result: false,
        success: false,
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

/**
 * Middleware: Require ANY of the specified permissions (OR logic)
 *
 * Usage:
 * router.get('/chat',
 *   AuthMiddleware.requireCharacterAuth,
 *   requireAnyGamePermission(['game:chat:read', 'game:chat:moderate']),
 *   controller.getMessages
 * );
 */
export function requireAnyGamePermission(permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const character = req.character;

    if (!character) {
      const response: ApiResponse = {
        result: false,
        success: false,
        error: 'Character context required',
        code: 'NO_CHARACTER_CONTEXT',
        timestamp: new Date().toISOString()
      };
      res.status(401).json(response);
      return;
    }

    // Check if character has ANY of the required permissions
    const hasAnyPermission = permissions.some(permission =>
      hasGamePermission(
        permission,
        character.status || 'DRAFT',
        character.isGestore || false,
        character.gameplayRoles || [],
        character.characterPermissions || []
      )
    );

    if (!hasAnyPermission) {
      logger.warn('Permission denied (ANY check)', {
        characterId: character.characterId,
        requiredPermissions: permissions,
        status: character.status,
        endpoint: req.path
      });

      const response: ApiResponse = {
        result: false,
        success: false,
        error: 'Non sei autorizzato ad eseguire questa operazione',
        code: 'PERMISSION_DENIED',
        requiredPermissions: permissions,
        timestamp: new Date().toISOString()
      };
      res.status(403).json(response);
      return;
    }

    next();
  };
}

/**
 * Middleware: Require ALL of the specified permissions (AND logic)
 *
 * Usage:
 * router.post('/admin/action',
 *   AuthMiddleware.requireCharacterAuth,
 *   requireAllGamePermissions(['game:admin:economy:grant', 'game:admin:time:advance']),
 *   controller.adminAction
 * );
 */
export function requireAllGamePermissions(permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const character = req.character;

    if (!character) {
      const response: ApiResponse = {
        result: false,
        success: false,
        error: 'Character context required',
        code: 'NO_CHARACTER_CONTEXT',
        timestamp: new Date().toISOString()
      };
      res.status(401).json(response);
      return;
    }

    // Check if character has ALL of the required permissions
    const missingPermissions = permissions.filter(permission =>
      !hasGamePermission(
        permission,
        character.status || 'DRAFT',
        character.isGestore || false,
        character.gameplayRoles || [],
        character.characterPermissions || []
      )
    );

    if (missingPermissions.length > 0) {
      logger.warn('Permission denied (ALL check)', {
        characterId: character.characterId,
        requiredPermissions: permissions,
        missingPermissions,
        status: character.status,
        endpoint: req.path
      });

      const response: ApiResponse = {
        result: false,
        success: false,
        error: 'Non sei autorizzato ad eseguire questa operazione',
        code: 'PERMISSION_DENIED',
        requiredPermissions: permissions,
        missingPermissions,
        timestamp: new Date().toISOString()
      };
      res.status(403).json(response);
      return;
    }

    next();
  };
}
