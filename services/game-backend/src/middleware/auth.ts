import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthUser, CharacterContext, ApiResponse } from '../types/game';
import { logger } from '../utils/logger';

// Helper function to get JWT_SECRET with validation
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      character?: CharacterContext;
    }
  }
}

export class AuthMiddleware {
  /**
   * Middleware: Read and validate auth_token cookie
   * Extracts: userId, username, adminInfo
   */
  static requireUserAuth(req: Request, res: Response, next: NextFunction): void {
    try {
      const authToken = req.cookies?.auth_token;
      
      if (!authToken) {
        const response: ApiResponse = {
          success: false,
          error: 'Authentication required',
          code: 'NO_AUTH_TOKEN',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
        return;
      }

      // Verify JWT token
      const jwtSecret = getJwtSecret();
      const decoded = jwt.verify(authToken, jwtSecret) as any;
      
      if (!decoded.userId || !decoded.username) {
        throw new Error('Invalid token payload');
      }

      // Attach user info to request
      req.user = {
        userId: decoded.userId,
        username: decoded.username,
        email: decoded.email,
        canAccessAdminPanel: decoded.canAccessAdminPanel || false,
        // New granular permission system
        userRoles: decoded.userRoles || ['user'],
        characterRoles: decoded.characterRoles || ['personaggio'],
        characterPermissions: decoded.characterPermissions || [],
        // No more legacy fields
      };

      next();

    } catch (error: any) {
      logger.warn('Auth token validation failed:', { error: error.message, ip: req.ip });
      
      const response: ApiResponse = {
        success: false,
        error: 'Invalid authentication token',
        code: 'INVALID_AUTH_TOKEN',
        timestamp: new Date().toISOString()
      };
      
      res.status(401).json(response);
    }
  }

  /**
   * Middleware: Read and validate character_context cookie
   * Requires: Valid auth_token (must be called after requireUserAuth)
   */
  static requireCharacterContext(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!req.user) {
        throw new Error('User authentication required before character context');
      }

      const characterToken = req.cookies?.character_context;
      
      if (!characterToken) {
        const response: ApiResponse = {
          success: false,
          error: 'Character selection required',
          code: 'NO_CHARACTER_CONTEXT',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Verify character context token
      const decoded = jwt.verify(characterToken, getJwtSecret()) as any;
      
      if (!decoded.characterId || !decoded.userId) {
        throw new Error('Invalid character context token');
      }

      // Verify that character belongs to authenticated user
      if (decoded.userId !== req.user.userId) {
        throw new Error('Character context does not match authenticated user');
      }

      // Attach character context to request
      req.character = {
        characterId: decoded.characterId,
        characterName: decoded.characterName,
        userId: decoded.userId,
        gameplayRoles: decoded.gameplayRoles || ['personaggio']
      };

      next();

    } catch (error: any) {
      logger.warn('Character context validation failed:', { 
        error: error.message, 
        userId: req.user?.userId,
        ip: req.ip 
      });
      
      const response: ApiResponse = {
        success: false,
        error: 'Invalid character context',
        code: 'INVALID_CHARACTER_CONTEXT',
        timestamp: new Date().toISOString()
      };
      
      res.status(401).json(response);
    }
  }

  /**
   * Combined middleware: Requires both auth_token and character_context
   * Plus character must be APPROVED status
   */
  static requireCharacterAuth(req: Request, res: Response, next: NextFunction): void {
    // Chain the middlewares
    AuthMiddleware.requireUserAuth(req, res, (err?: any) => {
      if (err) return;
      
      AuthMiddleware.requireCharacterContext(req, res, async (err?: any) => {
        if (err) return;
        
        try {
          // Import here to avoid circular dependency
          const { Character } = await import('../../../../packages/database/models');
          
          // Verify character exists and is not deleted
          const character = await Character.findOne({
            _id: req.character!.characterId,
            userId: req.user!.userId,
            status: { $ne: 'DELETED' } // Allow all statuses except DELETED
          });

          if (!character) {
            const response: ApiResponse = {
              success: false,
              error: 'Character not found or deleted',
              code: 'CHARACTER_NOT_FOUND',
              timestamp: new Date().toISOString()
            };
            res.status(403).json(response);
            return;
          }

          next();

        } catch (error: any) {
          logger.error('Character approval check failed:', error);
          
          const response: ApiResponse = {
            success: false,
            error: 'Character verification failed',
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
        success: false,
        error: 'Authentication required',
        code: 'NO_AUTH_TOKEN',
        timestamp: new Date().toISOString()
      };
      res.status(401).json(response);
      return;
    }

    if (!req.user.canAccessAdminPanel) {
      const response: ApiResponse = {
        success: false,
        error: 'Admin access required',
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
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user?.canAccessAdminPanel) {
        const response: ApiResponse = {
          success: false,
          error: 'Admin access required',
          code: 'ADMIN_ACCESS_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      const missingPermissions = permissions.filter(perm => {
        // Check new granular system first
        if (req.user?.userRoles?.includes('gestore')) return false;
        if (req.user?.characterPermissions?.includes(perm)) return false;
        
        // No fallback - return true if permission not found in granular system
        return true;
      });

      if (missingPermissions.length > 0) {
        const response: ApiResponse = {
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          details: { missingPermissions },
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      next();
    };
  }

  /**
   * Utility: Check if character has specific gameplay role
   */
  static hasGameplayRole(req: Request, role: string): boolean {
    return req.character?.gameplayRoles?.includes(role) || false;
  }

  /**
   * Middleware factory: Requires specific gameplay roles
   * Must be called after requireCharacterAuth
   */
  static requireGameplayRoles(roles: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.character) {
        const response: ApiResponse = {
          success: false,
          error: 'Character context required',
          code: 'NO_CHARACTER_CONTEXT',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const hasRequiredRole = roles.some(role => 
        req.character!.gameplayRoles.includes(role)
      );

      if (!hasRequiredRole) {
        const response: ApiResponse = {
          success: false,
          error: 'Insufficient gameplay permissions',
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
      console.log('🔍 [OPTIONAL AUTH] Cookies:', Object.keys(req.cookies || {}));
      console.log('🔍 [OPTIONAL AUTH] auth_token present:', !!authToken);
      
      if (authToken) {
        const decoded = jwt.verify(authToken, getJwtSecret()) as any;
        
        if (decoded.userId && decoded.username) {
          req.user = {
            userId: decoded.userId,
            username: decoded.username,
            email: decoded.email,
            canAccessAdminPanel: decoded.canAccessAdminPanel || false,
            // New granular permission system
            userRoles: decoded.userRoles || ['user'],
            characterRoles: decoded.characterRoles || ['personaggio'],
            characterPermissions: decoded.characterPermissions || []
          };
        }
      }

      next();

    } catch (error: any) {
      // For optional auth, we just continue without setting user
      next();
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
}