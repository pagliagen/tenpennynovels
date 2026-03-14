import { Request, Response } from 'express';
import { ConfigurationService } from '@shared/services/ConfigurationService';
import { redis } from '@config/runtime/redis';
import { logger } from '../logger';
import { successResponse, errorResponse, getRequestId } from '../utils/apiResponse';

export class GameConfigController {
  /**
   * GET /game/config/combat
   *
   * Returns combat-related system configurations (bonus damage table, unarmed base damage).
   * Public endpoint — no authentication required.
   */
  static async getCombatConfig(req: Request, res: Response): Promise<void> {
    try {
      const configService = new ConfigurationService(redis.getClient(), logger);

      const [bonusTable, unarmedDamage] = await Promise.all([
        configService.getConfig('combat_damage_bonus_table'),
        configService.getConfig('combat_unarmed_base_damage'),
      ]);

      res.json(successResponse(
        {
          combat_damage_bonus_table: bonusTable,
          combat_unarmed_base_damage: unarmedDamage,
        },
        undefined,
        getRequestId(req),
      ));
    } catch (error: unknown) {
      logger.error('[GameConfigController] Failed to fetch combat config:', error);

      res.status(500).json(errorResponse(
        'Impossibile recuperare la configurazione di combattimento',
        'COMBAT_CONFIG_ERROR',
        undefined,
        500,
        getRequestId(req),
      ));
    }
  }
}
