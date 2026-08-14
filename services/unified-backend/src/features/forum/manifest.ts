import type { FeatureManifest } from '@core/features/types';
import gameRoutes from './routes/game';
import adminTopicsRoutes from './routes/admin-topics';
import adminCategoriesRoutes from './routes/admin-categories';
import adminDiscussionsRoutes from './routes/admin-discussions';
import adminPostsRoutes from './routes/admin-posts';

/**
 * Bacheche, topic, discussioni, post, favoriti, notifiche, iscrizioni,
 * permessi granulari per topic. Niente flag: feature sociale core, sempre
 * attiva.
 *
 * dependsOn: ['corporazioni', 'documenti'] — ForumAccessService.ts usa
 * isMember/getMemberCorporationIds da @features/corporazioni/api (controllo
 * accesso per-corporazione su topic e discussioni); ForumController.searchForum
 * usa EmbeddingService da @features/documenti/api (ricerca semantica, con
 * fallback a ricerca regex).
 *
 * modules/admin/controllers/ForumManagementController.ts (mount /admin/forum)
 * NON fa parte di questa feature: gestisce OnGameMessage (sistema postale
 * in-game, riclassificato come core il 2026-08-13), non uno dei 12 model
 * forum — è "forum" solo per un incidente storico di nome/route. Resta fuori
 * dal perimetro, non toccato in questa fase (deciso con l'utente).
 *
 * routes[].path lato game è '/forum' con scope 'public' (NON 'game'): oggi
 * montato con app.use('/forum', ...) direttamente in app.ts, fuori dal
 * prefisso /game — stesso schema di features/documenti/routes/public.ts.
 * Lato admin, 4 router distinti (mai stati nello stesso file negli originali):
 * admin-topics.ts include anche le 3 route di permessi granulari per
 * personaggio (ForumTopicPermissionManagementController), annidate lì oggi.
 *
 * Il canale Redis 'forum:events' (pubblicato da ForumController e
 * NotificationService, consumato da modules/game/events/handlers/
 * ForumEventHandler.ts per il broadcast Socket.IO) è un contratto pub/sub,
 * non un import — nessuna modifica necessaria, l'handler resta fuori dalla
 * feature. Non wired a un eventHandlers del manifest: FeatureManifest non
 * supporta ancora quel campo (vedi core/features/types.ts).
 *
 * Bug preesistenti preservati esattamente (documentati nei file, non
 * corretti in questa fase): ForumBookmarkController hardcoda sempre
 * itemType:'post' (i bookmark a livello discussione non sono mai creabili
 * pur essendo supportati dallo schema); ForumNotificationController.
 * getNotifications risponde con un formato {success,list,pagination} non
 * standard; il realtime copre solo discussion_created/post_created, non
 * update/delete/restore/pin/favoriti; ForumCategoryManagementController.
 * deleteCategory orfanizza i topic figli mentre ForumTopicManagementController.
 * deleteTopic cancella fisicamente tutto il contenuto figlio (politiche di
 * cascata asimmetriche); il soft-delete di ForumDiscussion/ForumPost è fatto
 * a mano (isDeleted/deletedAt/deletedByCharacterId), non tramite
 * softDeletePlugin/registerSoftDeleteModel come altri model del progetto;
 * ForumController.ts importa il logger condiviso direttamente invece di
 * usare utils/logger.ts come gli altri controller game della feature.
 *
 * `api.ts` è vuoto — vedi commento lì.
 */
export const forum: FeatureManifest = {
  key: 'forum',
  title: 'Forum',
  description: 'Bacheche, topic, discussioni, post, favoriti, notifiche, iscrizioni, permessi granulari per topic',
  dependsOn: ['corporazioni', 'documenti'],
  routes: [
    { scope: 'public', path: '/forum', router: gameRoutes },
    { scope: 'admin', path: '/forum-topics', router: adminTopicsRoutes },
    { scope: 'admin', path: '/forum-categories', router: adminCategoriesRoutes },
    { scope: 'admin', path: '/forum-discussions', router: adminDiscussionsRoutes },
    { scope: 'admin', path: '/forum-posts', router: adminPostsRoutes },
  ],
};
