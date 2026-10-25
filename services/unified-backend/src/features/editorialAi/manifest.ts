import type { FeatureManifest } from '@core/features/types';
import adminRoutes from './routes/admin';

/**
 * Assistente editoriale AI nel gestionale (revisione di canone, bozze di descrizioni, dicerie).
 *
 * Esiste SOLO se l'ambiente la accende: `ENABLE_IA_EDITORIAL=true`. Senza (produzione, default) le
 * route rispondono 404 come se non ci fossero, `GET /admin/system/feature-flags` dice
 * `editorialAiEnabled: false` perché il gestionale non mostri né pulsanti né voci di menu, e il
 * worker rifiuta le richieste. La variabile non è commutabile dal gestionale: serve un riavvio.
 *
 * I suggerimenti non salvano mai da soli: riempiono un form o un rapporto, decide una persona.
 *
 * dependsOn: ['documenti'] — l'ambientazione pubblica da cui ancorare le bozze (`searchPublicLore`).
 */
export const editorialAi: FeatureManifest = {
  key: 'editorialAi',
  title: 'AI editoriale',
  description: 'Revisione di canone e bozze di contenuti per il gestionale (solo ambienti con ENABLE_IA_EDITORIAL=true)',
  dependsOn: ['documenti'],
  flag: { source: 'env', envVar: 'ENABLE_IA_EDITORIAL', label: 'AI editoriale (ENABLE_IA_EDITORIAL)' },
  routes: [{ scope: 'admin', path: '/editorial', router: adminRoutes }],
};
