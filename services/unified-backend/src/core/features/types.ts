/**
 * Tipi del manifest di una feature (§3.4 di docs/refactor/FEATURE-MODULES-PLAN.md).
 *
 * Rispetto allo schizzo originale del piano, questa prima versione OMETTE
 * `permissions`, `eventHandlers` e `jobs`. Verificato sul codice reale:
 * il sistema permessi (config/permissions/{admin,game}.ts) e EventRouter
 * (modules/game/events/EventRouter.ts) sono entrambi statici — enum e
 * mappe hardcoded nel costruttore, non registri popolabili dall'esterno.
 * Farli diventare registry-driven è un refactor a sé, non uno scaffolding
 * a costo zero: va fatto quando una feature reale (Fase 4: corporazioni)
 * lo richiede, guardando il codice che va toccato, non indovinato ora.
 */

import type { Router } from 'express';
import type { ExtensionRegistrar } from '../extensions/registry';

export type FeatureKey = string;

export interface FeatureRouteMount {
  /** Determina il prefisso: 'public' → '', 'game' → '/game', 'admin' → '/admin'. */
  scope: 'public' | 'game' | 'admin';
  /** Path relativo allo scope, es. '/corporations'. */
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
