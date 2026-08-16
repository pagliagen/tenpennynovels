import type { FeatureManifest } from '@core/features/types';
import { ChatActionType } from '@core/chat/actionTypes/ChatActionType';
import gameRoutes from './routes/game';

/**
 * social_confrontation + combat_action + confrontation_reaction_request:
 * un'unica feature (decisione utente), non tre — sono lo stesso sottosistema
 * (attacco → richiesta di reazione → risoluzione), mai indipendenti l'uno
 * dall'altro. Nessuno dei 3 tipi è mai creabile tramite il percorso
 * generico POST /game/chats/ActionRouter (canCreate sempre false lì): solo
 * le route dedicate qui sotto li creano/risolvono, con i permessi reali
 * verificati dentro ConfrontationController stesso, non dal registry.
 */
export const confronti: FeatureManifest = {
  key: 'confronti',
  title: 'Scontri (Sociali e Combattimento)',
  description: 'Sistema TiroContrapposto: conflitti sociali e combattimento con richiesta di reazione',
  flag: { configKey: 'confronti_enabled', section: 'system', default: true, label: 'Scontri (TiroContrapposto)' },
  routes: [
    { scope: 'game', path: '/chats', router: gameRoutes },
  ],
  chatActionTypes: [
    {
      key: ChatActionType.SOCIAL_CONFRONTATION,
      canCreate: () => false,
      defaultVisibility: 'public',
      adminLabel: 'Social confrontation (opposed roll) outcomes',
    },
    {
      key: ChatActionType.COMBAT_ACTION,
      canCreate: () => false,
      defaultVisibility: 'public',
      adminLabel: 'Combat action (opposed roll) outcomes',
    },
    {
      key: ChatActionType.CONFRONTATION_REACTION_REQUEST,
      canCreate: () => false,
      defaultVisibility: 'whisper',
      adminLabel: 'Pending confrontation reaction request',
    },
  ],
};
