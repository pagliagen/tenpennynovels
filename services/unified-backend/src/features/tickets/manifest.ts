import type { FeatureManifest } from '@core/features/types';
import gameRoutes from './routes/game';
import adminRoutes from './routes/admin';

/**
 * A differenza di corporazioni, tickets non ha mai avuto un flag: introdotto
 * ora con default:true su richiesta esplicita dell'utente, coerenza con
 * bibliotecario/corporazioni a costo zero — vedi docs/refactor/FEATURE-MODULES-PLAN.md
 * Fase 6.1.
 *
 * routes[].path è asimmetrico fra i due scope, stesso schema di corporazioni:
 * il router game ha già '/tickets' nelle proprie dichiarazioni interne (mount
 * storico a '/'), il router admin è relativo e riceve il prefisso dal mount
 * (storico a '/tickets') — verificato riga per riga contro entrambi i file
 * di route per non alterare nessuno dei 33 endpoint esistenti (15 game + 18 admin).
 *
 * eventHandlers resta fuori dal manifest: il canale Redis 'ticket:events' è
 * vivo (pubblicato da TicketController, TicketManagementController,
 * EscalationService) ma modules/game/events/handlers/TicketEventHandler.ts
 * non ha alcun accoppiamento al model/tipi ticket — opera sul payload
 * generico dell'evento, non fa query. Un canale vivo da solo non basta a
 * giustificare eventHandlers nel manifest: serve che l'handler stesso
 * dipenda dai model/tipi della feature. Resta dov'è.
 *
 * jobs non introdotto: il cron di EscalationService resta wiring manuale in
 * modules/admin/index.ts (solo l'import cambia, punta a @features/tickets/api).
 */
export const tickets: FeatureManifest = {
  key: 'tickets',
  title: 'Ticket di supporto',
  description: 'Sistema di supporto/ticketing tra personaggi e staff, con escalation automatica',
  flag: { configKey: 'tickets_enabled', section: 'system', default: true, label: 'Ticket di supporto' },
  routes: [
    { scope: 'game', path: '/', router: gameRoutes },
    { scope: 'admin', path: '/tickets', router: adminRoutes },
  ],
};
