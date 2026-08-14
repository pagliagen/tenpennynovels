import type { FeatureKey, FeatureManifest } from './types';

/**
 * Popolato una sola volta da bootstrapFeatures() a partire dall'array
 * statico src/features/index.ts. Non si auto-popola: nessuna feature si
 * registra da sola come side-effect dell'import, per restare fedeli al
 * principio "registrazione a compile-time, un array, non uno scanning".
 */
export class FeatureRegistry {
  private readonly byKey = new Map<FeatureKey, FeatureManifest>();

  register(manifest: FeatureManifest): void {
    if (this.byKey.has(manifest.key)) {
      throw new Error(`Feature duplicata: "${manifest.key}" è già registrata`);
    }
    this.byKey.set(manifest.key, manifest);
  }

  getAll(): readonly FeatureManifest[] {
    return [...this.byKey.values()];
  }

  getByKey(key: FeatureKey): FeatureManifest | undefined {
    return this.byKey.get(key);
  }
}

export const featureRegistry = new FeatureRegistry();
