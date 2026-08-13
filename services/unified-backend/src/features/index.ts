/**
 * Registro di tutte le feature: un array di import statici, niente
 * caricamento dinamico né scanning del filesystem (§3.4/§7 invariante 6
 * di docs/refactor/FEATURE-MODULES-PLAN.md).
 */
import type { FeatureManifest } from '@core/features/types';
import { bibliotecario } from './bibliotecario/manifest';

export const FEATURES: readonly FeatureManifest[] = [bibliotecario];
