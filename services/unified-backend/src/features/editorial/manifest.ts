import type { FeatureManifest } from '@core/features/types';
import adminRoutes from './routes/admin';

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
 * Funzioni editoriali che usano il modello (bozze di descrizioni, dicerie): esistono SOLO se
 * l'ambiente le accende con `ENABLE_IA_EDITORIAL=true`. Senza (produzione, default) le loro route
 * rispondono 404, `GET /admin/system/feature-flags` dà `editorialAiEnabled: false` e il gestionale
 * non mostra i pulsanti AI; il worker rifiuta le richieste. Non è commutabile dal gestionale: serve
 * un riavvio. I suggerimenti non salvano mai da soli.
 *
 * Nessuna route ancora: arrivano con le funzioni AI. Il manifest esiste già per tenere il flag nel
 * sistema feature (stesso schema di `fineSessione` / `fineSessioneAi`).
 */
export const editorialAi: FeatureManifest = {
  key: 'editorialAi',
  title: 'Editoriale con AI',
  description: 'Bozze di contenuti con il modello (solo ambienti con ENABLE_IA_EDITORIAL=true)',
  // Come `editorial`: l'ambientazione pubblica da cui ancorare le bozze. Il checker di confini legge un solo
  // dependsOn per directory (l'ultimo): vanno tenuti uguali.
  dependsOn: ['documenti'],
  flag: { source: 'env', envVar: 'ENABLE_IA_EDITORIAL', label: 'Editoriale con AI (ENABLE_IA_EDITORIAL)' },
};
