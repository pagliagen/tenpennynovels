import type { FeatureManifest } from '@core/features/types';
import adminRoutes from './routes/admin';
import aiRoutes from './routes/ai';

/**
 * Strumenti editoriali del gestionale che NON usano un modello: sempre attivi, anche in produzione.
 * Per ora la revisione di canone (`GET /admin/editorial/canon-check`): regole deterministiche in sola
 * lettura su documenti, sottotipi e location.
 *
 * Il flag d'ambiente vale solo per le funzioni con l'AI: vedi `editorialAi` sotto.
 *
 * dependsOn: ['documenti'] — i documenti pubblici da rivedere (`readDocumentsForReview`).
 */
export const editorial: FeatureManifest = {
  key: 'editorial',
  title: 'Editoriale',
  description: 'Revisione di canone su documenti, sottotipi e location (regole deterministiche)',
  dependsOn: ['documenti'],
  routes: [{ scope: 'admin', path: '/editorial', router: adminRoutes }],
};

/**
 * Funzioni editoriali che usano il modello (bozze di descrizioni, dicerie). Sono attive SOLO se
 * `ENABLE_IA_EDITORIAL=true` **e** il gateway AI (`core/ai`, `AI_GATEWAY_URL`) dichiara attivo e sano
 * il servizio `editorial`: la variabile dice «l'AI è abilitata», il gateway dice «c'è davvero». Con la
 * variabile spenta il gateway non viene nemmeno interrogato; con il gateway giù le route AI rispondono
 * 404, `GET /admin/system/feature-flags` dà `editorialAiEnabled: false` e il gestionale non mostra i
 * pulsanti AI. Non è commutabile dal gestionale: la variabile richiede un riavvio, il gateway no.
 * I suggerimenti non salvano mai da soli.
 *
 * Route: `/admin/editorial/ai/*` (suggerimenti di descrizione e tag per le location). Gated: 404 se la
 * feature non è attiva. Stesso schema di `fineSessione` / `fineSessioneAi`.
 */
export const editorialAi: FeatureManifest = {
  key: 'editorialAi',
  title: 'Editoriale con AI',
  description: 'Bozze di contenuti con il modello (solo ambienti con ENABLE_IA_EDITORIAL=true)',
  // Come `editorial`: l'ambientazione pubblica da cui ancorare le bozze. Il checker di confini legge un solo
  // dependsOn per directory (l'ultimo): vanno tenuti uguali.
  dependsOn: ['documenti'],
  flag: { source: 'env', envVar: 'ENABLE_IA_EDITORIAL', label: 'Editoriale con AI (ENABLE_IA_EDITORIAL)', requiresAiService: 'editorial' },
  routes: [{ scope: 'admin', path: '/editorial/ai', router: aiRoutes }],
};
