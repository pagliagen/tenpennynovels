/**
 * Character Sheet Header Store (Zustand)
 *
 * Il bottone "Modifica Scheda" vive nell'header della finestra (Window.tsx),
 * ma la logica/i dati per aprirlo appartengono al contenuto della scheda
 * (CharacterSheetPGPrincipale, che conosce permessi e dati del personaggio).
 * Stesso pattern di registrazione già usato da audioManagerStore: la scheda
 * si registra con characterId + se il viewer può modificare + il callback
 * che apre il modale, l'header legge la registrazione del proprio characterId.
 *
 * @module store/characterSheetHeaderStore
 * @since 2.0.0
 */

import { create } from 'zustand';

interface HeaderRegistration {
  canEdit: boolean;
  openEdit: () => void;
}

interface CharacterSheetHeaderState {
  registrations: Record<string, HeaderRegistration>;
  register: (characterId: string, registration: HeaderRegistration) => void;
  unregister: (characterId: string) => void;
}

export const useCharacterSheetHeaderStore = create<CharacterSheetHeaderState>((set) => ({
  registrations: {},

  register: (characterId, registration) =>
    set((state) => ({
      registrations: { ...state.registrations, [characterId]: registration }
    })),

  unregister: (characterId) =>
    set((state) => {
      const { [characterId]: _removed, ...rest } = state.registrations;
      return { registrations: rest };
    })
}));
