import { Request, Response, NextFunction } from 'express';
import { ConfigurationService } from '@shared/services/ConfigurationService';
import { redis } from '@config/runtime/redis';
import { logger } from '@shared/utils/logger';

/**
 * Maintenance Mode Middleware
 *
 * Blocks all requests when system_maintenance_mode.enabled = true
 * Except for:
 * - Admin users (in allowedUsers list)
 * - Health check endpoints
 * - Admin panel endpoints (to allow disabling maintenance)
 */
export async function maintenanceModeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Skip check for health endpoints and admin routes
    if (
      req.path === '/health' ||
      req.path === '/api/health' ||
      req.path.startsWith('/admin')
    ) {
      next();
      return;
    }

    // Check maintenance mode status
    const configService = new ConfigurationService(redis.getClient() as any, logger);
    const maintenanceMode = await configService.getConfig('system_maintenance_mode');

    // If maintenance mode is not enabled, proceed normally
    if (!maintenanceMode || !maintenanceMode.enabled) {
      next();
      return;
    }

    // Check if user is in allowed list
    const userId = req.user?.userId || req.user?.id;
    const allowedUsers = maintenanceMode.allowedUsers || [];

    if (userId && allowedUsers.includes(userId)) {
      // User is allowed during maintenance
      next();
      return;
    }

    // Block request with maintenance message
    res.status(503).json({
      success: false,
      error: {
        code: 'SYSTEM_MAINTENANCE',
        message: maintenanceMode.message || 'Il sistema è in manutenzione. Riprova più tardi.',
        estimatedCompletion: maintenanceMode.estimatedCompletion || null,
      },
    });
  } catch (error) {
    // On error, allow request to proceed (fail-open for availability)
    logger.error('Maintenance mode check failed', {
      error: error instanceof Error ? error.message : String(error),
      path: req.path,
    });
    next();
  }
}
