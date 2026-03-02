import { Request, Response, NextFunction } from 'express';
import { User } from '@database/models/User';

export interface BanCheckOptions {
  requiredScope: 'chat_banned' | 'game_banned' | 'forum_banned' | 'documents_banned' | 'full_site_banned';
  message?: string;
}

/**
 * Middleware to check if user is banned from specific functionality
 * Usage: banCheck({ requiredScope: 'chat_banned' })
 */
export function banCheck(options: BanCheckOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // ===== TEST BYPASS (ONLY FOR LOCAL DEVELOPMENT) =====
      if (process.env.SKIP_AUTH_CHECK === 'true') {
        console.log('⚠️  [BAN CHECK BYPASS] Skipping ban check for testing');
        return next();
      }
      // ===== END TEST BYPASS =====

      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      // Get user ban information
      const user = await User.findById(userId).select('banScopes banReason bannedUntil bannedAt isBanned').lean();
      const userData = user as any;
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Check if user has any bans
      if (!userData.isBanned || !userData.banScopes || !Array.isArray(userData.banScopes)) {
        return next(); // User is not banned, continue
      }

      // Check for full site ban first
      if (userData.banScopes.includes('full_site_banned')) {
        return res.status(403).json({
          success: false,
          error: 'Il tuo account è stato bannato da tutta la piattaforma.',
          code: 'FULL_SITE_BAN_ACTIVE',
          banInfo: {
            reason: userData.banReason,
            bannedUntil: userData.bannedUntil,
            bannedAt: userData.bannedAt,
            scopes: userData.banScopes
          }
        });
      }

      // Check for specific scope ban
      if (userData.banScopes.includes(options.requiredScope)) {
        const scopeMessages = {
          'chat_banned': 'Non puoi inviare messaggi in chat. Sei stato bannato dalla chat.',
          'game_banned': 'Non puoi accedere al gioco. Sei stato bannato dal gameplay.',
          'forum_banned': 'Non puoi scrivere nel forum. Sei stato bannato dalle discussioni.',
          'documents_banned': 'Non puoi accedere ai documenti. Sei stato bannato dai documenti.',
          'full_site_banned': 'Il tuo account è stato bannato da tutta la piattaforma.'
        };

        return res.status(403).json({
          success: false,
          error: options.message || scopeMessages[options.requiredScope],
          code: `${options.requiredScope.toUpperCase()}_ACTIVE`,
          banInfo: {
            reason: userData.banReason,
            bannedUntil: userData.bannedUntil,
            bannedAt: userData.bannedAt,
            scopes: userData.banScopes,
            specificScope: options.requiredScope
          }
        });
      }

      // User is not banned for this specific scope, continue
      next();
      
    } catch (error) {
      console.error('Ban check middleware error:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error during ban check',
        code: 'BAN_CHECK_ERROR'
      });
    }
  };
}

/**
 * Quick helper functions for common ban checks
 */
export const banChecks = {
  chat: () => banCheck({ requiredScope: 'chat_banned' }),
  game: () => banCheck({ requiredScope: 'game_banned' }),
  forum: () => banCheck({ requiredScope: 'forum_banned' }),
  documents: () => banCheck({ requiredScope: 'documents_banned' }),
  fullSite: () => banCheck({ requiredScope: 'full_site_banned' })
};

/**
 * Check multiple ban scopes at once
 */
export function banCheckMultiple(scopes: BanCheckOptions['requiredScope'][]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      const user = await User.findById(userId).select('banScopes banReason bannedUntil bannedAt isBanned').lean();
      const userData = user as any;
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      if (!userData.isBanned || !userData.banScopes || !Array.isArray(userData.banScopes)) {
        return next();
      }

      // Check for full site ban first
      if (userData.banScopes.includes('full_site_banned')) {
        return res.status(403).json({
          success: false,
          error: 'Il tuo account è stato bannato da tutta la piattaforma.',
          code: 'FULL_SITE_BAN_ACTIVE',
          banInfo: {
            reason: userData.banReason,
            bannedUntil: userData.bannedUntil,
            bannedAt: userData.bannedAt,
            scopes: userData.banScopes
          }
        });
      }

      // Check if user has any of the specified scopes
      const bannedScopes = scopes.filter(scope => userData.banScopes.includes(scope));
      
      if (bannedScopes.length > 0) {
        return res.status(403).json({
          success: false,
          error: 'Non hai i permessi per eseguire questa azione a causa di restrizioni attive.',
          code: 'MULTIPLE_BANS_ACTIVE',
          banInfo: {
            reason: userData.banReason,
            bannedUntil: userData.bannedUntil,
            bannedAt: userData.bannedAt,
            scopes: userData.banScopes,
            conflictingScopes: bannedScopes
          }
        });
      }

      next();
      
    } catch (error) {
      console.error('Multiple ban check middleware error:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error during ban check',
        code: 'BAN_CHECK_ERROR'
      });
    }
  };
}