/**
 * Registro di tutte le feature: un array di import statici, niente
 * caricamento dinamico né scanning del filesystem (§3.4/§7 invariante 6
 * di docs/refactor/FEATURE-MODULES-PLAN.md).
 *
 * Vuoto in questa fase (Fase 1: solo lo scaffolding). La prima voce reale
 * arriva con la Fase 2 (bibliotecario).
 */
import type { FeatureManifest } from '@core/features/types';

export const FEATURES: readonly FeatureManifest[] = [];
