import { Request, Response, NextFunction } from 'express';
import { CryptoUtils } from '../utils/crypto';
import { RequestUser, CharacterContextPayload, ApiResponse } from '@shared/types';
import { logger, logAuth, logSecurity } from '../logger';
import { CharacterSessionManager } from '../utils/characterSessionManager';
import { User } from '../models/User';
import { appConfig } from '@config/runtime';
import type { AdminPermission } from '@config/permissions';

// Extend Express Request interface to include user data (RequestUser = token + optional character-derived fields from admin)
declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      character?: CharacterContextPayload;
      sessionId?: string;
    }
  }
}

export class AuthMiddleware {
  /**
   * Middleware to verify auth_token cookie and set req.user
   */
  static authenticateUser(required = true) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authToken = req.cookies?.auth_token;

        if (!authToken) {
          if (required) {
            const response: ApiResponse = {
              result: false,
              error: 'Autenticazione richiesta',
              code: 'AUTH_REQUIRED',
              timestamp: new Date().toISOString()
            };
            return res.status(401).json(response);
          }
          return next();
        }

        try {
          const decoded = CryptoUtils.verifyAuthToken(authToken);
          req.user = decoded;

          // Check if account is deleted/anonymized
          const user = await User.findById(decoded.userId).select('accountStatus');
          if (user && (user.accountStatus === 'anonymized' || user.accountStatus === 'deleted')) {
            AuthMiddleware.clearAuthCookies(res);

            logSecurity('deleted_account_access_attempt', {
              userId: decoded.userId,
              username: decoded.username,
              accountStatus: user.accountStatus,
              ipAddress: req.ip
            });

            const response: ApiResponse = {
              result: false,
              error: 'Account non più attivo',
              code: 'ACCOUNT_DELETED',
              timestamp: new Date().toISOString()
            };
            return res.status(403).json(response);
          }

          logAuth('token_verified', decoded.userId, {
            username: decoded.username,
            ipAddress: req.ip
          });

          next();
        } catch (error: unknown) {
          res.clearCookie('auth_token', appConfig.cookie);

          if (required) {
            logSecurity('invalid_token_access', {
              error: error instanceof Error ? error.message : 'Errore sconosciuto',
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            });

            const response: ApiResponse = {
              result: false,
              error: 'Sessione non valida o scaduta',
              code: 'INVALID_SESSION',
              timestamp: new Date().toISOString()
            };
            return res.status(401).json(response);
          }

          next();
        }
      } catch (error: unknown) {
        logger.error('Auth middleware error:', error);
        const response: ApiResponse = {
          result: false,
          error: 'Errore di autenticazione',
          code: 'AUTH_ERROR',
          timestamp: new Date().toISOString()
        };
        return res.status(500).json(response);
      }
    };
  }

  /**
   * Middleware to verify character session (Redis-based multi-tab support)
   *
   * NEW FLOW (Hybrid Server-Side Session + sessionStorage):
   * 1. Read sessionId from header X-Session-Id (or body for sendBeacon)
   * 2. Lookup Redis via SessionStore
   * 3. Ownership validation: session.userId === req.user.userId (CRITICAL security)
   * 4. Populate req.character from Character model
   * 5. Fallback: cookie character_context (DEPRECATED, backward compatibility)
   */
  static authenticateCharacter(required = true) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Import SessionStore dynamically to avoid circular dependency
        const { SessionStore } = await import('../services/SessionStore');
        const { Character } = await import('@core/character/models/Character');

        // 1. Read sessionId from header (or body for sendBeacon compatibility)
        const sessionId = (req.headers['x-session-id'] as string) || req.body?.sessionId;

        // NEW FLOW: Session ID in header
        if (sessionId) {
          try {
            // 2. Lookup Redis session
            const session = await SessionStore.getSession(sessionId);

            if (!session) {
              logSecurity('session_not_found', {
                sessionId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
              });

              if (required) {
                const response: ApiResponse = {
                  result: false,
                  error: 'Sessione non valida o scaduta',
                  code: 'INVALID_SESSION',
                  timestamp: new Date().toISOString()
                };
                return res.status(401).json(response);
              }
              return next();
            }

            // 3. CRITICAL: Ownership validation (defense in depth)
            if (req.user && session.userId !== req.user.userId) {
              logSecurity('session_ownership_mismatch', {
                sessionId,
                sessionUserId: session.userId,
                requestUserId: req.user.userId,
                ipAddress: req.ip
              });

              const response: ApiResponse = {
                result: false,
                error: 'Sessione non valida per questo utente',
                code: 'SESSION_OWNERSHIP_MISMATCH',
                timestamp: new Date().toISOString()
              };
              return res.status(403).json(response);
            }

            // 4. Populate req.character from Character model
            const character = await Character.findById(session.characterId);

            if (!character) {
              logSecurity('character_not_found_for_session', {
                sessionId,
                characterId: session.characterId,
                ipAddress: req.ip
              });

              if (required) {
                const response: ApiResponse = {
                  result: false,
                  error: 'Personaggio non trovato',
                  code: 'CHARACTER_NOT_FOUND',
                  timestamp: new Date().toISOString()
                };
                return res.status(404).json(response);
              }
              return next();
            }

            // Populate req.character (same structure as JWT token)
            req.character = {
              characterId: character.id,
              characterName: character.name,
              userId: session.userId,
              avatar: character.avatar,
              gameplayRoles: character.gameplayRoles || [],
              isApproved: character.playerStatus === 'approved',
              isGestore: character.isGestore || false,
              playerStatus: character.playerStatus || 'draft',
              characterPermissions: character.characterPermissions || [],
              adminPermissions: character.adminPermissions || [],
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + 86400 // 24h
            };

            // Store sessionId in request for later use
            req.sessionId = sessionId;

            // 5. Update session activity (async, non-blocking)
            SessionStore.updateSessionActivity(sessionId).catch(err =>
              logger.error('Failed to update session activity', { error: err, sessionId })
            );

            logAuth('character_session_validated', session.userId, {
              sessionId,
              characterId: character.id,
              characterName: character.name,
              ipAddress: req.ip
            });

            return next();

          } catch (error: unknown) {
            logger.error('Session validation error:', { error, sessionId });

            if (required) {
              const response: ApiResponse = {
                result: false,
                error: 'Errore validazione sessione',
                code: 'SESSION_VALIDATION_ERROR',
                timestamp: new Date().toISOString()
              };
              return res.status(500).json(response);
            }
            return next();
          }
        }

        // FALLBACK FLOW: Cookie character_context (DEPRECATED - backward compatibility)
        const characterToken = req.cookies?.character_context;

        if (!characterToken) {
          if (required) {
            const response: ApiResponse = {
              result: false,
              error: 'Selezione del personaggio richiesta',
              code: 'CHARACTER_REQUIRED',
              timestamp: new Date().toISOString()
            };
            return res.status(400).json(response);
          }
          return next();
        }

        // Log deprecated cookie usage for monitoring
        logger.warn('DEPRECATED: character_context cookie used (migrate to sessionId header)', {
          userId: req.user?.userId,
          ipAddress: req.ip
        });

        try {
          const decoded = CryptoUtils.verifyCharacterContextToken(characterToken);

          // Verify that character belongs to authenticated user
          if (req.user && decoded.userId !== req.user.userId) {
            logSecurity('character_token_mismatch', {
              tokenUserId: decoded.userId,
              authenticatedUserId: req.user.userId,
              ipAddress: req.ip
            });

            res.clearCookie('character_context', appConfig.cookie);

            const response: ApiResponse = {
              result: false,
              error: 'Discrepanza token personaggio',
              code: 'CHARACTER_TOKEN_MISMATCH',
              timestamp: new Date().toISOString()
            };
            return res.status(400).json(response);
          }

          // Validate character session uniqueness (old flow)
          const sessionValidation = await CharacterSessionManager.validateCharacterSession(
            decoded.characterId,
            characterToken
          );

          if (!sessionValidation.valid) {
            logSecurity('character_session_invalid', {
              characterId: decoded.characterId,
              userId: decoded.userId,
              reason: sessionValidation.reason,
              ipAddress: req.ip
            });

            res.clearCookie('character_context', appConfig.cookie);

            if (required) {
              const response: ApiResponse = {
                result: false,
                error: 'Sessione personaggio non più valida. Un altro dispositivo potrebbe aver effettuato l\'accesso con questo personaggio.',
                code: 'CHARACTER_SESSION_INVALID',
                timestamp: new Date().toISOString()
              };
              return res.status(401).json(response);
            }

            return next();
          }

          req.character = decoded;
          next();
        } catch (error: unknown) {
          res.clearCookie('character_context', appConfig.cookie);

          if (required) {
            const response: ApiResponse = {
              result: false,
              error: 'Sessione personaggio non valida o scaduta',
              code: 'INVALID_CHARACTER_SESSION',
              timestamp: new Date().toISOString()
            };
            return res.status(400).json(response);
          }

          next();
        }
      } catch (error: unknown) {
        logger.error('Character auth middleware error:', error);
        const response: ApiResponse = {
          result: false,
          error: 'Errore di autenticazione del personaggio',
          code: 'CHARACTER_AUTH_ERROR',
          timestamp: new Date().toISOString()
        };
        return res.status(500).json(response);
      }
    };
  }

  /**
   * Middleware to check if user has admin privileges
   */
  static requireAdmin(permissions: string[] = []) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          const response: ApiResponse = {
            result: false,
            error: 'Autenticazione richiesta',
            code: 'AUTH_REQUIRED',
            timestamp: new Date().toISOString()
          };
          return res.status(401).json(response);
        }

        if (!req.user.canAccessAdminPanel) {
          logSecurity('unauthorized_admin_access', {
            userId: req.user.userId,
            username: req.user.username,
            ipAddress: req.ip,
            requiredPermissions: permissions
          });

          const response: ApiResponse = {
            result: false,
            error: 'Privilegi admin richiesti',
            code: 'ADMIN_REQUIRED',
            timestamp: new Date().toISOString()
          };
          return res.status(403).json(response);
        }

        // Check specific permissions if provided (effective = gameplayRoles + adminPermissions + isGestore)
        if (permissions.length > 0) {
          const { hasAdminPermission } = await import('@config/permissions');
          const gameplayRoles = req.user.gameplayRoles ?? [];
          const adminPermissions = req.user.adminPermissions ?? [];
          const isGestore = req.user.isGestore ?? false;
          const hasPermission = permissions.every((p) =>
            hasAdminPermission(gameplayRoles, adminPermissions, isGestore, p as AdminPermission)
          );

          if (!hasPermission) {
            logSecurity('insufficient_admin_permissions', {
              userId: req.user.userId,
              username: req.user.username,
              ipAddress: req.ip,
              requiredPermissions: permissions,
              userRoles: req.user.userRoles,
              characterRoles: req.user.characterRoles,
              gameplayRoles: req.user.gameplayRoles,
              adminPermissions: req.user.adminPermissions
            });

            const response: ApiResponse = {
              result: false,
              error: 'Permessi admin insufficienti',
              code: 'INSUFFICIENT_PERMISSIONS',
              timestamp: new Date().toISOString()
            };
            return res.status(403).json(response);
          }
        }

        next();
      } catch (error: unknown) {
        logger.error('Admin auth middleware error:', error);
        const response: ApiResponse = {
          result: false,
          error: 'Errore di autenticazione admin',
          code: 'ADMIN_AUTH_ERROR',
          timestamp: new Date().toISOString()
        };
        return res.status(500).json(response);
      }
    };
  }

  /**
   * Middleware to check character gameplay roles (player | master | moderatore). isGestore bypassa il check.
   */
  static requireGameplayRole(roles: ('player' | 'master' | 'moderatore')[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.character) {
          const response: ApiResponse = {
            result: false,
            error: 'Selezione del personaggio richiesta',
            code: 'CHARACTER_REQUIRED',
            timestamp: new Date().toISOString()
          };
          return res.status(400).json(response);
        }

        if (req.character.isGestore) {
          next();
          return;
        }
        const hasRole = roles.some(role => req.character!.gameplayRoles?.includes(role));

        if (!hasRole) {
          logSecurity('insufficient_gameplay_role', {
            characterId: req.character.characterId,
            characterName: req.character.characterName,
            requiredRoles: roles,
            characterRoles: req.character.gameplayRoles,
            ipAddress: req.ip
          });

          const response: ApiResponse = {
            result: false,
            error: 'Permessi di gioco insufficienti',
            code: 'INSUFFICIENT_GAMEPLAY_ROLE',
            timestamp: new Date().toISOString()
          };
          return res.status(403).json(response);
        }

        next();
      } catch (error: unknown) {
        logger.error('Gameplay role middleware error:', error);
        const response: ApiResponse = {
          result: false,
          error: 'Errore di autenticazione di gioco',
          code: 'GAMEPLAY_AUTH_ERROR',
          timestamp: new Date().toISOString()
        };
        return res.status(500).json(response);
      }
    };
  }

  /**
   * Helper method to set auth cookie
   */
  static setAuthCookie(res: Response, token: string, rememberMe = false): void {
    const maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    res.cookie('auth_token', token, { ...appConfig.cookie, maxAge });
  }

  /**
   * Helper method to set character context cookie
   */
  static setCharacterCookie(res: Response, token: string): void {
    res.cookie('character_context', token, {
      ...appConfig.cookie,
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  /**
   * Helper method to clear authentication cookies
   */
  static clearAuthCookies(res: Response): void {
    const clearOpts = { ...appConfig.cookie, maxAge: 0, expires: new Date(0) };
    res.clearCookie('auth_token', clearOpts);
    res.clearCookie('character_context', clearOpts);
  }
}