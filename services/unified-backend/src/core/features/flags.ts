/**
 * Stato acceso/spento di una feature, sopra ConfigurationService (cache
 * Redis + invalidazione via pub/sub già esistenti, vedi
 * shared/services/ConfigurationService.ts). Generalizza il pattern
 * ad-hoc già presente nel codebase (keeper_qa_enabled — vedi
 * modules/admin/controllers/SystemConfigController.ts).
 *
 * Fail-closed per costruzione: qualunque ambiguità (key sconosciuta,
 * valore mancante, errore Redis) risolve a "spenta". Una feature
 * disattivata per errore è un fastidio recuperabile; una attiva per
 * errore in produzione non lo è sempre.
 */

import { redis } from '@config/runtime/redis';
import { logger } from '@shared/utils/logger';
import { ConfigurationService } from '@shared/services/ConfigurationService';
import { featureRegistry } from './registry';
import { isEnvFlagActive } from './envFlag';
import { aiGateway } from '../ai';
import type { FeatureKey } from './types';

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export class FeatureFlagService {
  static async isEnabled(key: FeatureKey): Promise<boolean> {
    const manifest = featureRegistry.getByKey(key);
    if (!manifest) return false;
    if (!manifest.flag) return true;
    // Flag da ambiente: niente Redis né runtime config. Se dietro c'è un servizio AI, conta anche che il
    // gateway lo dichiari attivo (la sonda parte solo se la variabile è 'true').
    if (manifest.flag.source === 'env') return isEnvFlagActive(manifest.flag, (service) => aiGateway.isAvailable(service));

    try {
      const configService = new ConfigurationService(redis.getClient(), logger);
      const value = await configService.getConfig(manifest.flag.configKey);
      return toBoolean(value, manifest.flag.default);
    } catch (error) {
      logger.error('[FeatureFlagService] lettura flag fallita, feature considerata spenta', { key, error });
      return false;
    }
  }

  /** Mappa completa per il gestionale: sostituisce le liste hardcoded per-feature (es. SystemConfigController). */
  static async getAll(): Promise<Record<FeatureKey, boolean>> {
    const manifests = featureRegistry.getAll();
    const entries = await Promise.all(
      manifests.map(async (manifest): Promise<[FeatureKey, boolean]> => [manifest.key, await FeatureFlagService.isEnabled(manifest.key)])
    );
    return Object.fromEntries(entries);
  }
}
