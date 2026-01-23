import { Request, Response, NextFunction } from 'express';
import { banCheck } from './banCheck';

/**
 * Middleware that only applies ban check if user is authenticated
 * Useful for routes with optional authentication
 */
export function conditionalBanCheck(requiredScope: 'chat_banned' | 'game_banned' | 'forum_banned' | 'documents_banned' | 'full_site_banned') {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    
    // If no user is authenticated, skip ban check
    if (!userId) {
      return next();
    }
    
    // User is authenticated, apply ban check
    return banCheck({ requiredScope })(req, res, next);
  };
}