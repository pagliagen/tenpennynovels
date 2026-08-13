/**
 * Tipi del manifest di una feature (§3.4 di docs/refactor/FEATURE-MODULES-PLAN.md).
 *
 * Rispetto allo schizzo originale del piano, questa prima versione OMETTE
 * `permissions`, `eventHandlers` e `jobs`. Verificato sul codice reale:
 * il sistema permessi (config/permissions/{admin,game}.ts) e EventRouter
 * (modules/game/events/EventRouter.ts) sono entrambi statici — enum e
 * mappe hardcoded nel costruttore, non registri popolabili dall'esterno.
 * Farli diventare registry-driven è un refactor a sé, non uno scaffolding
 * a costo zero: va fatto quando una feature reale lo richiede davvero,
 * guardando il codice che va toccato, non indovinato ora.
 *
 * La Fase 4 (corporazioni) — che aveva un canale Redis dedicato,
 * 'corporation:events' — è stata verificata come NON quel caso: il canale
 * è sottoscritto e instradato ma mai pubblicato da nessuno in tutto il
 * repo, infrastruttura morta. Costruire eventHandlers ora avrebbe
 * significato rendere EventRouter registry-driven per collegare un
 * canale che nessuno usa. Resta un TODO per la prossima feature che
 * pubblica e sottoscrive eventi Redis reali.
 */

import type { Router } from 'express';
import type { ExtensionRegistrar } from '../extensions/registry';

export type FeatureKey = string;

export interface FeatureRouteMount {
  /** Determina il prefisso: 'public' → '', 'game' → '/game', 'admin' → '/admin'. */
  scope: 'public' | 'game' | 'admin';
  /**
   * Path relativo allo scope. Dipende da come il router passato dichiara
   * le proprie route al suo interno: se le dichiara già col proprio
   * prefisso (es. router.get('/corporations', ...)), qui va '/'; se le
   * dichiara relative (es. router.get('/', ...), router.get('/stats', ...)),
   * qui va il prefisso stesso (es. '/corporations'). Verificato con un
   * router Express reale in Fase 4 (corporazioni), che usa entrambi i casi
   * sui suoi due scope.
   */
  path: string;
  router: Router;
  /** Se true (default) le route rispondono 404 quando la feature è spenta. */
  gated?: boolean;
}

export interface FeatureFlagSpec {
  /** configKey in SystemConfiguration, es. 'keeper_qa_enabled'. */
  configKey: string;
  section: 'ai_features' | 'system' | 'economy' | 'moderation';
  default: boolean;
  /** Etichetta mostrata nel gestionale. */
  label: string;
}

export interface FeatureManifest {
  key: FeatureKey;
  title: string;
  description?: string;
  /** Assente = feature sempre attiva, non disattivabile. */
  flag?: FeatureFlagSpec;
  /** Feature di cui questa importa l'api.ts. */
  dependsOn?: FeatureKey[];
  /** Ordine di registrazione degli hook/route. Default 100, più basso = prima. */
  priority?: number;

  routes?: FeatureRouteMount[];
  /** Registrazione sugli extension point del core. */
  extensions?: (registrar: ExtensionRegistrar) => void;
  /** Inizializzazione una-tantum al boot (warmup, non mounting: quello è sincrono e già fatto). */
  onBoot?: () => Promise<void>;
}
