import type { FeatureManifest } from '@core/features/types';
import gameRoutes from './routes/game';
import adminRoutes from './routes/admin';

/**
 * A differenza del bibliotecario, le corporazioni non hanno mai avuto un
 * flag: erano sempre attive. Introdotto ora con default:true per non
 * cambiare il comportamento oggi — vedi docs/refactor/FEATURE-MODULES-PLAN.md
 * Fase 4.
 *
 * routes[].path è asimmetrico fra i due scope, non un errore: il router
 * game ha già '/corporations' nelle proprie dichiarazioni interne (mount
 * storico a '/'), il router admin è relativo e riceve il prefisso dal
 * mount (storico a '/corporations') — verificato path per path (anche
 * con un test Express reale) per non alterare nessuno dei 19 endpoint
 * esistenti.
 *
 * eventHandlers/permissions restano fuori dal manifest (come da Fase 1):
 * il canale Redis 'corporation:events' è sottoscritto e instradato ma mai
 * pubblicato da nessuno (infrastruttura morta) — non c'è nulla di reale
 * da migrare qui. Diverge dal commento originale in core/features/types.ts
 * (che indicava proprio questa fase come trigger per eventHandlers),
 * corretto quel commento nello stesso commit di questa feature.
 */
export const corporazioni: FeatureManifest = {
  key: 'corporazioni',
  title: 'Corporazioni',
  description: 'Gilde, associazioni professionali e organizzazioni di personaggio',
  flag: { configKey: 'corporations_enabled', section: 'system', default: true, label: 'Corporazioni' },
  routes: [
    { scope: 'game', path: '/', router: gameRoutes },
    { scope: 'admin', path: '/corporations', router: adminRoutes },
  ],
};
