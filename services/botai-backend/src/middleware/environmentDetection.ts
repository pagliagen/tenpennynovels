import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

type Environment = 'production' | 'development';
type DetectionMethod = 'header' | 'ip' | 'default';

export interface EnvironmentInfo {
  environment: Environment;
  detectionMethod: DetectionMethod;
  detectedFrom?: string;
}

// Extend Express Request type to include environmentInfo
declare global {
  namespace Express {
    interface Request {
      environmentInfo?: EnvironmentInfo;
    }
  }
}

/**
 * Detect environment from HTTP request
 *
 * Detection priority:
 * 1. X-Environment header (primary - set by game-backend)
 * 2. IP whitelist (fallback - for OVH server)
 * 3. Default to development (safe fallback)
 *
 * @param req - Express request object
 * @returns EnvironmentInfo with detected environment and method
 */
export function detectEnvironment(req: Request): EnvironmentInfo {
  // Priority 1: Check X-Environment header
  const envHeader = req.headers['x-environment'] as string | undefined;

  if (envHeader) {
    const normalizedHeader = envHeader.toLowerCase().trim();

    if (normalizedHeader === 'production') {
      return {
        environment: 'production',
        detectionMethod: 'header',
        detectedFrom: envHeader
      };
    }

    if (normalizedHeader === 'development') {
      return {
        environment: 'development',
        detectionMethod: 'header',
        detectedFrom: envHeader
      };
    }

    // Invalid header value, log warning and continue to fallback
    logger.warn(`[EnvDetection] Invalid X-Environment header value: '${envHeader}', using fallback detection`);
  }

  // Priority 2: Check IP whitelist
  const productionIPs = (process.env.PRODUCTION_IP_WHITELIST || '').split(',')
    .map(ip => ip.trim())
    .filter(ip => ip.length > 0);

  if (productionIPs.length > 0) {
    const clientIP = req.ip || req.socket.remoteAddress || '';

    // Check if client IP matches any production IP
    const isProductionIP = productionIPs.some(prodIP => {
      // Support both exact match and subnet prefix match
      return clientIP.includes(prodIP) || clientIP.startsWith(prodIP);
    });

    if (isProductionIP) {
      return {
        environment: 'production',
        detectionMethod: 'ip',
        detectedFrom: clientIP
      };
    }
  }

  // Priority 3: Default to development (safe for testing)
  return {
    environment: 'development',
    detectionMethod: 'default',
    detectedFrom: 'fallback'
  };
}

/**
 * Environment Detection Middleware
 *
 * Detects the environment from the request and attaches it to req.environmentInfo
 * This should be registered before route handlers.
 *
 * Usage in app.ts:
 * ```
 * app.use(environmentDetectionMiddleware);
 * ```
 */
export function environmentDetectionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Detect environment from request
    const envInfo = detectEnvironment(req);

    // Attach to request object
    req.environmentInfo = envInfo;

    // Log detection for debugging
    logger.info('[EnvDetection]', {
      path: req.path,
      method: req.method,
      environment: envInfo.environment,
      detectionMethod: envInfo.detectionMethod,
      detectedFrom: envInfo.detectedFrom,
      clientIP: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']?.substring(0, 50) // truncate for logging
    });

    next();

  } catch (error) {
    logger.error('[EnvDetection] Error detecting environment:', error);

    // Fallback to development on error (safe default)
    req.environmentInfo = {
      environment: 'development',
      detectionMethod: 'default',
      detectedFrom: 'error-fallback'
    };

    next();
  }
}

/**
 * Get environment from request (helper for controllers/services)
 *
 * @param req - Express request object
 * @returns Environment ('production' or 'development')
 */
export function getEnvironmentFromRequest(req: Request): Environment {
  return req.environmentInfo?.environment || 'development';
}

/**
 * Middleware to require specific environment
 * Useful for protecting endpoints that should only work in specific environments
 *
 * Usage:
 * ```
 * router.post('/admin/reset-bots', requireEnvironment('development'), controller.resetBots);
 * ```
 */
export function requireEnvironment(requiredEnv: Environment) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const currentEnv = getEnvironmentFromRequest(req);

    if (currentEnv !== requiredEnv) {
      logger.warn(`[EnvDetection] Endpoint requires ${requiredEnv} but got ${currentEnv}`);
      res.status(403).json({
        success: false,
        error: `This endpoint is only available in ${requiredEnv} environment`,
        code: 'ENVIRONMENT_MISMATCH'
      });
      return;
    }

    next();
  };
}
