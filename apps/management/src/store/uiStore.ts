/**
 * UI Store - Zustand store for UI preferences and state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Column visibility map
 */
export type ColumnVisibilityMap = Record<string, boolean>;

/**
 * UI state interface
 */
interface UIState {
  sidebarCollapsed: boolean;
  expandedCategories: string[];
  columnVisibility: Record<string, ColumnVisibilityMap>; // { tableName: { columnKey: boolean } }
}

/**
 * UI actions interface
 */
interface UIActions {
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleCategory: (key: string) => void;
  setColumnVisibility: (tableName: string, columnKey: string, visible: boolean) => void;
  toggleColumnVisibility: (tableName: string, columnKey: string) => void;
  resetColumnVisibility: (tableName: string) => void;
  getColumnVisibility: (tableName: string, columnKey: string, defaultVisible: boolean) => boolean;
}

/**
 * UI store type
 */
type UIStore = UIState & UIActions;

/**
 * Initial state
 */
const initialState: UIState = {
  sidebarCollapsed: false,
  expandedCategories: ['users', 'characters', 'locations', 'documents', 'game-data', 'system'],
  columnVisibility: {}
};

/**
 * Create UI store with persistence
 */
export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      /**
       * Toggle sidebar collapsed state
       */
      toggleSidebar: () =>
        set(state => ({
          sidebarCollapsed: !state.sidebarCollapsed
        })),

      /**
       * Set sidebar collapsed state
       */
      setSidebarCollapsed: (collapsed) =>
        set({ sidebarCollapsed: collapsed }),

      toggleCategory: (key) =>
        set(state => {
          const cats = state.expandedCategories;
          const expanded = cats.includes(key);
          return {
            expandedCategories: expanded
              ? cats.filter(k => k !== key)
              : [...cats, key]
          };
        }),

      /**
       * Set column visibility for a specific table and column
       */
      setColumnVisibility: (tableName, columnKey, visible) =>
        set(state => ({
          columnVisibility: {
            ...state.columnVisibility,
            [tableName]: {
              ...(state.columnVisibility[tableName] || {}),
              [columnKey]: visible
            }
          }
        })),

      /**
       * Toggle column visibility
       */
      toggleColumnVisibility: (tableName, columnKey) => {
        const state = get();
        const currentVisibility = state.columnVisibility[tableName]?.[columnKey] ?? true;
        get().setColumnVisibility(tableName, columnKey, !currentVisibility);
      },

      /**
       * Reset column visibility for a table
       */
      resetColumnVisibility: (tableName) =>
        set(state => {
          const { [tableName]: _, ...rest } = state.columnVisibility;
          return { columnVisibility: rest };
        }),

      /**
       * Get column visibility with default
       */
      getColumnVisibility: (tableName, columnKey, defaultVisible) => {
        const state = get();
        return state.columnVisibility[tableName]?.[columnKey] ?? defaultVisible;
      }
    }),
    {
      name: 'ui-storage' // localStorage key
    }
  )
);

/**
 * Selectors
 */
export const selectSidebarCollapsed = (state: UIStore) => state.sidebarCollapsed;
export const selectColumnVisibility = (state: UIStore) => state.columnVisibility;
