import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AdminUser, ApiResponse } from '../types/management';
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
      user?: AdminUser;
      fullUser?: any; // Full user document from database
    }
  }
}

export class AdminAuthMiddleware {
  /**
   * Middleware: Read and validate auth_token cookie for admin panel access
   * Extracts: userId, username, canAccessAdminPanel, userRoles, characterRoles, characterPermissions
   */
  static requireAdminAccess(req: Request, res: Response, next: NextFunction): void {
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
      const decoded = jwt.verify(authToken, getJwtSecret()) as any;
      
      if (!decoded.userId || !decoded.username) {
        throw new Error('Invalid token payload');
      }

      // Check if user can access admin panel
      if (!decoded.canAccessAdminPanel) {
        logger.warn('Admin access denied', { 
          userId: decoded.userId, 
          username: decoded.username,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        const response: ApiResponse = {
          success: false,
          error: 'Admin access required',
          code: 'ADMIN_ACCESS_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(403).json(response);
        return;
      }

      // Attach admin user info to request
      req.user = {
        id: decoded.userId,
        userId: decoded.userId,
        username: decoded.username,
        email: decoded.email,
        canAccessAdminPanel: decoded.canAccessAdminPanel,
        // Granular permission system
        userRoles: decoded.userRoles || [],
        characterRoles: decoded.characterRoles || [],
        characterPermissions: decoded.characterPermissions || []
      };

      logger.info('Admin access granted', {
        userId: decoded.userId,
        username: decoded.username,
        userRoles: decoded.userRoles,
        characterRoles: decoded.characterRoles,
        endpoint: req.originalUrl
      });

      next();

    } catch (error: any) {
      logger.warn('Admin auth token validation failed:', { 
        error: error instanceof Error ? error.message : String(error), 
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
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
   * Middleware factory: Requires specific permissions (uses new granular system)
   * Must be called after requireAdminAccess
   */
  static requirePermissions(permissions: string[]) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      try {
        // Fetch complete user from database
        const { User } = await import('../models/User');
        const fullUser = await User.findById(req.user.userId);
        
        if (!fullUser) {
          const response: ApiResponse = {
            success: false,
            error: 'User not found',
            code: 'USER_NOT_FOUND',
            timestamp: new Date().toISOString()
          };
          res.status(404).json(response);
          return;
        }

        const missingPermissions = permissions.filter(
          perm => !fullUser.hasViewPermission(perm)
        );

        if (missingPermissions.length > 0) {
          logger.warn('Insufficient permissions', {
            userId: req.user.userId,
            username: req.user.username,
            requiredPermissions: permissions,
            missingPermissions,
            userRoles: fullUser.userRoles,
            characterRoles: fullUser.characterRoles,
            endpoint: req.originalUrl
          });

          const response: ApiResponse = {
            success: false,
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            details: { 
              requiredPermissions: permissions,
              missingPermissions 
            },
            timestamp: new Date().toISOString()
          };
          res.status(403).json(response);
          return;
        }

        // Attach full user to request for downstream use
        req.fullUser = fullUser;
        next();

      } catch (error: any) {
        logger.error('Error checking permissions:', {
          error: error instanceof Error ? error.message : String(error),
          userId: req.user.userId,
          permissions
        });

        const response: ApiResponse = {
          success: false,
          error: 'Permission check failed',
          code: 'PERMISSION_CHECK_ERROR',
          timestamp: new Date().toISOString()
        };
        res.status(500).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED',
          timestamp: new Date().toISOString()
        };
        res.status(401).json(response);
        return;
      }

      try {
        // Fetch complete user from database to use hasViewPermission method
        const { User } = await import('../models/User');
        const fullUser = await User.findById(req.user.userId);
        
        if (!fullUser) {
          const response: ApiResponse = {
            success: false,
            error: 'User not found',
            code: 'USER_NOT_FOUND',
            timestamp: new Date().toISOString()
          };
          res.status(404).json(response);
          return;
        }

        if (!fullUser.hasViewPermission(permission)) {
          logger.warn('Insufficient granular permissions', {
            userId: req.user.userId,
            username: req.user.username,
            requiredPermission: permission,
            userRoles: fullUser.userRoles,
            characterRoles: fullUser.characterRoles,
            characterPermissions: fullUser.characterPermissions,
            endpoint: req.originalUrl
          });

          const response: ApiResponse = {
            success: false,
            error: `Insufficient permissions for ${permission}`,
            code: 'INSUFFICIENT_GRANULAR_PERMISSIONS',
            details: { 
              requiredPermission: permission,
              userRoles: fullUser.userRoles,
              characterRoles: fullUser.characterRoles
            },
            timestamp: new Date().toISOString()
          };
          res.status(403).json(response);
          return;
        }

        // Attach full user to request for downstream use
        req.fullUser = fullUser;
        next();

      } catch (error: any) {
        logger.error('Error checking granular permissions:', {
          error: error instanceof Error ? error.message : String(error),
          userId: req.user.userId,
          permission
        });

        const response: ApiResponse = {
          success: false,
          error: 'Permission check failed',
          code: 'PERMISSION_CHECK_ERROR',
          timestamp: new Date().toISOString()
        };
        res.status(500).json(response);
      }
    };
  }

  /**
   * Utility: Check if admin has specific permission (uses granular system)
   */
  static async hasPermission(req: Request, permission: string): Promise<boolean> {
    if (!req.user) return false;
    
    try {
      const { User } = await import('../models/User');
      const fullUser = await User.findById(req.user.userId);
      return fullUser ? fullUser.hasViewPermission(permission) : false;
    } catch {
      return false;
    }
  }

  /**
   * Utility: Check if admin has specific role
   */
  static hasRole(req: Request, role: string): boolean {
    if (!req.user) return false;
    
    if (role === 'gestore' && req.user.userRoles?.includes('gestore')) return true;
    return req.user.characterRoles?.includes(role) || false;
  }

  /**
   * Utility: Check if admin has any of the specified roles
   */
  static hasAnyRole(req: Request, roles: string[]): boolean {
    if (!req.user) return false;
    
    if (req.user.userRoles?.includes('gestore')) return true;
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

          const response: ApiResponse = {
            success: false,
            error: 'Too many sensitive operations. Please wait before trying again.',
            code: 'ADMIN_RATE_LIMITED',
            timestamp: new Date().toISOString()
          };
          res.status(429).json(response);
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
  static getAuditInfo(req: Request): { adminId: string; adminUsername: string; userRoles: string[]; characterRoles: string[]; ipAddress: string; userAgent: string } | null {
    if (!req.user) return null;
    
    return {
      adminId: req.user.userId,
      adminUsername: req.user.username,
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