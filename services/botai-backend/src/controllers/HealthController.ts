import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { db } from '../config/database';
import { claudeConfig } from '../config/claude';

export class HealthController {
  /**
   * GET /health
   * Health check endpoint
   */
  static async health(req: Request, res: Response): Promise<void> {
    try {
      const mongoStatus = db.getConnection().readyState === 1 ? 'connected' : 'disconnected';

      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'botai-backend',
        version: '1.0.0',
        uptime: process.uptime(),
        mongodb: mongoStatus
      };

      res.json(successResponse(health));
    } catch (error: any) {
      res.status(503).json(errorResponse(
        'Service unhealthy',
        'HEALTH_CHECK_FAILED',
        { error: error.message }
      ));
    }
  }

  /**
   * GET /health/ready
   * Readiness check - verifies all dependencies are ready
   */
  static async ready(req: Request, res: Response): Promise<void> {
    try {
      const mongoReady = db.getConnection().readyState === 1;

      if (!mongoReady) {
        res.status(503).json(errorResponse(
          'MongoDB not ready',
          'MONGODB_NOT_READY'
        ));
        return;
      }

      // Test Claude API connection (optional, can be slow)
      // const claudeReady = await claudeConfig.testConnection();

      res.json(successResponse({
        ready: true,
        timestamp: new Date().toISOString()
      }));

    } catch (error: any) {
      res.status(503).json(errorResponse(
        'Service not ready',
        'READINESS_CHECK_FAILED',
        { error: error.message }
      ));
    }
  }

  /**
   * GET /health/live
   * Liveness check - simple check if service is alive
   */
  static async live(req: Request, res: Response): Promise<void> {
    res.json(successResponse({
      alive: true,
      timestamp: new Date().toISOString()
    }));
  }
}
