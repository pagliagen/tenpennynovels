import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { ApiResponse } from '../../../../packages/shared/types';
import { RateLimitConfig } from '../types/auth';
import { logger, logRate } from '../utils/logger';

export class RateLimitMiddleware {
  /**
   * Generic rate limiting middleware
   */
  static createRateLimit(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Skip rate limiting in development environment
        if (process.env.NODE_ENV === 'development') {
          return next();
        }
        const key = config.keyGenerator ? config.keyGenerator(req) : this.getDefaultKey(req);
        const windowKey = `ratelimit:${key}:${Math.floor(Date.now() / config.windowMs)}`;

        const currentCount = await redis.incrementRateLimit(windowKey, Math.ceil(config.windowMs / 1000));

        if (currentCount > config.maxRequests) {
          const timeUntilReset = config.windowMs - (Date.now() % config.windowMs);
          
          logRate('rate_limit_exceeded', key, {
            currentCount,
            maxRequests: config.maxRequests,
            windowMs: config.windowMs,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method
          });

          const response: ApiResponse = {
            success: false,
            error: 'Troppe richieste',
            code: 'RATE_LIMITED',
            details: {
              retryAfter: Math.ceil(timeUntilReset / 1000),
              limit: config.maxRequests,
              window: config.windowMs,
              current: currentCount
            },
            timestamp: new Date().toISOString()
          };

          res.set({
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': Math.max(0, config.maxRequests - currentCount).toString(),
            'X-RateLimit-Reset': new Date(Date.now() + timeUntilReset).toISOString(),
            'Retry-After': Math.ceil(timeUntilReset / 1000).toString()
          });

          return res.status(429).json(response);
        }

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, config.maxRequests - currentCount).toString(),
          'X-RateLimit-Reset': new Date(Date.now() + (config.windowMs - (Date.now() % config.windowMs))).toISOString()
        });

        next();
      } catch (error: any) {
        logger.error('Rate limit middleware error:', error);
        // On error, allow the request to proceed
        next();
      }
    };
  }

  /**
   * Registration rate limit - 5 requests per hour per IP
   */
  static registrationLimit() {
    return this.createRateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5,
      keyGenerator: (req: Request) => `registration:${req.ip}`
    });
  }

  /**
   * Login rate limit - 10 requests per minute per IP, 5 failed attempts per hour per email
   */
  static loginLimit() {
    return this.createRateLimit({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10,
      keyGenerator: (req: Request) => `login:${req.ip}`
    });
  }

  /**
   * Failed login attempts rate limit - per email/username
   */
  static failedLoginLimit() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const { username } = req.body;
      if (!username) return next();

      const key = `failed_login:${username.toLowerCase()}`;
      const windowMs = 10 * 60 * 1000; // 10 minutes
      const maxAttempts = 5;

      try {
        const currentCount = await redis.getRateLimit(key);

        if (currentCount >= maxAttempts) {
          logRate('login_attempts_exceeded', username, {
            currentCount,
            maxAttempts,
            ipAddress: req.ip
          });

          const response: ApiResponse = {
            success: false,
            error: 'Account temporarily locked due to too many failed login attempts',
            code: 'ACCOUNT_LOCKED',
            details: {
              lockedUntil: new Date(Date.now() + windowMs).toISOString(),
              canRecover: true,
              recoveryUrl: '/auth/forgot-password'
            },
            timestamp: new Date().toISOString()
          };

          return res.status(429).json(response);
        }

        // Store the key and username for later use in login failure
        req.rateLimitInfo = { key, windowMs, maxAttempts, currentCount };
        next();
      } catch (error: any) {
        logger.error('Failed login rate limit error:', error);
        next();
      }
    };
  }

  /**
   * Password reset rate limit - 3 requests per hour per identifier
   */
  static passwordResetLimit() {
    return this.createRateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
      keyGenerator: (req: Request) => `password_reset:${req.body.identifier?.toLowerCase() || req.ip}`
    });
  }

  /**
   * Email verification rate limit - 3 requests per hour per username/email
   */
  static emailVerificationLimit() {
    return this.createRateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
      keyGenerator: (req: Request) => `email_verification:${req.body.username?.toLowerCase() || req.body.email?.toLowerCase() || req.ip}`
    });
  }

  /**
   * Password reset token attempts - 5 attempts per token
   */
  static passwordResetTokenLimit() {
    return this.createRateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5,
      keyGenerator: (req: Request) => `password_reset_token:${req.params.token}`
    });
  }

  /**
   * API availability check rate limit - 20 requests per minute per IP
   */
  static availabilityCheckLimit() {
    return this.createRateLimit({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 20,
      keyGenerator: (req: Request) => `availability:${req.ip}`
    });
  }

  /**
   * Profile update rate limit - 10 requests per hour per user
   */
  static profileUpdateLimit() {
    return this.createRateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10,
      keyGenerator: (req: Request) => `profile_update:${req.user?.userId || req.ip}`
    });
  }

  /**
   * Security operations rate limit - 5 requests per minute per user
   */
  static securityOperationsLimit() {
    return this.createRateLimit({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5,
      keyGenerator: (req: Request) => `security:${req.user?.userId || req.ip}`
    });
  }

  /**
   * Generic API calls rate limit - 100 requests per minute per IP
   */
  static apiCallsLimit() {
    return this.createRateLimit({
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      keyGenerator: (req: Request) => `api_calls:${req.ip}`
    });
  }

  /**
   * Helper method to increment failed login attempts
   */
  static async recordFailedLogin(identifier: string): Promise<void> {
    try {
      const key = `failed_login:${identifier.toLowerCase()}`;
      const windowMs = 10 * 60 * 1000; // 10 minutes
      
      await redis.incrementRateLimit(key, Math.ceil(windowMs / 1000));
      
      logRate('failed_login_recorded', identifier, {
        key,
        windowMs
      });
    } catch (error: any) {
      logger.error('Error recording failed login:', error);
    }
  }

  /**
   * Helper method to clear failed login attempts on successful login
   */
  static async clearFailedLogins(identifier: string): Promise<void> {
    try {
      const key = `failed_login:${identifier.toLowerCase()}`;
      await redis.getClient().del(key);
      
      logRate('failed_login_cleared', identifier, {
        key
      });
    } catch (error: any) {
      logger.error('Error clearing failed logins:', error);
    }
  }

  /**
   * Default key generator for IP-based rate limiting
   */
  private static getDefaultKey(req: Request): string {
    return req.ip || 'unknown';
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      rateLimitInfo?: {
        key: string;
        windowMs: number;
        maxAttempts: number;
        currentCount: number;
      };
    }
  }
}