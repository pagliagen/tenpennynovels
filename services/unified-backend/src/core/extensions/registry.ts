/**
 * Registro degli extension point (§3.6 di docs/refactor/FEATURE-MODULES-PLAN.md).
 *
 * Vincoli non negoziabili implementati qui:
 * - emit() non propaga MAI un errore al chiamante: try/catch per singolo
 *   handler, log con feature+point, il flusso del core prosegue comunque.
 * - Ordine deterministico: priority crescente, a parità feature key
 *   alfabetica. Mai l'ordine di registrazione.
 * - Il controllo del feature flag avviene qui dentro, non nel codice
 *   della feature che registra l'handler.
 * - Gli hook sono awaitati in sequenza, non in parallelo: alcuni hanno
 *   effetti su stato condiviso (es. il round bot) e la concorrenza
 *   introdurrebbe race condition.
 */

import { logger } from '@shared/utils/logger';
import type { FeatureKey } from '../features/types';
import { FeatureFlagService } from '../features/flags';
import type { HookMap, FilterMap } from './points';

type HookHandler<K extends keyof HookMap> = (ctx: HookMap[K]) => Promise<void>;
type FilterHandler<K extends keyof FilterMap> = (
  value: FilterMap[K]['value'],
  ctx: FilterMap[K]['ctx']
) => Promise<FilterMap[K]['value']>;

interface RegisteredHandler<TFn> {
  feature: FeatureKey;
  priority: number;
  handler: TFn;
}

const DEFAULT_PRIORITY = 100;

function sortDeterministic<T extends { priority: number; feature: FeatureKey }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.priority - b.priority || a.feature.localeCompare(b.feature));
}

/**
 * Vista scoped su ExtensionRegistry, legata a una feature: hook()/filter()
 * non richiedono di ripetere la propria feature key a ogni chiamata, e una
 * feature non può registrarsi sotto la key di un'altra per errore.
 */
export interface ExtensionRegistrar {
  hook<K extends keyof HookMap>(point: K, handler: HookHandler<K>, priority?: number): void;
  filter<K extends keyof FilterMap>(point: K, handler: FilterHandler<K>, priority?: number): void;
}

export class ExtensionRegistry {
  /**
   * Le due mappe sono heterogenee per costruzione: ogni value-array è
   * omogeneo nel proprio K reale, ma la mappa le conserva sotto un tipo
   * "eraso" (keyof HookMap/FilterMap generico) perché TypeScript non
   * lega staticamente la chiave di un Map a un generico diverso per
   * ogni entry. I cast qui sotto ripristinano il tipo esatto nel punto
   * in cui K torna noto (get/set con lo stesso K usato in register);
   * non è un uso di `any`, è il pattern standard per un registro
   * eterogeneo tipizzato per chiave. Passano da `unknown` (non da un
   * cast diretto): con HookMap/FilterMap popolati, TS non trova più
   * abbastanza overlap strutturale tra un K generico e una chiave
   * letterale concreta per accettare un cast diretto.
   */
  private readonly hooks = new Map<keyof HookMap, RegisteredHandler<HookHandler<keyof HookMap>>[]>();
  private readonly filters = new Map<keyof FilterMap, RegisteredHandler<FilterHandler<keyof FilterMap>>[]>();

  registerHook<K extends keyof HookMap>(feature: FeatureKey, point: K, handler: HookHandler<K>, priority = DEFAULT_PRIORITY): void {
    const list = (this.hooks.get(point) ?? []) as unknown as RegisteredHandler<HookHandler<K>>[];
    list.push({ feature, priority, handler });
    this.hooks.set(point, list as unknown as RegisteredHandler<HookHandler<keyof HookMap>>[]);
  }

  registerFilter<K extends keyof FilterMap>(feature: FeatureKey, point: K, handler: FilterHandler<K>, priority = DEFAULT_PRIORITY): void {
    const list = (this.filters.get(point) ?? []) as unknown as RegisteredHandler<FilterHandler<K>>[];
    list.push({ feature, priority, handler });
    this.filters.set(point, list as unknown as RegisteredHandler<FilterHandler<keyof FilterMap>>[]);
  }

  async emit<K extends keyof HookMap>(point: K, ctx: HookMap[K]): Promise<void> {
    const registered = (this.hooks.get(point) ?? []) as unknown as RegisteredHandler<HookHandler<K>>[];

    for (const { feature, handler } of sortDeterministic(registered)) {
      if (!(await FeatureFlagService.isEnabled(feature))) continue;
      try {
        await handler(ctx);
      } catch (error) {
        logger.error('[ExtensionRegistry] hook fallito, il flusso del core prosegue', { feature, point, error });
      }
    }
  }

  async apply<K extends keyof FilterMap>(point: K, value: FilterMap[K]['value'], ctx: FilterMap[K]['ctx']): Promise<FilterMap[K]['value']> {
    const registered = (this.filters.get(point) ?? []) as unknown as RegisteredHandler<FilterHandler<K>>[];

    let current = value;
    for (const { feature, handler } of sortDeterministic(registered)) {
      if (!(await FeatureFlagService.isEnabled(feature))) continue;
      try {
        current = await handler(current, ctx);
      } catch (error) {
        logger.error('[ExtensionRegistry] filter fallito, mantengo il valore precedente', { feature, point, error });
      }
    }
    return current;
  }

  /** Usato da bootstrapFeatures per costruire il registrar scoped di ogni manifest. */
  createRegistrar(feature: FeatureKey): ExtensionRegistrar {
    return {
      hook: (point, handler, priority) => this.registerHook(feature, point, handler, priority),
      filter: (point, handler, priority) => this.registerFilter(feature, point, handler, priority),
    };
  }
}

export const extensions = new ExtensionRegistry();
