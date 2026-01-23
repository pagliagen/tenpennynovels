/**
 * Character Creation Configuration Controller
 *
 * Handles management API endpoints for character creation configuration.
 * Allows admins to view and modify character creation parameters stored in
 * /config/character-creation.json file.
 */

import { Request, Response } from 'express';
import { CharacterCreationConfigService } from '../../../shared/src/services/CharacterCreationConfigService';
import { ApiResponse } from '../types/management';
import { AdminAuthMiddleware } from '../middleware/adminAuth';
import { logger } from '../utils/logger';
import { successResponse, errorResponse, updateResponse, getRequestId } from '../utils/apiResponse';

export class CharacterCreationConfigController {
  /**
   * GET /admin/system/character-creation-config
   * Get current character creation configuration
   */
  static async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const configService = CharacterCreationConfigService.getInstance();
      const config = await configService.loadConfig();

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Admin viewed character creation config', auditInfo);

      res.json(successResponse(
        { config },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error fetching character creation config:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        query: req.query,
        params: req.params
      });

      res.status(500).json(errorResponse(
        'Impossibile recuperare la configurazione creazione personaggio',
        'FETCH_CHARACTER_CONFIG_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * PUT /admin/system/character-creation-config
   * Update character creation configuration
   */
  static async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const { config, reason } = req.body;

      // Validate required fields
      if (!config) {
        res.status(400).json(errorResponse(
          'Dati configurazione mancanti',
          'CONFIG_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      if (!reason || reason.trim().length === 0) {
        res.status(400).json(errorResponse(
          'Il motivo della modifica è richiesto',
          'REASON_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      // Get user info from auth middleware
      const userId = req.user?.userId || 'unknown';
      const username = req.user?.username || 'unknown';

      // Save configuration
      const configService = CharacterCreationConfigService.getInstance();
      await configService.saveConfig(config, username);

      // Audit log
      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.warn('Character creation config updated by admin', {
        ...auditInfo,
        reason,
        version: config._meta.version,
        category: 'character_creation_config'
      });

      res.json(updateResponse(
        {
          message: 'Configurazione creazione personaggio aggiornata con successo'
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error updating character creation config:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        body: req.body
      });

      res.status(500).json(errorResponse(
        `Impossibile aggiornare la configurazione: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
        'UPDATE_CHARACTER_CONFIG_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /admin/system/character-creation-config/invalidate-cache
   * Invalidate configuration cache
   */
  static async invalidateCache(req: Request, res: Response): Promise<void> {
    try {
      const configService = CharacterCreationConfigService.getInstance();
      configService.invalidateCache();

      const auditInfo = AdminAuthMiddleware.getAuditInfo(req);
      logger.info('Character creation config cache invalidated', {
        ...auditInfo,
        category: 'character_creation_config'
      });

      res.json(updateResponse(
        {
          message: 'Cache invalidata con successo'
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error invalidating character creation config cache:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json(errorResponse(
        'Impossibile invalidare la cache',
        'INVALIDATE_CACHE_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }

  /**
   * POST /admin/system/character-creation-config/validate
   * Validate configuration before saving
   */
  static async validateConfig(req: Request, res: Response): Promise<void> {
    try {
      const { config } = req.body;

      if (!config) {
        res.status(400).json(errorResponse(
          'Configurazione mancante',
          'CONFIG_REQUIRED',
          undefined,
          400,
          getRequestId(req)
        ));
        return;
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate stats
      if (config.stats) {
        // CRITICAL: gameplayCap must be >= creationCap
        if (config.stats.gameplayCap < config.stats.creationCap) {
          errors.push(`Cap gameplay stats (${config.stats.gameplayCap}) deve essere >= cap creazione (${config.stats.creationCap})`);
        }

        if (config.stats.totalPoints < 200 || config.stats.totalPoints > 600) {
          errors.push('Stat total points deve essere tra 200 e 600');
        }

        if (config.stats.creationCap < 70 || config.stats.creationCap > 99) {
          errors.push('Cap creazione stats deve essere tra 70 e 99');
        }

        if (config.stats.gameplayCap < 70 || config.stats.gameplayCap > 99) {
          errors.push('Cap gameplay stats deve essere tra 70 e 99');
        }
      }

      // Validate skills
      if (config.skills) {
        // CRITICAL: gameplayCap >= creationCapWithOccupation >= creationCap
        if (config.skills.gameplayCap < config.skills.creationCapWithOccupation) {
          errors.push(`Cap gameplay skills (${config.skills.gameplayCap}) deve essere >= cap creazione con occupazione (${config.skills.creationCapWithOccupation})`);
        }

        if (config.skills.creationCapWithOccupation < config.skills.creationCap) {
          errors.push(`Cap creazione con occupazione (${config.skills.creationCapWithOccupation}) deve essere >= cap creazione (${config.skills.creationCap})`);
        }

        if (config.skills.creationCap < 50 || config.skills.creationCap > 90) {
          errors.push('Skill creation cap deve essere tra 50 e 90');
        }

        if (config.skills.creationCapWithOccupation > config.skills.gameplayCap) {
          errors.push('Cap con occupazione non può superare il cap gameplay');
        }
      }

      // Validate occupation
      if (config.occupation) {
        if (config.occupation.requiredSkillMinimum < 20 || config.occupation.requiredSkillMinimum > 60) {
          errors.push('Required skill minimum deve essere tra 20 e 60');
        }

        if (config.occupation.bonusSkillPoints < 10 || config.occupation.bonusSkillPoints > 50) {
          warnings.push('Bonus skill points fuori dal range raccomandato (10-50)');
        }
      }

      // Validate social classes
      if (config.socialClasses && Array.isArray(config.socialClasses)) {
        if (config.socialClasses.length === 0) {
          errors.push('Social classes deve contenere almeno una classe');
        } else {
          // Check for gaps in finance skill ranges
          const sortedClasses = [...config.socialClasses].sort((a: any, b: any) =>
            a.financeSkillRange.min - b.financeSkillRange.min
          );

          for (let i = 1; i < sortedClasses.length; i++) {
            const prevMax = sortedClasses[i - 1].financeSkillRange.max;
            const currentMin = sortedClasses[i].financeSkillRange.min;

            if (currentMin !== prevMax + 1) {
              warnings.push(`Gap nei range di FINANZA tra ${sortedClasses[i - 1].name} e ${sortedClasses[i].name} (${prevMax} → ${currentMin})`);
            }
          }

          // Validate each social class
          config.socialClasses.forEach((sc: any, idx: number) => {
            if (!sc.id) errors.push(`socialClasses[${idx}]: ID mancante`);
            if (!sc.name) errors.push(`socialClasses[${idx}]: Nome mancante`);
            if (!sc.financeSkillRange) {
              errors.push(`socialClasses[${idx}]: Range FINANZA mancante`);
            } else {
              if (typeof sc.financeSkillRange.min !== 'number' || typeof sc.financeSkillRange.max !== 'number') {
                errors.push(`socialClasses[${idx}]: Range FINANZA invalido`);
              }
              if (sc.financeSkillRange.min > sc.financeSkillRange.max) {
                errors.push(`socialClasses[${idx}]: Range FINANZA invertito (min > max)`);
              }
            }
          });
        }
      }

      // Validate formulas
      if (config.formulas) {
        if (!config.formulas.derived || typeof config.formulas.derived !== 'object') {
          errors.push('Formule derivate mancanti o invalide');
        }

        if (!Array.isArray(config.formulas.damageBonus) || config.formulas.damageBonus.length === 0) {
          errors.push('Tabella bonus danno mancante o vuota');
        }
      }

      res.json(successResponse(
        {
          isValid: errors.length === 0,
          errors,
          warnings
        },
        undefined,
        getRequestId(req)
      ));
    } catch (error: any) {
      logger.error('Error validating character creation config:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json(errorResponse(
        'Errore nella validazione della configurazione',
        'VALIDATION_ERROR',
        undefined,
        500,
        getRequestId(req)
      ));
    }
  }
}
