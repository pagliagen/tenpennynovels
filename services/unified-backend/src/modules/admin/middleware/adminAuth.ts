import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RequestUser, AuthToken, CharacterContextToken } from '@shared/types';
import type { AdminPermission } from '@config/admin-permissions';
import { AdminUser, ApiResponse } from '../types/management';
import { logger } from '../utils/logger';
import { errorResponse, getRequestId } from '../utils/apiResponse';
import { appConfig } from '@config/runtime';

function getJwtSecret(): string {
  if (!appConfig.jwt.secret) throw new Error('JWT_SECRET non configurato');
  return appConfig.jwt.secret;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      fullUser?: Record<string, unknown>;
    }
  }
}

export class AdminAuthMiddleware {
  /**
   * Middleware: Read and validate auth_token cookie; load selected character and set effective admin roles
   */
  static requireAdminAccess(req: Request, res: Response, next: NextFunction): void {
    try {
      const authToken = req.cookies?.auth_token;
      if (!authToken) {
        res.status(401).json(errorResponse(
          'Autenticazione richiesta',
          'NO_AUTH_TOKEN',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      const decoded = jwt.verify(authToken, getJwtSecret()) as AuthToken;
      if (!decoded.userId || !decoded.username) {
        throw new Error('Payload del token non valido');
      }

      const requestUser: RequestUser = {
        userId: decoded.userId,
        username: decoded.username,
        email: decoded.email ?? '',
        userRoles: decoded.userRoles ?? [],
        iat: decoded.iat ?? Math.floor(Date.now() / 1000),
        exp: decoded.exp ?? Math.floor(Date.now() / 1000) + 86400,
        characterRoles: [],
        canAccessAdminPanel: false
      };
      req.user = requestUser;

      // Resolve character from cookie and set effective admin roles (async, fire-and-forget for initial attach)
      const characterContext = req.cookies?.character_context;
      if (characterContext) {
        try {
          const characterDecoded = jwt.verify(characterContext, getJwtSecret()) as CharacterContextToken;
          if (characterDecoded?.characterId) {
            const { Character } = require('@database/models/Character');
            const { gameplayRolesToAdminRoles } = require('@config/admin-permissions');
            Character.findById(characterDecoded.characterId)
              .select('gameplayRoles adminPermissions isGestore canAccessAdminPanel')
              .lean()
              .then((char: { gameplayRoles?: string[]; adminPermissions?: string[]; isGestore?: boolean; canAccessAdminPanel?: boolean } | null) => {
                if (char && req.user) {
                  const adminRoles = gameplayRolesToAdminRoles(char.gameplayRoles || []);
                  if (char.isGestore) adminRoles.push('amministratore');
                  req.user.characterRoles = adminRoles;
                  req.user.gameplayRoles = (char.gameplayRoles || []) as ('player' | 'master' | 'moderatore')[];
                  req.user.adminPermissions = char.adminPermissions || [];
                  req.user.isGestore = char.isGestore || false;
                  req.user.canAccessAdminPanel = char.canAccessAdminPanel || char.isGestore || false;
                }
                next();
              })
              .catch(() => next());
            return;
          }
        } catch (_) {}
      }
      next();
    } catch (error: unknown) {
      logger.warn('Admin auth token validation failed:', { 
        error: error instanceof Error ? error.message : String(error), 
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.status(401).json(errorResponse(
        'Token di autenticazione non valido',
        'INVALID_AUTH_TOKEN',
        undefined,
        401,
        getRequestId(req)
      ));
    }
  }

  /**
   * Middleware factory: Requires specific permissions (uses new granular system)
   * Must be called after requireAdminAccess
   */
  static requirePermissions(permissions: string[]) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user?.canAccessAdminPanel) {
        res.status(403).json(errorResponse(
          'Accesso admin richiesto',
          'ADMIN_ACCESS_REQUIRED',
          undefined,
          403,
          getRequestId(req)
        ));
        return;
      }

      try {
        const { hasAdminPermission } = await import('@config/admin-permissions');
        const gameplayRoles = req.user.gameplayRoles ?? [];
        const adminPermissions = req.user.adminPermissions ?? [];
        const isGestore = req.user.isGestore ?? false;

        const missingPermissions = permissions.filter(
          (perm: string) => !hasAdminPermission(gameplayRoles, adminPermissions, isGestore, perm as AdminPermission)
        );

        if (missingPermissions.length > 0) {
          logger.warn('Permessi insufficienti', {
            userId: req.user.userId,
            username: req.user.username,
            requiredPermissions: permissions,
            missingPermissions,
            characterRoles: req.user.characterRoles,
            endpoint: req.originalUrl
          });

          res.status(403).json(errorResponse(
            'Permessi insufficienti',
            'INSUFFICIENT_PERMISSIONS',
            { requiredPermissions: permissions, missingPermissions },
            403,
            getRequestId(req)
          ));
          return;
        }

        next();

      } catch (error: unknown) {
        logger.error('Error checking permissions:', {
          error: error instanceof Error ? error.message : String(error),
          userId: req.user.userId,
          permissions
        });

        res.status(500).json(errorResponse(
          'Controllo permessi fallito',
          'PERMISSION_CHECK_ERROR',
          undefined,
          500,
          getRequestId(req)
        ));
      }
    };
  }

  /**
   * NUOVO SISTEMA GRANULARE: Middleware per richiedere permesso specifico
   * Utilizza il metodo hasViewPermission del User model
   */
  static requireGranularPermission(permission: string) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json(errorResponse(
          'Autenticazione richiesta',
          'AUTHENTICATION_REQUIRED',
          undefined,
          401,
          getRequestId(req)
        ));
        return;
      }

      try {
        const { hasAdminPermission } = await import('@config/admin-permissions');
        const gameplayRoles = req.user.gameplayRoles ?? [];
        const adminPermissions = req.user.adminPermissions ?? [];
        const isGestore = req.user.isGestore ?? false;

        if (!hasAdminPermission(gameplayRoles, adminPermissions, isGestore, permission as AdminPermission)) {
          logger.warn('Insufficient granular permissions', {
            userId: req.user.userId,
            username: req.user.username,
            requiredPermission: permission,
            characterRoles: req.user.characterRoles,
            endpoint: req.originalUrl
          });

          res.status(403).json(errorResponse(
            `Permessi insufficienti per ${permission}`,
            'INSUFFICIENT_GRANULAR_PERMISSIONS',
            { requiredPermission: permission },
            403,
            getRequestId(req)
          ));
          return;
        }

        next();

      } catch (error: unknown) {
        logger.error('Error checking granular permissions:', {
          error: error instanceof Error ? error.message : String(error),
          userId: req.user.userId,
          permission
        });

        res.status(500).json(errorResponse(
          'Controllo permessi fallito',
          'PERMISSION_CHECK_ERROR',
          undefined,
          500,
          getRequestId(req)
        ));
      }
    };
  }

  /**
   * Utility: Check if admin has specific permission (effective = gameplayRoles + adminPermissions + isGestore)
   */
  static async hasPermission(req: Request, permission: string): Promise<boolean> {
    if (!req.user) return false;
    try {
      const { hasAdminPermission } = await import('@config/admin-permissions');
      const gameplayRoles = req.user.gameplayRoles ?? [];
      const adminPermissions = req.user.adminPermissions ?? [];
      const isGestore = req.user.isGestore ?? false;
      return hasAdminPermission(gameplayRoles, adminPermissions, isGestore, permission as AdminPermission);
    } catch {
      return false;
    }
  }

  /**
   * Utility: Check if admin has specific role
   */
  static hasRole(req: Request, role: string): boolean {
    if (!req.user) return false;

    return (req.user.characterRoles as string[])?.includes(role) || false;
  }

  /**
   * Utility: Check if admin has any of the specified roles
   */
  static hasAnyRole(req: Request, roles: string[]): boolean {
    if (!req.user) return false;

    if (req.user.userRoles?.some(role => roles.includes(role))) return true;
    return req.user.characterRoles?.some(role => roles.includes(role)) || false;
  }

  /**
   * Middleware: Log admin actions for audit trail
   */
  static logAdminAction(action: string, category: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Store action info for use in controllers
      req.adminAction = {
        action,
        category,
        timestamp: new Date(),
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'Unknown'
      };

      // Log the action attempt
      logger.info('Admin action initiated', {
        action,
        category,
        adminId: req.user?.userId,
        adminUsername: req.user?.username,
        userRoles: req.user?.userRoles,
        characterRoles: req.user?.characterRoles,
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip
      });

      next();
    };
  }

  /**
   * Middleware: Rate limiting for sensitive admin operations
   */
  static sensitiveOperationLimit() {
    const attempts = new Map<string, { count: number; resetTime: number }>();
    const maxAttempts = 10;
    const windowMs = 60 * 60 * 1000; // 1 hour

    return (req: Request, res: Response, next: NextFunction): void => {
      const key = `${req.user?.userId}-${req.ip}`;
      const now = Date.now();
      
      const userAttempts = attempts.get(key);
      
      if (userAttempts) {
        if (now > userAttempts.resetTime) {
          // Reset window
          attempts.set(key, { count: 1, resetTime: now + windowMs });
        } else if (userAttempts.count >= maxAttempts) {
          logger.warn('Admin rate limit exceeded', {
            userId: req.user?.userId,
            ip: req.ip,
            attempts: userAttempts.count
          });

          res.status(429).json(errorResponse(
            'Troppe operazioni sensibili. Attendi prima di riprovare.',
            'ADMIN_RATE_LIMITED',
            undefined,
            429,
            getRequestId(req)
          ));
          return;
        } else {
          userAttempts.count++;
        }
      } else {
        attempts.set(key, { count: 1, resetTime: now + windowMs });
      }

      next();
    };
  }

  /**
   * Utility: Extract admin info for audit logging
   */
  static getAuditInfo(req: Request): { adminId: string; adminUsername: string; adminCharacterName: string; userRoles: string[]; characterRoles: string[]; ipAddress: string; userAgent: string } | null {
    if (!req.user) return null;

    // Extract character name from character_context cookie
    let adminCharacterName = req.user.username; // Fallback to username
    const characterContextToken = req.cookies?.character_context;
    if (characterContextToken) {
      try {
        const { AuthUtils } = require('../utils/auth');
        const characterContext = AuthUtils.decodeCharacterContext(characterContextToken);
        if (characterContext?.characterName) {
          adminCharacterName = characterContext.characterName;
        }
      } catch (error) {
        // Ignore error, use fallback
      }
    }

    return {
      adminId: req.user.userId,
      adminUsername: req.user.username,
      adminCharacterName: adminCharacterName,
      userRoles: req.user.userRoles || [],
      characterRoles: req.user.characterRoles || [],
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'Unknown'
    };
  }
}

// Extend Request interface for admin action logging
declare global {
  namespace Express {
    interface Request {
      adminAction?: {
        action: string;
        category: string;
        timestamp: Date;
        ipAddress: string;
        userAgent: string;
      };
    }
  }
}