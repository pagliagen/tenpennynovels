/**
 * Environment Controller
 *
 * Provides real-time weather and moon phase data to frontend.
 * All users receive identical centralized environment data.
 *
 * @module modules/game/controllers/EnvironmentController
 * @since 2.0.0
 */

import { Request, Response } from 'express';
import { getWeather } from '../services/WeatherService';
import { logger } from '../logger';
import { successResponse, errorResponse } from '@shared/utils/apiResponse';

export class EnvironmentController {
  /**
   * GET /game/environment
   *
   * Returns current weather and moon phase for London.
   * Data is cached for 30 minutes to ensure all users see the same environment.
   *
   * @param req - Express request
   * @param res - Express response
   *
   * @returns Environment data with weather condition, temperature, and moon phase
   *
   * @example
   * Response:
   * {
   *   result: true,
   *   data: {
   *     condition: 'fog',
   *     temperature: 5,
   *     moonPhase: 'waning_crescent',
   *     moonIllumination: 0.3,
   *     lastUpdated: '2026-02-25T08:00:00.000Z'
   *   }
   * }
   */
  static async getEnvironment(req: Request, res: Response): Promise<void> {
    try {
      const environment = await getWeather();

      logger.debug('[EnvironmentController] Environment data retrieved', {
        condition: environment.condition,
        temperature: environment.temperature,
        moonPhase: environment.moonPhase,
      });

      successResponse(res, environment);
    } catch (error: any) {
      logger.error('[EnvironmentController] Failed to fetch environment:', error);

      errorResponse(
        res,
        'Failed to fetch environment data',
        'WEATHER_ERROR',
        undefined,
        500
      );
    }
  }
}
