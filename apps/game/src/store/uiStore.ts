/**
 * UI Store (Zustand)
 *
 * Manages client-side UI state including:
 * - Theme preferences
 * - Sidebar collapsed state
 * - Modal states
 * - Loading states
 * - Toast notifications
 *
 * CRITICAL: This store handles ONLY UI state.
 * No server data should be stored here.
 *
 * @module store/uiStore
 * @since 2.0.0
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UI_CONFIG } from '@/constants/config';

/**
 * Theme Type
 *
 * Available theme options for the application.
 *
 * @typedef {'victorian' | 'dark' | 'light'} Theme
 * @since 2.0.0
 */
export type Theme = 'victorian' | 'dark' | 'light';

/**
 * Modal State Type
 *
 * Tracks open/closed state of application modals.
 *
 * @typedef {Object} ModalState
 * @property {boolean} characterSheet - Character sheet modal
 * @property {boolean} settings - Settings modal
 * @property {boolean} inventory - Inventory modal (future)
 * @property {boolean} map - Map modal
 * @property {boolean} [customModal] - Custom modal states can be added dynamically
 *
 * @since 2.0.0
 */
export interface ModalState {
  characterSheet: boolean;
  settings: boolean;
  inventory: boolean;
  map: boolean;
  [key: string]: boolean; // Allow dynamic modal states
}

/**
 * Toast Notification Type
 *
 * Represents a toast notification message.
 *
 * @typedef {Object} Toast
 * @property {string} id - Unique toast identifier
 * @property {'success' | 'error' | 'warning' | 'info'} type - Toast type
 * @property {string} message - Toast message content
 * @property {number} [duration] - Auto-dismiss duration in ms (default: 3000)
 *
 * @since 2.0.0
 */
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

/**
 * UI Store State
 *
 * @interface UIState
 * @since 2.0.0
 */
interface UIState {
  /** Current application theme */
  theme: Theme;

  /** Whether sidebar is collapsed */
  sidebarCollapsed: boolean;

  /** Modal open/closed states */
  modals: ModalState;

  /** Active toast notifications */
  toasts: Toast[];

  /** Global loading state (e.g., for full-page loading) */
  isLoading: boolean;
}

/**
 * UI Store Actions
 *
 * @interface UIActions
 * @since 2.0.0
 */
interface UIActions {
  /**
   * Set application theme
   *
   * @param {Theme} theme - Theme to set
   * @returns {void}
   */
  setTheme: (theme: Theme) => void;

  /**
   * Toggle sidebar collapsed state
   *
   * @returns {void}
   */
  toggleSidebar: () => void;

  /**
   * Set sidebar collapsed state
   *
   * @param {boolean} collapsed - Whether sidebar should be collapsed
   * @returns {void}
   */
  setSidebarCollapsed: (collapsed: boolean) => void;

  /**
   * Open a modal
   *
   * @param {string} modalName - Name of the modal to open
   * @returns {void}
   */
  openModal: (modalName: string) => void;

  /**
   * Close a modal
   *
   * @param {string} modalName - Name of the modal to close
   * @returns {void}
   */
  closeModal: (modalName: string) => void;

  /**
   * Close all modals
   *
   * @returns {void}
   */
  closeAllModals: () => void;

  /**
   * Add a toast notification
   *
   * @param {Omit<Toast, 'id'>} toast - Toast configuration (id is auto-generated)
   * @returns {string} Generated toast ID
   */
  addToast: (toast: Omit<Toast, 'id'>) => string;

  /**
   * Remove a toast notification
   *
   * @param {string} id - Toast ID to remove
   * @returns {void}
   */
  removeToast: (id: string) => void;

  /**
   * Clear all toast notifications
   *
   * @returns {void}
   */
  clearToasts: () => void;

  /**
   * Set global loading state
   *
   * @param {boolean} loading - Whether application is loading
   * @returns {void}
   */
  setLoading: (loading: boolean) => void;
}

/**
 * Combined UI Store Type
 *
 * @typedef {UIState & UIActions} UIStore
 * @since 2.0.0
 */
type UIStore = UIState & UIActions;

/**
 * UI Store Hook
 *
 * Zustand store for managing UI state.
 * Theme and sidebar preferences are persisted to localStorage.
 *
 * @constant
 * @type {import('zustand').UseBoundStore<import('zustand').StoreApi<UIStore>>}
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * // In a component
 * const { theme, setTheme, sidebarCollapsed, toggleSidebar } = useUIStore();
 *
 * // Change theme
 * setTheme('dark');
 *
 * // Toggle sidebar
 * toggleSidebar();
 *
 * // Open modal
 * const { openModal, closeModal } = useUIStore();
 * openModal('characterSheet');
 *
 * // Show toast
 * const { addToast } = useUIStore();
 * addToast({
 *   type: 'success',
 *   message: 'Character saved successfully!',
 *   duration: 3000
 * });
 * ```
 */
export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Initial state
      theme: UI_CONFIG.DEFAULT_THEME,
      sidebarCollapsed: false,
      modals: {
        characterSheet: false,
        settings: false,
        inventory: false,
        map: false,
      },
      toasts: [],
      isLoading: false,

      /**
       * Set application theme
       *
       * Updates theme in state and applies to document root.
       *
       * @function setTheme
       * @param {Theme} theme - Theme to set
       * @returns {void}
       * @since 2.0.0
       */
      setTheme: (theme) => {
        set({ theme });

        // Apply theme to document (for CSS variables)
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', theme);
        }
      },

      /**
       * Toggle sidebar collapsed state
       *
       * @function toggleSidebar
       * @returns {void}
       * @since 2.0.0
       */
      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      /**
       * Set sidebar collapsed state
       *
       * @function setSidebarCollapsed
       * @param {boolean} collapsed - Whether sidebar should be collapsed
       * @returns {void}
       * @since 2.0.0
       */
      setSidebarCollapsed: (collapsed) => {
        set({ sidebarCollapsed: collapsed });
      },

      /**
       * Open a modal
       *
       * @function openModal
       * @param {string} modalName - Name of the modal to open
       * @returns {void}
       * @since 2.0.0
       */
      openModal: (modalName) => {
        set((state) => ({
          modals: {
            ...state.modals,
            [modalName]: true,
          },
        }));
      },

      /**
       * Close a modal
       *
       * @function closeModal
       * @param {string} modalName - Name of the modal to close
       * @returns {void}
       * @since 2.0.0
       */
      closeModal: (modalName) => {
        set((state) => ({
          modals: {
            ...state.modals,
            [modalName]: false,
          },
        }));
      },

      /**
       * Close all modals
       *
       * @function closeAllModals
       * @returns {void}
       * @since 2.0.0
       */
      closeAllModals: () => {
        set((state) => {
          const closedModals = Object.keys(state.modals).reduce(
            (acc, key) => ({ ...acc, [key]: false }),
            {} as ModalState
          );
          return { modals: closedModals };
        });
      },

      /**
       * Add a toast notification
       *
       * Generates unique ID and adds toast to queue.
       * Toast auto-dismisses after duration (default: 3000ms).
       *
       * @function addToast
       * @param {Omit<Toast, 'id'>} toast - Toast configuration
       * @returns {string} Generated toast ID
       * @since 2.0.0
       */
      addToast: (toast) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newToast: Toast = { id, ...toast };

        set((state) => ({
          toasts: [...state.toasts, newToast],
        }));

        // Auto-remove toast after duration
        const duration = toast.duration || 3000;
        setTimeout(() => {
          set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
          }));
        }, duration);

        return id;
      },

      /**
       * Remove a toast notification
       *
       * @function removeToast
       * @param {string} id - Toast ID to remove
       * @returns {void}
       * @since 2.0.0
       */
      removeToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id),
        }));
      },

      /**
       * Clear all toast notifications
       *
       * @function clearToasts
       * @returns {void}
       * @since 2.0.0
       */
      clearToasts: () => {
        set({ toasts: [] });
      },

      /**
       * Set global loading state
       *
       * @function setLoading
       * @param {boolean} loading - Whether application is loading
       * @returns {void}
       * @since 2.0.0
       */
      setLoading: (loading) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'tpn_ui_state', // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        // Apply theme after hydration
        if (state && typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', state.theme);
        }
      },
    }
  )
);

/**
 * Selector Hooks for Optimized Re-renders
 *
 * @namespace uiSelectors
 * @since 2.0.0
 */
export const uiSelectors = {
  /** Select current theme */
  theme: (state: UIStore) => state.theme,

  /** Select sidebar collapsed state */
  sidebarCollapsed: (state: UIStore) => state.sidebarCollapsed,

  /** Select all modals state */
  modals: (state: UIStore) => state.modals,

  /** Select specific modal state */
  modal: (modalName: string) => (state: UIStore) => state.modals[modalName] || false,

  /** Select all toasts */
  toasts: (state: UIStore) => state.toasts,

  /** Select loading state */
  isLoading: (state: UIStore) => state.isLoading,
} as const;
