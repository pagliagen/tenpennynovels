/**
 * Audio Manager Store (Zustand)
 *
 * Un solo brano attivo alla volta tra tutte le schede personaggio aperte:
 * suona quello della scheda in primo piano (zIndex più alto tra le finestre
 * characterSheet aperte). Cambiare finestra attiva ferma il brano corrente e
 * avvia quello della nuova finestra. Le schede si registrano/deregistrano da
 * sole (CharacterSheetContent) con il proprio characterId + audioTheme; questo
 * store non fa fetch: riusa i dati già caricati dalla scheda.
 *
 * @module store/audioManagerStore
 * @since 2.0.0
 */

import { create } from 'zustand';

interface AudioRegistration {
  audioUrl?: string;
  characterName: string;
}

interface AudioManagerState {
  /** audioTheme registrato per ogni characterId con una scheda aperta */
  registrations: Record<string, AudioRegistration>;
  /** characterId della scheda il cui audio sta effettivamente suonando */
  activeCharacterId: string | null;
  /** Diventa true al primo gesto utente: prima di allora niente autoplay (policy browser) */
  unlocked: boolean;
  /** Pausa manuale richiesta dall'utente sul brano corrente */
  manuallyPaused: boolean;

  register: (characterId: string, audioUrl: string | undefined, characterName: string) => void;
  unregister: (characterId: string) => void;
  setActiveCharacterId: (characterId: string | null) => void;
  unlock: () => void;
  togglePause: () => void;
}

export const useAudioManagerStore = create<AudioManagerState>((set) => ({
  registrations: {},
  activeCharacterId: null,
  unlocked: false,
  manuallyPaused: false,

  register: (characterId, audioUrl, characterName) =>
    set((state) => ({
      registrations: { ...state.registrations, [characterId]: { audioUrl, characterName } }
    })),

  unregister: (characterId) =>
    set((state) => {
      const { [characterId]: _removed, ...rest } = state.registrations;
      return { registrations: rest };
    }),

  setActiveCharacterId: (characterId) =>
    set((state) => ({
      activeCharacterId: characterId,
      // Cambiare scheda attiva resetta lo stato "pausa manuale" del brano precedente
      manuallyPaused: characterId === state.activeCharacterId ? state.manuallyPaused : false
    })),

  unlock: () => set({ unlocked: true }),

  togglePause: () => set((state) => ({ manuallyPaused: !state.manuallyPaused }))
}));
