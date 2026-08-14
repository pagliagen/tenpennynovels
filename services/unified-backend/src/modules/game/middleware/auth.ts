import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RequestUser, AuthToken, CharacterContextToken } from '@shared/types';
import type { AdminPermission } from '@config/permissions';
import { AuthUser, CharacterContext, ApiResponse } from '../types/game';
import { logger } from '../logger';
import { appConfig } from '@config/runtime';

function getJwtSecret(): string {
  if (!appConfig.jwt.secret) throw new Error('JWT_SECRET non configurato');
  return appConfig.jwt.secret;
}

// req.user/req.character tipizzati in auth/middleware/auth.ts (RequestUser) e usati qui

export class AuthMiddleware {
  /**
   * Utility: Authenticate user from request without middleware flow
   * Returns result object instead of calling res/next
   * Use this for inline auth checks in controllers
   */
  static authenticate(req: Request): { result: boolean; user?: AuthUser; error?: string } {
    try {
      const authToken = req.cookies?.auth_token;
      if (!authToken) {
        return { result: false,  error: 'Token di autenticazione mancante' };
      }

      const jwtSecret = getJwtSecret();
      const decoded = jwt.verify(authToken, jwtSecret) as AuthToken;

      if (!decoded.userId || !decoded.username) {
        return { result: false,  error: 'Payload del token non valido' };
      }

      const user: AuthUser = {
        userId: decoded.userId,
        username: decoded.username,
        email: decoded.email ?? '',
        userRoles: decoded.userRoles || ['user'],
        iat: decoded.iat ?? Math.floor(Date.now() / 1000),
        exp: decoded.exp ?? Math.floor(Date.now() / 1000) + 86400
      };

      return { result: true,  user };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn('Auth token validation failed:', { error: errorMsg, ip: req.ip });
      return { result: false,  error: errorMsg };
    }
  }

  /**
   * Middleware: Read and validate auth_token cookie
   * Extracts: userId, username, adminInfo
   */
  static requireUserAuth(req: Request, res: Response, next: NextFunction): void {
    try {
      const authToken = req.cookies?.auth_token;
      
      if (!authToken) {
        const response: ApiResponse = {
          result: false,
          error: 'Autenticazione richiesta',
          code: 'NO_AUTH_TOKEN',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
        return;
      }

      // Verify JWT token
      const jwtSecret = getJwtSecret();
      const decoded = jwt.verify(authToken, jwtSecret) as AuthToken;
      
      if (!decoded.userId || !decoded.username) {
        throw new Error('Payload del token non valido');
      }

      // Attach user info to request (campi admin impostati solo da admin middleware)
      req.user = {
        userId: decoded.userId,
        username: decoded.username,
        email: decoded.email ?? '',
        userRoles: decoded.userRoles || ['user'],
        iat: decoded.iat ?? Math.floor(Date.now() / 1000),
        exp: decoded.exp ?? Math.floor(Date.now() / 1000) + 86400
      } as RequestUser;

      next();

    } catch (error: unknown) {
      logger.warn('Auth token validation failed:', { error: error instanceof Error ? error.message : String(error), ip: req.ip });
      
      const response: ApiResponse = {
        result: false,
        error: 'Token di autenticazione non valido',
        code: 'INVALID_AUTH_TOKEN',
        timestamp: new Date().toISOString()
      };
      
      res.status(401).json(response);
    }
  }

  /**
   * Middleware: Read and validate character_context cookie OR sessionId header
   * Requires: Valid auth_token (must be called after requireUserAuth)
   *
   * NEW FLOW (Multi-Tab Support):
   * 1. Try X-Session-Id header first (preferred)
   * 2. Lookup session in Redis
   * 3. Validate ownership (session.userId === auth_token.userId)
   * 4. Fallback to cookie character_context (DEPRECATED - backward compatibility)
   */
  static async requireCharacterContext(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('Autenticazione utente richiesta prima del contesto personaggio');
      }

      // NEW FLOW: Try sessionId header first
      const sessionId = req.headers['x-session-id'] as string | undefined;

      if (sessionId) {
        try {
          // Import SessionStore dynamically to avoid circular dependency
          const { SessionStore } = await import('@core/auth/services/SessionStore');
          const session = await SessionStore.getSession(sessionId);

          if (!session) {
            const response: ApiResponse = {
              result: false,
              error: 'Sessione non trovata o scaduta',
              code: 'INVALID_SESSION',
              timestamp: new Date().toISOString()
            };
            res.status(401).json(response);
            return;
          }

          // CRITICAL: Ownership validation (defense in depth)
          if (session.userId !== req.user.userId) {
            logger.warn('Session ownership mismatch', {
              sessionId,
              sessionUserId: session.userId,
              requestUserId: req.user.userId
            });

            const response: ApiResponse = {
              result: false,
              error: 'Sessione non valida per questo utente',
              code: 'SESSION_OWNERSHIP_MISMATCH',
              timestamp: new Date().toISOString()
            };
            res.status(403).json(response);
            return;
          }

          // Populate req.character from session
          const { Character } = await import('@database/models');
          const character = await Character.findById(session.characterId);

          if (!character) {
            const response: ApiResponse = {
              result: false,
              error: 'Personaggio non trovato',
              code: 'CHARACTER_NOT_FOUND',
              timestamp: new Date().toISOString()
            };
            res.status(404).json(response);
            return;
          }

          const now = Math.floor(Date.now() / 1000);

          req.character = {
            characterId: character.id,
            characterName: character.name,
            userId: session.userId,
            isApproved: character.playerStatus === 'approved',
            gameplayRoles: character.gameplayRoles || [],
            isGestore: character.isGestore || false,
            characterPermissions: character.characterPermissions || [],
            iat: now,
            exp: now + 86400 // 24h (matches session TTL)
          };

          logger.debug('Session authenticated via X-Session-Id header', {
            sessionId,
            characterId: character.id,
            characterName: character.name
          });

          // Update session activity (async, non-blocking)
          SessionStore.updateSessionActivity(sessionId).catch(err =>
            logger.error('Failed to update session activity', err)
          );

          next();
          return;

        } catch (error: unknown) {
          logger.error('Session validation error', { error, sessionId });
          const response: ApiResponse = {
            result: false,
            error: 'Errore validazione sessione',
            code: 'SESSION_VALIDATION_ERROR',
            timestamp: new Date().toISOString()
          };
          res.status(500).json(response);
          return;
        }
      }

      // FALLBACK FLOW: Cookie character_context (DEPRECATED - backward compatibility)
      const characterToken = req.cookies?.character_context;

      if (!characterToken) {
        const response: ApiResponse = {
          result: false,
          error: 'Selezione del personaggio richiesta',
          code: 'NO_CHARACTER_CONTEXT',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      logger.warn('DEPRECATED: Using character_context cookie', { userId: req.user.userId });

      // Verify character context token
      const decoded = jwt.verify(characterToken, getJwtSecret()) as CharacterContextToken;
      
      if (!decoded.characterId || !decoded.userId) {
        throw new Error('Token contesto personaggio non valido');
      }

      // Verify that character belongs to authenticated user
      if (decoded.userId !== req.user.userId) {
        throw new Error('Il personaggio non appartiene all\'utente autenticato');
      }

      // Attach character context to request
      req.character = {
        characterId: decoded.characterId,
        characterName: decoded.characterName,
        userId: decoded.userId,
        gameplayRoles: decoded.gameplayRoles || [],
        isApproved: decoded.isApproved !== undefined ? decoded.isApproved : true,
        // Game permissions system
        isGestore: decoded.isGestore || false,
        playerStatus: decoded.playerStatus || 'draft',
        characterPermissions: decoded.characterPermissions || [],
        iat: decoded.iat || Math.floor(Date.now() / 1000),
        exp: decoded.exp || Math.floor(Date.now() / 1000) + 86400
      };

      next();

    } catch (error: unknown) {
      logger.warn('Character context validation failed:', { 
        error: error instanceof Error ? error.message : String(error), 
        userId: req.user?.userId,
        ip: req.ip 
      });
      
      const response: ApiResponse = {
        result: false,
        error: 'Contesto personaggio non valido',
        code: 'INVALID_CHARACTER_CONTEXT',
        timestamp: new Date().toISOString()
      };
      
      res.status(401).json(response);
    }
  }

  /**
   * Combined middleware: Requires both auth_token and character_context (or sessionId)
   * Plus character must be APPROVED status
   */
  static requireCharacterAuth(req: Request, res: Response, next: NextFunction): void {
    // Chain the middlewares
    AuthMiddleware.requireUserAuth(req, res, async (err?: any) => {
      if (err) return;

      await AuthMiddleware.requireCharacterContext(req, res, async (err?: any) => {
        if (err) return;
        
        try {
          // Import here to avoid circular dependency
          const { Character } = await import('@database/models');

          // Verify character exists and belongs to user
          const character = await Character.findOne({
            _id: req.character!.characterId,
            userId: req.user!.userId
          });

          if (!character) {
            const response: ApiResponse = {
              result: false,
              error: 'Personaggio non trovato o non accessibile',
              code: 'CHARACTER_NOT_FOUND',
              timestamp: new Date().toISOString()
            };
            res.status(403).json(response);
            return;
          }

          // Enrich req.character with fresh DB data (cookie may be stale after status changes)
          req.character = {
            ...req.character!,
            playerStatus: character.playerStatus,
            gameplayRoles: character.gameplayRoles || ['player'],
            isApproved: character.playerStatus === 'approved',
            isGestore: character.isGestore || false,
            characterPermissions: character.characterPermissions || []
          };

          next();

        } catch (error: unknown) {
          logger.error('Character approval check failed:', error);

          const response: ApiResponse = {
            result: false,
            error: 'Verifica del personaggio fallita',
            code: 'CHARACTER_VERIFICATION_ERROR',
            timestamp: new Date().toISOString()
          };
          
          res.status(500).json(response);
        }
      });
    });
  }

  /**
   * Middleware: Requires admin panel access
   * Must be called after requireUserAuth
   */
  static requireAdminAccess(req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      const response: ApiResponse = {
        result: false,
        error: 'Autenticazione richiesta',
        code: 'NO_AUTH_TOKEN',
        timestamp: new Date().toISOString()
      };
      res.status(401).json(response);
      return;
    }

    if (!req.user.canAccessAdminPanel) {
      const response: ApiResponse = {
        result: false,
        error: 'Accesso admin richiesto',
        code: 'ADMIN_ACCESS_REQUIRED',
        timestamp: new Date().toISOString()
      };
      res.status(403).json(response);
      return;
    }

    next();
  }

  /**
   * Middleware factory: Requires specific admin permissions
   * Must be called after requireAdminAccess
   */
  static requireAdminPermissions(permissions: string[]) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user?.canAccessAdminPanel) {
        const response: ApiResponse = {
          result: false,
          error: 'Accesso admin richiesto',
          code: 'ADMIN_ACCESS_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      try {
        const { hasAdminPermission } = await import('@config/permissions');
        const gameplayRoles = req.user.gameplayRoles ?? [];
        const adminPermissions = req.user.adminPermissions ?? [];
        const isGestore = req.user.isGestore ?? false;
        const missingPermissions = permissions.filter(
          (perm) => !hasAdminPermission(gameplayRoles, adminPermissions, isGestore, perm as AdminPermission)
        );

        if (missingPermissions.length > 0) {
          const response: ApiResponse = {
            result: false,
            error: 'Permessi insufficienti',
            code: 'INSUFFICIENT_PERMISSIONS',
            details: { missingPermissions },
            timestamp: new Date().toISOString()
          };
          res.status(403).json(response);
          return;
        }
        next();
      } catch (err: unknown) {
        logger.error('requireAdminPermissions error', { error: err instanceof Error ? err.message : String(err), permissions });
        res.status(500).json({
          result: false,
          error: 'Controllo permessi fallito',
          code: 'PERMISSION_CHECK_ERROR',
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Utility: Check if character has specific gameplay role
   */
  static hasGameplayRole(req: Request, role: 'player' | 'master' | 'moderatore'): boolean {
    return req.character?.gameplayRoles?.includes(role) ?? false;
  }

  /**
   * Middleware factory: Requires specific gameplay roles
   * Must be called after requireCharacterAuth
   */
  static requireGameplayRoles(roles: ('player' | 'master' | 'moderatore')[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.character) {
        const response: ApiResponse = {
          result: false,
          error: 'Contesto personaggio richiesto',
          code: 'NO_CHARACTER_CONTEXT',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const hasRequiredRole = roles.some(role =>
        req.character?.gameplayRoles?.includes(role) ?? false
      );

      if (!hasRequiredRole) {
        const response: ApiResponse = {
          result: false,
          error: 'Permessi di gioco insufficienti',
          code: 'INSUFFICIENT_GAMEPLAY_PERMISSIONS',
          details: { 
            requiredRoles: roles,
            userRoles: req.character.gameplayRoles
          },
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      next();
    };
  }

  /**
   * Optional auth middleware - sets user if token present, but doesn't require it
   */
  static optionalAuth(req: Request, res: Response, next: NextFunction): void {
    try {
      const authToken = req.cookies?.auth_token;
      
      if (authToken) {
        const decoded = jwt.verify(authToken, getJwtSecret()) as AuthToken;
        
        if (decoded.userId && decoded.username) {
          req.user = {
            userId: decoded.userId,
            username: decoded.username,
            email: decoded.email ?? '',
            userRoles: decoded.userRoles || ['user'],
            iat: decoded.iat ?? Math.floor(Date.now() / 1000),
            exp: decoded.exp ?? Math.floor(Date.now() / 1000) + 86400
          } as RequestUser;
        }
      }

      next();

    } catch (error: unknown) {
      // For optional auth, we just continue without setting user
      next();
    }
  }

  /**
   * Middleware: Validates webhook secret for AI Gateway callbacks (local-ai → unified-backend).
   */
  static requireAIGatewayAuth(req: Request, res: Response, next: NextFunction): void {
    try {
      const authHeader = req.headers['authorization'] as string;
      const expectedSecret = appConfig.services.aiGateway.webhookSecret;

      if (!expectedSecret) {
        logger.error('AI_GATEWAY_WEBHOOK_SECRET non configurato - richiesta rifiutata');
        const response: ApiResponse = {
          result: false,
          error: 'Configurazione webhook mancante',
          code: 'WEBHOOK_NOT_CONFIGURED',
          timestamp: new Date().toISOString()
        };
        res.status(503).json(response);
        return;
      }

      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!token || token !== expectedSecret) {
        const response: ApiResponse = {
          result: false,
          error: 'Autorizzazione webhook non valida',
          code: 'INVALID_WEBHOOK_AUTH',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
        return;
      }

      next();

    } catch (error: unknown) {
      logger.error('AI Gateway auth validation failed:', error);
      const response: ApiResponse = {
        result: false,
        error: 'Autenticazione fallita',
        code: 'AUTH_ERROR',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  /**
   * Utility: Extract character ownership from request
   * Used for ownership checks in controllers
   */
  static getCharacterOwnership(req: Request): { userId: string; characterId?: string } | null {
    if (!req.user) return null;

    return {
      userId: req.user.userId,
      characterId: req.character?.characterId
    };
  }

  /**
   * Utility: Decode character_context token without full validation
   * Returns decoded payload or null if invalid
   * Used for checking session details in controllers
   */
  static decodeCharacterContext(token: string): { characterId: string; userId: string; characterName: string; sessionId: string; gameplayRoles: string[]; isGestore: boolean; playerStatus: string; characterPermissions: string[] } | null {
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as CharacterContextToken;
      if (!decoded.characterId || !decoded.userId) {
        return null;
      }
      return {
        characterId: decoded.characterId,
        userId: decoded.userId,
        characterName: decoded.characterName ?? '',
        sessionId: decoded.sessionId ?? '',
        gameplayRoles: decoded.gameplayRoles || [],
        isGestore: decoded.isGestore || false,
        playerStatus: decoded.playerStatus || 'draft',
        characterPermissions: decoded.characterPermissions || []
      };
    } catch (error) {
      return null;
    }
  }
}

// Backward compatibility alias
export const AuthUtils = AuthMiddleware;