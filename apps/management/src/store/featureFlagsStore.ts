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
  botManagementEnabled: boolean;
  keeperQaEnabled: boolean;
  isLoading: boolean;
}

interface FeatureFlagsActions {
  loadFeatureFlags: () => Promise<void>;
  clearFeatureFlags: () => void;
}

type FeatureFlagsStore = FeatureFlagsState & FeatureFlagsActions;

const initialState: FeatureFlagsState = {
  botManagementEnabled: false,
  keeperQaEnabled: false,
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
        botManagementEnabled: data.botManagementEnabled ?? false,
        keeperQaEnabled: data.keeperQaEnabled ?? false,
        isLoading: false
      });
    } catch (error: unknown) {
      logger.error('[FeatureFlagsStore] Failed to load feature flags:', { error });
      // Fail-closed: in caso di errore le feature restano nascoste
      set({ botManagementEnabled: false, keeperQaEnabled: false, isLoading: false });
    }
  },

  clearFeatureFlags: () => {
    set(initialState);
  }
}));
