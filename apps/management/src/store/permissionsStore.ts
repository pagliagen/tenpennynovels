/**
 * Permissions Store - Zustand store for character permissions
 *
 * CRITICAL: This store manages ONLY permissions for the active CHARACTER.
 * Separation from authStore (which handles User data) is crucial for multi-character support.
 *
 * Permissions are calculated server-side based on:
 * - Character.isGestore (bypass flag)
 * - Character.adminRoles → ROLE_PERMISSIONS mapping
 * - Character.characterPermissions (custom overrides)
 *
 * @module store/permissionsStore
 * @since 2.0.0
 */

import { create } from 'zustand';
import { apiClient } from '@/lib/api/client';

/**
 * Permissions state interface
 */
interface PermissionsState {
  isGestore: boolean;
  permissions: string[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Permissions actions interface
 */
interface PermissionsActions {
  loadPermissions: () => Promise<void>;
  clearPermissions: () => void;
  hasPermission: (permission: string) => boolean;
}

/**
 * Permissions store type
 */
type PermissionsStore = PermissionsState & PermissionsActions;

/**
 * Initial state
 */
const initialState: PermissionsState = {
  isGestore: false,
  permissions: [],
  isLoading: true,
  error: null
};

/**
 * Create permissions store
 */
export const usePermissionsStore = create<PermissionsStore>((set, get) => ({
  ...initialState,

  /**
   * Load effective permissions from backend
   *
   * Calls GET /auth/effective-permissions to get calculated permissions
   * based on current character's adminRoles and characterPermissions.
   *
   * CRITICAL: Must be called after character selection or change.
   */
  loadPermissions: async () => {
    set({ isLoading: true, error: null });

    try {
      // Call API Gateway (port 8000) → unified-backend
      const response = await apiClient.get('/auth/effective-permissions');

      // Extract from response.data (successResponse format)
      const permissionsData = response.data?.data || response.data;

      set({
        isGestore: permissionsData.isGestore || false,
        permissions: permissionsData.permissions || [],
        isLoading: false,
        error: null
      });

      console.log('[PermissionsStore] Loaded permissions:', {
        isGestore: permissionsData.isGestore,
        permissionsCount: (permissionsData.permissions || []).length
      });

    } catch (error: any) {
      // If no character selected or unauthorized, clear permissions
      if (error?.response?.status === 401) {
        set({
          isGestore: false,
          permissions: [],
          isLoading: false,
          error: 'No character selected'
        });
        return;
      }

      console.error('[PermissionsStore] Failed to load permissions:', error);
      set({
        isGestore: false,
        permissions: [],
        isLoading: false,
        error: error?.response?.data?.error || error?.message || 'Unknown error'
      });
    }
  },

  /**
   * Clear all permissions
   *
   * Called on logout or character deselection.
   */
  clearPermissions: () => {
    set(initialState);
  },

  /**
   * Check if character has specific permission
   *
   * BYPASS: If isGestore=true, returns true for any permission.
   * Otherwise checks if permission exists in permissions array.
   *
   * @param permission - Permission string in format "section.action"
   * @returns True if character has permission
   *
   * @example
   * ```typescript
   * const { hasPermission } = usePermissionsStore();
   * if (hasPermission('users.list')) {
   *   // Show Users List menu item
   * }
   * ```
   */
  hasPermission: (permission: string) => {
    const { isGestore, permissions } = get();

    // UNICO bypass totale
    if (isGestore) {
      return true;
    }

    return permissions.includes(permission);
  }
}));

/**
 * Selectors for performance (avoid unnecessary re-renders)
 */
export const selectIsGestore = (state: PermissionsStore) => state.isGestore;
export const selectPermissions = (state: PermissionsStore) => state.permissions;
export const selectIsLoading = (state: PermissionsStore) => state.isLoading;
export const selectHasPermission = (state: PermissionsStore) => state.hasPermission;
