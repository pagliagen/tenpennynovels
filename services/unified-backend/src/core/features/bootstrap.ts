/**
 * Punto di ingresso unico che monta ogni feature su `app`.
 *
 * Sincrona di proposito, non async: registrazione feature, mounting
 * route ed extension possono fallire per un bug di configurazione (es.
 * chiave duplicata in featureRegistry.register) e in quel caso DEVONO
 * far fallire l'avvio in modo rumoroso — un throw sincrono da app.ts
 * (CommonJS, niente top-level await) è la forma corretta per questo,
 * una Promise rifiutata e mai awaitata no (diventerebbe un
 * unhandledRejection silenzioso invece di un crash pulito al boot).
 *
 * Gli onBoot() delle feature sono l'unica parte genuinamente asincrona:
 * girano dopo, in background, avviati senza attendere il loro esito da
 * qui — ma è sicuro farlo senza await perché runOnBoot() intercetta già
 * ogni errore al suo interno e non fa mai risalire un rifiuto.
 */

import type { Application, RequestHandler } from 'express';
import { logger } from '@shared/utils/logger';
import { createGlobalRateLimiter } from '@shared/middleware/globalRateLimit';
import { featureRegistry } from './registry';
import { requireFeature } from './middleware/requireFeature';
import { extensions } from '../extensions/registry';
import type { FeatureManifest, FeatureRouteMount } from './types';

const SCOPE_PREFIX: Record<FeatureRouteMount['scope'], string> = {
  public: '',
  game: '/game',
  admin: '/admin',
};

// CodeQL (js/missing-rate-limiting) non riesce a tracciare il limiter
// applicato in app.ts fino a qui: le route delle feature sono registrate
// dinamicamente in un loop, in un file diverso, non con una chiamata
// diretta app.use() nello stesso punto testuale. Istanza separata (vedi
// createGlobalRateLimiter) applicata direttamente qui, dove ogni router di
// feature viene effettivamente montato — un solo punto per l'intera
// superficie coperta da bootstrapFeatures().
const featureRouteLimiter = createGlobalRateLimiter();

function mountRoutes(app: Application, manifest: FeatureManifest): void {
  for (const mount of manifest.routes ?? []) {
    const fullPath = `${SCOPE_PREFIX[mount.scope]}${mount.path}`;
    const handlers: RequestHandler[] = mount.gated === false
      ? [featureRouteLimiter, mount.router]
      : [featureRouteLimiter, requireFeature(manifest.key), mount.router];
    app.use(fullPath, ...handlers);
  }
}

function registerExtensions(manifest: FeatureManifest): void {
  manifest.extensions?.(extensions.createRegistrar(manifest.key));
}

async function runOnBoot(manifest: FeatureManifest): Promise<void> {
  if (!manifest.onBoot) return;
  try {
    await manifest.onBoot();
  } catch (error) {
    logger.error('[bootstrapFeatures] onBoot fallito, la feature resta montata', { feature: manifest.key, error });
  }
}

/** Non propaga mai un errore: ogni onBoot() è già isolato da runOnBoot(). Sicuro da chiamare senza await/catch. */
async function bootFeatures(manifests: readonly FeatureManifest[]): Promise<void> {
  for (const manifest of manifests) {
    await runOnBoot(manifest);
  }
}

/**
 * Registra ogni feature, monta le sue route ed extension. Sincrona: un
 * errore qui (es. chiave duplicata) propaga come throw normale al
 * chiamante, che a boot-time deve fermare l'avvio.
 */
export function bootstrapFeatures(app: Application, manifests: readonly FeatureManifest[]): void {
  const ordered = [...manifests].sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  for (const manifest of ordered) {
    featureRegistry.register(manifest);
    mountRoutes(app, manifest);
    registerExtensions(manifest);
  }

  if (ordered.length > 0) {
    logger.info(`[bootstrapFeatures] ${ordered.length} feature registrate`, { features: ordered.map((m) => m.key) });
  }

  void bootFeatures(ordered);
}
