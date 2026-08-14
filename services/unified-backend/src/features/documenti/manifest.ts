import type { FeatureManifest } from '@core/features/types';
import publicRoutes from './routes/public';
import adminDocumentsRoutes from './routes/admin-documents';
import adminSubtypesRoutes from './routes/admin-subtypes';

/**
 * Contenuti (ambientazione/regolamento), ricerca full-text/semantica,
 * gestione admin documenti+subtype. Niente flag: apps/documents (intera
 * frontend app) dipende interamente da questa feature, non è spegnibile
 * senza rompere un'intera app.
 *
 * dependsOn: nessuno. Nessun'altra feature già spostata viene importata da
 * qui. Il bibliotecario (features/bibliotecario) non importa nulla da
 * documenti nemmeno oggi: l'integrazione passa SOLO dagli extension point
 * 'documents.search.stream'/'documents.search.capabilities' (core/extensions/
 * registry.ts, mediati dal core) — mai un import diretto in nessuna delle
 * due direzioni. Vedi DocumentController.semanticSearch (emit/apply) e
 * features/bibliotecario/extensions/searchStream.ts (hook).
 *
 * Tre router interni distinti lato route (mai stati nello stesso file negli
 * originali):
 * - public.ts: da modules/documents/routes/index.ts, path relativi → mount
 *   {scope:'public', path:'/documents'}
 * - admin-documents.ts: da modules/admin/routes/documentRoutes.ts, path
 *   relativi → mount {scope:'admin', path:'/documents'}
 * - admin-subtypes.ts: da modules/admin/routes/subtypeRoutes.ts, path
 *   relativi, logica inline nei route handler (nessun controller separato
 *   esisteva già prima) → mount {scope:'admin', path:'/subtypes'}
 *
 * Bug preesistenti preservati esattamente (documentati nei file, confermati
 * con lettura diretta del codice in Fase 6.5), non corretti in questa fase:
 * - DocumentManagementController.deleteDocument imposta `deleted: true` su
 *   un campo che non esiste nello schema Document — Mongoose strict mode lo
 *   scarta silenziosamente, il bottone "elimina" del pannello admin non
 *   elimina/nasconde nulla. Deciso con l'utente: preservato, non collegato
 *   al softDeletePlugin.softDelete() già esistente e funzionante.
 * - Filtri no-op su `deleted`/`deletedAt` (due nomi diversi per un campo
 *   inesistente) in ~13 punti sparsi fra HierarchyService, DocumentController,
 *   DocumentManagementController, admin-subtypes.ts e SitemapService.ts —
 *   innocui (matchano sempre tutti i documenti), dead code vestigiale.
 * - Il model Mongoose DocumentChunk dichiara `collection: 'documentChunks'`
 *   (camelCase) ma tutto il codice applicativo reale accede via driver raw a
 *   `documentchunks` (minuscolo) — il model non viene mai istanziato/
 *   interrogato da nessuna parte del repo, è vestigiale.
 *
 * `api.ts` espone solo EmbeddingService — vedi commento lì.
 *
 * Consumer esterni con debito dichiarato (boundary-allow, import diretto del
 * model Document, mai wrapperizzato): services/SitemapService.ts (lettura
 * per il sitemap), scripts/backfill-document-lastupdated.ts (script one-shot,
 * non censito nella ricognizione iniziale — trovato dal type-check dopo lo
 * switch atomico).
 */
export const documenti: FeatureManifest = {
  key: 'documenti',
  title: 'Documenti',
  description: 'Contenuti ambientazione/regolamento, ricerca full-text/semantica, gestione admin documenti e subtype',
  routes: [
    { scope: 'public', path: '/documents', router: publicRoutes },
    { scope: 'admin', path: '/documents', router: adminDocumentsRoutes },
    { scope: 'admin', path: '/subtypes', router: adminSubtypesRoutes },
  ],
};
