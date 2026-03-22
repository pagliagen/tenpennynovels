/**
 * Window Manager Store (Zustand)
 *
 * Centralized state management for ALL window types:
 * - Character sheets
 * - Messages (on-game/off-game)
 * - Utility windows
 *
 * Handles multi-window management, dragging, minimize/restore, z-index.
 *
 * @module store/windowManagerStore
 * @since 2.0.0
 */

import { create } from 'zustand';

import {
  WindowType,
  WindowData,
  WindowState,
  WindowManagerActions,
  DEFAULT_SIZES,
} from '@/types/window-manager';

/**
 * Window Manager Store State + Actions
 *
 * @interface WindowManagerStore
 * @since 2.0.0
 */
interface WindowManagerStore {
  /** Array of open windows */
  windows: WindowState[];

  /** Actions (see WindowManagerActions interface) */
  openWindow: WindowManagerActions['openWindow'];
  closeWindow: WindowManagerActions['closeWindow'];
  minimizeWindow: WindowManagerActions['minimizeWindow'];
  restoreWindow: WindowManagerActions['restoreWindow'];
  focusWindow: WindowManagerActions['focusWindow'];
  updatePosition: WindowManagerActions['updatePosition'];
}

/**
 * Generate unique window ID
 *
 * @returns {string} Unique ID
 */
function generateId(): string {
  return `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate cascade position for new window
 *
 * Offset from previous windows to avoid complete overlap.
 *
 * @param {number} index - Window index in windows array
 * @returns {{ x: number; y: number }} Position
 */
function getCascadePosition(index: number): { x: number; y: number } {
  const baseX = 100;
  const baseY = 100;
  const offset = 40; // Cascade offset

  return {
    x: baseX + (index * offset),
    y: baseY + (index * offset),
  };
}

/**
 * Check if two windows are the same
 *
 * Compares type + data to determine if window already open.
 *
 * @param {WindowState} window - Window to check
 * @param {WindowType} type - Type to match
 * @param {Omit<WindowData, 'type'>} data - Data to match
 * @returns {boolean} True if window matches type + data
 */
function isSameWindow(
  window: WindowState,
  type: WindowType,
  data: Omit<WindowData, 'type'>
): boolean {
  if (window.type !== type) return false;

  switch (type) {
    case 'characterSheet':
      return window.data.type === 'characterSheet' && window.data.characterId === (data as any).characterId;
    case 'messageOnGame':
      return window.data.type === 'messageOnGame' && window.data.conversationId === (data as any).conversationId;
    case 'messageOffGame':
      return window.data.type === 'messageOffGame' && window.data.conversationId === (data as any).conversationId;
    case 'utility':
      return window.data.type === 'utility' && window.data.utilityName === (data as any).utilityName;
    default:
      return false;
  }
}

/**
 * Window Manager Store Hook
 *
 * Zustand store for managing all window types.
 *
 * @constant
 * @since 2.0.0
 *
 * @example
 * ```typescript
 * // In a component
 * const { openWindow, closeWindow, windows } = useWindowManagerStore();
 *
 * // Open character sheet
 * openWindow('characterSheet', {
 *   characterId: '123',
 *   characterName: 'John Doe',
 *   avatar: '/avatar.jpg'
 * });
 *
 * // Open message window
 * openWindow('messageOnGame', {
 *   conversationId: '456',
 *   conversationTitle: 'Chat with Jane'
 * });
 *
 * // Close window
 * closeWindow(windowId);
 * ```
 */
export const useWindowManagerStore = create<WindowManagerStore>()((set) => ({
  // Initial state
  windows: [],

  /**
   * Open Window
   *
   * If window already open (same type + data) → restore/focus
   * Otherwise → create new window
   */
  openWindow: (type, data) => {
    set((state) => {
      // Check if window already open
      const existingWindow = state.windows.find((w) => isSameWindow(w, type, data));

      if (existingWindow) {
        // Window already open
        const nextZIndex = Math.max(...state.windows.map((w) => w.zIndex), 1000) + 1;

        // Update data if new data has prefilledRecipientId (for mail window switching recipients)
        const shouldUpdateData = (data as any).prefilledRecipientId !== undefined;
        const updatedData = shouldUpdateData ? { ...existingWindow.data, ...data } : existingWindow.data;

        return {
          windows: state.windows.map((w) =>
            w.id === existingWindow.id
              ? {
                  ...w,
                  isMinimized: false,
                  zIndex: nextZIndex,
                  data: updatedData as WindowData,
                }
              : w
          ),
        };
      }

      // Create new window
      const nextZIndex = Math.max(...state.windows.map((w) => w.zIndex), 1000) + 1;

      // Determine window size (custom sizes for specific utilities)
      let windowSize = DEFAULT_SIZES[type];
      if (type === 'utility' && 'utilityName' in data) {
        console.log('data.utilityName', data.utilityName);
        switch (data.utilityName) {
          case 'character-directory':
            windowSize = { width: 957, height: 600 };
            break;
          case 'character-faceclaim':
            windowSize = { width: 1200, height: 700 };
            break;
          // Add more custom utility sizes here as needed
        }
      }

      const newWindow: WindowState = {
        id: generateId(),
        type,
        data: { type, ...data } as WindowData, // Merge type into data
        position: getCascadePosition(state.windows.length),
        size: windowSize,
        isMinimized: false,
        zIndex: nextZIndex,
      };

      return { windows: [...state.windows, newWindow] };
    });
  },

  /**
   * Close Window
   */
  closeWindow: (id) => {
    set((state) => ({
      windows: state.windows.filter((w) => w.id !== id),
    }));
  },

  /**
   * Minimize Window
   */
  minimizeWindow: (id) => {
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, isMinimized: true } : w)),
    }));
  },

  /**
   * Restore Window
   */
  restoreWindow: (id) => {
    set((state) => {
      const nextZIndex = Math.max(...state.windows.map((w) => w.zIndex), 1000) + 1;

      return {
        windows: state.windows.map((w) =>
          w.id === id ? { ...w, isMinimized: false, zIndex: nextZIndex } : w
        ),
      };
    });
  },

  /**
   * Focus Window
   */
  focusWindow: (id) => {
    set((state) => {
      const nextZIndex = Math.max(...state.windows.map((w) => w.zIndex), 1000) + 1;

      return {
        windows: state.windows.map((w) => (w.id === id ? { ...w, zIndex: nextZIndex } : w)),
      };
    });
  },

  /**
   * Update Window Position
   */
  updatePosition: (id, position) => {
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, position } : w)),
    }));
  },
}));
