import type { FeatureManifest } from '@core/features/types';
import gameRoutes from './routes/game';
import adminRoutes from './routes/admin';

/**
 * A differenza di bibliotecario/corporazioni/tickets, occupazioni NON ha un
 * flag: è agganciata alla creazione del personaggio (bonus skill da
 * esperienze pregresse), spegnerla romperebbe il game loop. Prima feature
 * del registro senza `flag:` — tecnicamente supportato, `FeatureFlagService`
 * ritorna sempre true se il manifest non dichiara un flag.
 *
 * routes[].path è SIMMETRICO su entrambi gli scope (a differenza di
 * corporazioni/tickets, che erano asimmetrici): sia il router game che
 * quello admin dichiarano internamente path relativi (`/`, `/categories`,
 * ecc.) e ricevono il prefisso '/occupations' solo al mount storico —
 * verificato leggendo entrambi i file di route per intero, nessuno dei due
 * usa path assoluti che includano già 'occupations'.
 *
 * "occupazioni" qui NON è il lavoro attuale del personaggio (quello è
 * `currentOccupation`, campo testo libero su Character, core/Anagrafica) —
 * è il sistema stile Call of Cthulhu che assegna bonus skill in base a
 * esperienze pregresse, usato in fase di creazione personaggio.
 *
 * Debito dichiarato, non risolto in questa fase: la logica di business è
 * intrecciata con la creazione personaggio in modules/game/utils/
 * characterCreationUtils.ts e modules/game/controllers/
 * CharacterCreationController.ts (quest'ultimo è l'endpoint REALMENTE
 * usato dal wizard, non quello di questa feature) — entrambi restano fuori
 * dalla feature, cross-import esterno fino alla futura Fase 7
 * (consolidamento core).
 */
export const occupazioni: FeatureManifest = {
  key: 'occupazioni',
  title: 'Occupazioni',
  description: 'Esperienze pregresse del personaggio: assegnano bonus alle skill in fase di creazione',
  routes: [
    { scope: 'game', path: '/occupations', router: gameRoutes },
    { scope: 'admin', path: '/occupations', router: adminRoutes },
  ],
};
