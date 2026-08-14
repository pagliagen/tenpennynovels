/**
 * Registro di tutte le feature: un array di import statici, niente
 * caricamento dinamico né scanning del filesystem (§3.4/§7 invariante 6
 * di docs/refactor/FEATURE-MODULES-PLAN.md).
 */
import type { FeatureManifest } from '@core/features/types';
import { bibliotecario } from './bibliotecario/manifest';
import { corporazioni } from './corporazioni/manifest';
import { tickets } from './tickets/manifest';
import { occupazioni } from './occupazioni/manifest';
import { economia } from './economia/manifest';
import { oggetti } from './oggetti/manifest';
import { documenti } from './documenti/manifest';
import { forum } from './forum/manifest';

export const FEATURES: readonly FeatureManifest[] = [bibliotecario, corporazioni, tickets, occupazioni, economia, oggetti, documenti, forum];
