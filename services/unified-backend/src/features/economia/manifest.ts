import type { FeatureManifest } from '@core/features/types';
import gameRoutes from './routes/game';
import adminRoutes from './routes/admin';

/**
 * Come occupazioni: nessun flag. Le finanze del personaggio sono agganciate
 * all'approvazione (CharacterApprovalController le inizializza) e alla
 * progressione della skill FINANZA (CharacterController.ts le aggiorna) —
 * non sono spegnibili senza rompere flussi core.
 *
 * routes[].path lato game è '/' (il router interno ha già path assoluti
 * `/economy/services...`, `/economy/admin/...` — stesso schema di
 * tickets/corporazioni lato game). Lato admin è '/social-classes', il
 * router interno è relativo.
 *
 * Il model Shop di CharacterFinancesManagementController non esiste qui:
 * quel controller gestisce solo `finances`, non ha una route file propria,
 * resta montato dentro modules/admin/routes/characterRoutes.ts (dominio
 * Character, esterno) — vedi boundary-allow su quel file.
 *
 * `api.ts` non è un barrel vuoto: ri-esporta services/serviceCancellationCleanup
 * per il suo side-effect (cron.schedule a livello di modulo), innescato da
 * server.ts con un import dinamico. Vedi commento in api.ts.
 *
 * EconomyController.ts/economy.ts (dominio "oggetti": shop-purchase) restano
 * fuori da questa feature — verranno spostati nella prossima fase (`oggetti`,
 * dependsOn: ['economia']). economy.ts oggi è stato ridotto alle sole route
 * shop, con una propria copia dei due rate limiter che prima condivideva con
 * le route services/financial qui migrate — comportamento leggermente diverso
 * (budget di rate-limit non più condiviso), dichiarato, non un bug.
 */
export const economia: FeatureManifest = {
  key: 'economia',
  title: 'Economia',
  description: 'Finanze del personaggio, classe sociale, servizi continuativi (VC-budget)',
  routes: [
    { scope: 'game', path: '/', router: gameRoutes },
    { scope: 'admin', path: '/social-classes', router: adminRoutes },
  ],
};
