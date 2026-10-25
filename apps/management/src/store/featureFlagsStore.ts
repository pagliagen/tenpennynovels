/**
 * Feature Flags Store - Zustand store for UI feature flags
 *
 * Voci di menu/funzionalità legate a servizi non gestiti dal server al
 * momento (AI). Letto da GET /admin/system/feature-flags, nessun permesso
 * granulare richiesto.
 *
 * @module store/featureFlagsStore
 */

import { create } from 'zustand';
import { apiClient } from '@/lib/api/client';
import { logger } from '@/lib/logger';

interface FeatureFlagsState {
  keeperQaEnabled: boolean;
  /**
   * Funzioni editoriali CON IL MODELLO: accese solo da ENABLE_IA_EDITORIAL sul server (assente in
   * produzione). La revisione di canone non dipende da questo flag: è deterministica ed è sempre attiva.
   */
  editorialAiEnabled: boolean;
  isLoading: boolean;
}

interface FeatureFlagsActions {
  loadFeatureFlags: () => Promise<void>;
  /**
   * Rilegge i flag senza passare da `isLoading` e senza azzerare nulla se la richiesta fallisce:
   * serve al polling (le funzioni AI possono accendersi o spegnersi mentre il pannello è aperto).
   */
  refreshFeatureFlags: () => Promise<void>;
  clearFeatureFlags: () => void;
}

type FeatureFlagsStore = FeatureFlagsState & FeatureFlagsActions;

const initialState: FeatureFlagsState = {
  keeperQaEnabled: false,
  editorialAiEnabled: false,
  isLoading: true
};

export const useFeatureFlagsStore = create<FeatureFlagsStore>((set) => ({
  ...initialState,

  loadFeatureFlags: async () => {
    set({ isLoading: true });

    try {
      const response = await apiClient.get('/admin/system/feature-flags');
      const data = response.data?.data || response.data;

      set({
        keeperQaEnabled: data.keeperQaEnabled ?? false,
        editorialAiEnabled: data.editorialAiEnabled ?? false,
        isLoading: false
      });
    } catch (error: unknown) {
      logger.error('[FeatureFlagsStore] Failed to load feature flags:', { error });
      // Fail-closed: in caso di errore le feature restano nascoste
      set({ keeperQaEnabled: false, editorialAiEnabled: false, isLoading: false });
    }
  },

  refreshFeatureFlags: async () => {
    try {
      const response = await apiClient.get('/admin/system/feature-flags');
      const data = response.data?.data || response.data;
      set({
        keeperQaEnabled: data.keeperQaEnabled ?? false,
        editorialAiEnabled: data.editorialAiEnabled ?? false
      });
    } catch (error: unknown) {
      // Un errore passeggero non deve far sparire i pulsanti: resta l'ultimo stato noto.
      logger.warn('[FeatureFlagsStore] Refresh feature flags fallito', { error });
    }
  },

  clearFeatureFlags: () => {
    set(initialState);
  }
}));
