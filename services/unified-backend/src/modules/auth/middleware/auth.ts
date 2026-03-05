import { Request, Response, NextFunction } from 'express';
import { CryptoUtils } from '../utils/crypto';
import { RequestUser, CharacterContextPayload, ApiResponse } from '@shared/types';
import { logger, logAuth, logSecurity } from '../utils/logger';
import { CharacterSessionManager } from '../utils/characterSessionManager';
import { User } from '@database/models';

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
              error: 'Authentication required',
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
        } catch (error: any) {
          // Clear invalid token
          res.clearCookie('auth_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            domain: process.env.NODE_ENV === 'production' ? '.tenpennynovels.com' : 'localhost',
            path: '/'
          });

          if (required) {
            logSecurity('invalid_token_access', {
              error: error instanceof Error ? error.message : 'Unknown error',
              ipAddress: req.ip,
              userAgent: req.get('User-Agent')
            });

            const response: ApiResponse = {
              result: false,
              error: 'Invalid or expired session',
              code: 'INVALID_SESSION',
              timestamp: new Date().toISOString()
            };
            return res.status(401).json(response);
          }

          next();
        }
      } catch (error: any) {
        logger.error('Auth middleware error:', error);
        const response: ApiResponse = {
          result: false,
          error: 'Authentication error',
          code: 'AUTH_ERROR',
          timestamp: new Date().toISOString()
        };
        return res.status(500).json(response);
      }
    };
  }

  /**
   * Middleware to verify character_context cookie and set req.character
   */
  static authenticateCharacter(required = true) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const characterToken = req.cookies?.character_context;

        if (!characterToken) {
          if (required) {
            const response: ApiResponse = {
              result: false,
              error: 'Character selection required',
              code: 'CHARACTER_REQUIRED',
              timestamp: new Date().toISOString()
            };
            return res.status(400).json(response);
          }
          return next();
        }

        try {
          const decoded = CryptoUtils.verifyCharacterContextToken(characterToken);
          
          // Verify that character belongs to authenticated user
          if (req.user && decoded.userId !== req.user.userId) {
            logSecurity('character_token_mismatch', {
              tokenUserId: decoded.userId,
              authenticatedUserId: req.user.userId,
              ipAddress: req.ip
            });

            res.clearCookie('character_context', {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
              domain: process.env.NODE_ENV === 'production' ? '.tenpennynovels.com' : 'localhost',
              path: '/'
            });

            const response: ApiResponse = {
              result: false,
              error: 'Character token mismatch',
              code: 'CHARACTER_TOKEN_MISMATCH',
              timestamp: new Date().toISOString()
            };
            return res.status(400).json(response);
          }

          // Validate character session uniqueness
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

            res.clearCookie('character_context', {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
              domain: process.env.NODE_ENV === 'production' ? '.tenpennynovels.com' : 'localhost',
              path: '/'
            });

            if (required) {
              const response: ApiResponse = {
                result: false,
                error: 'Character session is no longer valid. Another device may have logged in with this character.',
                code: 'CHARACTER_SESSION_INVALID',
                timestamp: new Date().toISOString()
              };
              return res.status(401).json(response);
            }

            return next();
          }

          req.character = decoded;
          next();
        } catch (error: any) {
          // Clear invalid character token
          res.clearCookie('character_context', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            domain: process.env.NODE_ENV === 'production' ? '.tenpennynovels.com' : 'localhost',
            path: '/'
          });

          if (required) {
            const response: ApiResponse = {
              result: false,
              error: 'Invalid or expired character session',
              code: 'INVALID_CHARACTER_SESSION',
              timestamp: new Date().toISOString()
            };
            return res.status(400).json(response);
          }

          next();
        }
      } catch (error: any) {
        logger.error('Character auth middleware error:', error);
        const response: ApiResponse = {
          result: false,
          error: 'Character authentication error',
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
            error: 'Authentication required',
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
            error: 'Admin privileges required',
            code: 'ADMIN_REQUIRED',
            timestamp: new Date().toISOString()
          };
          return res.status(403).json(response);
        }

        // Check specific permissions if provided (effective = gameplayRoles + adminPermissions + isGestore)
        if (permissions.length > 0) {
          const { hasAdminPermission } = await import('@config/admin-permissions');
          const gameplayRoles = req.user.gameplayRoles ?? [];
          const adminPermissions = req.user.adminPermissions ?? [];
          const isGestore = req.user.isGestore ?? false;
          const hasPermission = permissions.every((p) =>
            hasAdminPermission(gameplayRoles, adminPermissions, isGestore, p as any)
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
              error: 'Insufficient admin permissions',
              code: 'INSUFFICIENT_PERMISSIONS',
              timestamp: new Date().toISOString()
            };
            return res.status(403).json(response);
          }
        }

        next();
      } catch (error: any) {
        logger.error('Admin auth middleware error:', error);
        const response: ApiResponse = {
          result: false,
          error: 'Admin authentication error',
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
            error: 'Character selection required',
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
            error: 'Insufficient gameplay permissions',
            code: 'INSUFFICIENT_GAMEPLAY_ROLE',
            timestamp: new Date().toISOString()
          };
          return res.status(403).json(response);
        }

        next();
      } catch (error: any) {
        logger.error('Gameplay role middleware error:', error);
        const response: ApiResponse = {
          result: false,
          error: 'Gameplay authentication error',
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
    const maxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 7 days or 24 hours

    const cookieOptions: any = {
      httpOnly: true,
      path: '/',
      maxAge
    };

    // Production settings
    if (process.env.NODE_ENV === 'production') {
      cookieOptions.secure = true;
      cookieOptions.sameSite = 'strict';
      cookieOptions.domain = '.tenpennynovels.com';
    } else {
      // Development: Allow cross-port cookie sharing on localhost
      // Using secure:false for HTTP (http://localhost:XXXX)
      // Using sameSite:lax to allow cookies between localhost:4000, localhost:4001, etc.
      cookieOptions.secure = false;
      cookieOptions.sameSite = 'lax';
      cookieOptions.domain = 'localhost';
    }

    res.cookie('auth_token', token, cookieOptions);
  }

  /**
   * Helper method to set character context cookie
   */
  static setCharacterCookie(res: Response, token: string): void {
    const cookieOptions: any = {
      httpOnly: true,
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    };

    // Production settings
    if (process.env.NODE_ENV === 'production') {
      cookieOptions.secure = true;
      cookieOptions.sameSite = 'strict';
      cookieOptions.domain = '.tenpennynovels.com';
    } else {
      // Development: Allow cross-port cookie sharing on localhost
      // Using secure:false for HTTP (http://localhost:XXXX)
      // Using sameSite:lax to allow cookies between localhost:4000, localhost:4001, etc.
      cookieOptions.secure = false;
      cookieOptions.sameSite = 'lax';
      cookieOptions.domain = 'localhost';
    }

    res.cookie('character_context', token, cookieOptions);
  }

  /**
   * Helper method to clear authentication cookies
   */
  static clearAuthCookies(res: Response): void {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
      domain: process.env.NODE_ENV === 'production' ? '.tenpennynovels.com' : 'localhost',
      path: '/',
      maxAge: 0,
      expires: new Date(0)
    };

    res.clearCookie('auth_token', cookieOptions);
    res.clearCookie('character_context', cookieOptions);
  }
}