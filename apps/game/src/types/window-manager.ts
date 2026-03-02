/**
 * Window Manager Types
 *
 * Type definitions for the unified multi-window manager system.
 * Supports character sheets, messages (on-game/off-game), and utility windows.
 *
 * @module types/window-manager
 * @since 2.0.0
 */

/**
 * Window Types
 *
 * Enum of all supported window types in the application.
 *
 * @enum {string}
 * @since 2.0.0
 */
export type WindowType = 'characterSheet' | 'messageOnGame' | 'messageOffGame' | 'utility';

/**
 * Window Data (Discriminated Union)
 *
 * Type-specific data for each window type.
 * Uses discriminated union for type-safe access to window data.
 *
 * @since 2.0.0
 */
export type WindowData =
  | {
      type: 'characterSheet';
      characterId: string;
      characterName?: string;
      avatar?: string;
    }
  | {
      type: 'messageOnGame';
      conversationId: string;
      conversationTitle?: string;
      initialView?: 'inbox' | 'compose' | 'thread';
      prefilledRecipientId?: string;
      prefilledRecipientName?: string;
    }
  | {
      type: 'messageOffGame';
      conversationId: string; // 'offgame-main' for singleton
      conversationTitle?: string;
      initialView?: 'list' | 'thread' | 'new';
      prefilledRecipientId?: string;
      prefilledRecipientName?: string;
    }
  | {
      type: 'utility';
      utilityName: string;
      [key: string]: any; // Allow arbitrary utility-specific data
    };

/**
 * Window State
 *
 * Represents a single window instance in the WindowManagerStore.
 *
 * @interface WindowState
 * @since 2.0.0
 */
export interface WindowState {
  /** Unique window instance ID (UUID) */
  id: string;

  /** Window type (determines content rendering) */
  type: WindowType;

  /** Type-specific data (discriminated union) */
  data: WindowData;

  /** Window position (top-left corner) */
  position: { x: number; y: number };

  /** Window size (initialized from DEFAULT_SIZES, immutable) */
  size: { width: number; height: number };

  /** Whether window is minimized */
  isMinimized: boolean;

  /** Z-index for focus management (higher = on top) */
  zIndex: number;
}

/**
 * Default Window Sizes
 *
 * Fixed dimensions per window type (CSS-defined, immutable).
 *
 * @constant
 * @since 2.0.0
 */
export const DEFAULT_SIZES: Record<WindowType, { width: number; height: number }> = {
  characterSheet: { width: 800, height: 600 },
  messageOnGame: { width: 1000, height: 600 },
  messageOffGame: { width: 1000, height: 600 },
  utility: { width: 400, height: 300 }, // Default for utilities
};

/**
 * Window Manager Actions
 *
 * Interface for WindowManagerStore actions.
 *
 * @interface WindowManagerActions
 * @since 2.0.0
 */
export interface WindowManagerActions {
  /**
   * Open a window
   *
   * If window already open (same type + data) → restore/focus
   * Otherwise → create new window at cascade position
   *
   * @param {WindowType} type - Window type to open
   * @param {Omit<WindowData, 'type'>} data - Type-specific data
   * @returns {void}
   */
  openWindow: (type: WindowType, data: Omit<WindowData, 'type'>) => void;

  /**
   * Close a window
   *
   * Removes window from windows array.
   *
   * @param {string} id - Window instance ID
   * @returns {void}
   */
  closeWindow: (id: string) => void;

  /**
   * Minimize a window
   *
   * Hides window and adds to minimize bar.
   * Position is preserved for restoration.
   *
   * @param {string} id - Window instance ID
   * @returns {void}
   */
  minimizeWindow: (id: string) => void;

  /**
   * Restore a minimized window
   *
   * Shows window at original position and brings to front.
   *
   * @param {string} id - Window instance ID
   * @returns {void}
   */
  restoreWindow: (id: string) => void;

  /**
   * Focus a window
   *
   * Brings window to front by increasing its z-index.
   *
   * @param {string} id - Window instance ID
   * @returns {void}
   */
  focusWindow: (id: string) => void;

  /**
   * Update window position (for dragging)
   *
   * @param {string} id - Window instance ID
   * @param {{ x: number; y: number }} position - New position
   * @returns {void}
   */
  updatePosition: (id: string, position: { x: number; y: number }) => void;
}
