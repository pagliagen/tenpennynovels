/**
 * Character Sheets Context
 *
 * Manages multi-window character sheet state.
 * Allows opening multiple character sheets simultaneously,
 * dragging windows, minimizing to bottom bar, and z-index management.
 *
 * @module contexts/CharacterSheetsContext
 * @since 2.0.0
 */

'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * Character Sheet Window State
 *
 * Represents a single character sheet window instance.
 *
 * @interface CharacterSheetState
 * @since 2.0.0
 */
export interface CharacterSheetState {
  /** Unique window instance ID (UUID) */
  id: string;

  /** Character MongoDB _id */
  characterId: string;

  /** Character name (for minimize bar display) */
  characterName: string;

  /** Character avatar URL (for minimize bar display) */
  avatar?: string;

  /** Window position (top-left corner) */
  position: { x: number; y: number };

  /** Whether window is minimized */
  isMinimized: boolean;

  /** Z-index for focus management (higher = on top) */
  zIndex: number;
}

/**
 * Character Sheets Context Value
 *
 * Provides state and actions for managing character sheet windows.
 *
 * @interface CharacterSheetsContextValue
 * @since 2.0.0
 */
export interface CharacterSheetsContextValue {
  /** Array of open character sheet windows */
  openSheets: CharacterSheetState[];

  /**
   * Open a character sheet window
   *
   * If character is already open, restores and focuses it.
   * Otherwise, creates new window at cascade position.
   *
   * @param {string} characterId - MongoDB _id of character to open
   * @param {string} [characterName] - Character name (optional, fetched if not provided)
   * @param {string} [avatar] - Character avatar URL (optional)
   * @returns {void}
   */
  openCharacterSheet: (characterId: string, characterName?: string, avatar?: string) => void;

  /**
   * Close a character sheet window
   *
   * Removes window from openSheets array.
   *
   * @param {string} id - Window instance ID
   * @returns {void}
   */
  closeCharacterSheet: (id: string) => void;

  /**
   * Minimize a character sheet window
   *
   * Hides window and adds to minimize bar.
   * Position is preserved for restoration.
   *
   * @param {string} id - Window instance ID
   * @returns {void}
   */
  minimizeCharacterSheet: (id: string) => void;

  /**
   * Restore a minimized character sheet window
   *
   * Shows window at original position and brings to front.
   *
   * @param {string} id - Window instance ID
   * @returns {void}
   */
  restoreCharacterSheet: (id: string) => void;

  /**
   * Focus a character sheet window
   *
   * Brings window to front by increasing its z-index.
   *
   * @param {string} id - Window instance ID
   * @returns {void}
   */
  focusCharacterSheet: (id: string) => void;

  /**
   * Update window position (for dragging)
   *
   * @param {string} id - Window instance ID
   * @param {{ x: number; y: number }} position - New position
   * @returns {void}
   */
  updateSheetPosition: (id: string, position: { x: number; y: number }) => void;
}

/**
 * Character Sheets Context
 *
 * React context for character sheet window management.
 *
 * @constant
 * @type {React.Context<CharacterSheetsContextValue | undefined>}
 * @since 2.0.0
 */
const CharacterSheetsContext = createContext<CharacterSheetsContextValue | undefined>(undefined);

/**
 * Character Sheets Provider Props
 *
 * @interface CharacterSheetsProviderProps
 * @since 2.0.0
 */
interface CharacterSheetsProviderProps {
  children: ReactNode;
}

/**
 * Generate unique window ID
 *
 * Simple UUID generator for window instance IDs.
 *
 * @returns {string} Unique ID
 */
function generateId(): string {
  return `sheet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate cascade position for new window
 *
 * Offset from previous window to avoid complete overlap.
 *
 * @param {number} index - Window index in openSheets array
 * @returns {{ x: number; y: number }} Position
 */
function getCascadePosition(index: number): { x: number; y: number } {
  const baseX = 100;
  const baseY = 100;
  const offset = 40; // Cascade offset

  return {
    x: baseX + (index * offset),
    y: baseY + (index * offset)
  };
}

/**
 * Character Sheets Provider
 *
 * Provides multi-window character sheet management to the app.
 *
 * @component
 * @param {CharacterSheetsProviderProps} props - Provider props
 * @returns {JSX.Element} Provider component
 * @since 2.0.0
 *
 * @example
 * ```tsx
 * // In _app.tsx
 * <CharacterSheetsProvider>
 *   <App />
 * </CharacterSheetsProvider>
 * ```
 */
export function CharacterSheetsProvider({ children }: CharacterSheetsProviderProps): JSX.Element {
  const [openSheets, setOpenSheets] = useState<CharacterSheetState[]>([]);
  const [nextZIndex, setNextZIndex] = useState(1000); // Start at 1000 (above content, below global modals)

  /**
   * Open Character Sheet
   *
   * If character already open → restore + focus
   * Else → create new window
   */
  const openCharacterSheet = useCallback((characterId: string, characterName?: string, avatar?: string) => {
    setOpenSheets((prev) => {
      // Check if character already open
      const existingSheet = prev.find((sheet) => sheet.characterId === characterId);

      if (existingSheet) {
        // Restore if minimized, bring to front
        if (existingSheet.isMinimized) {
          const restored = prev.map((sheet) =>
            sheet.id === existingSheet.id
              ? { ...sheet, isMinimized: false, zIndex: nextZIndex }
              : sheet
          );
          setNextZIndex((z) => z + 1);
          return restored;
        }

        // Already open and visible → just focus
        const focused = prev.map((sheet) =>
          sheet.id === existingSheet.id
            ? { ...sheet, zIndex: nextZIndex }
            : sheet
        );
        setNextZIndex((z) => z + 1);
        return focused;
      }

      // Create new window
      const newSheet: CharacterSheetState = {
        id: generateId(),
        characterId,
        characterName: characterName || 'Loading...', // Updated when data loads
        avatar,
        position: getCascadePosition(prev.length),
        isMinimized: false,
        zIndex: nextZIndex
      };

      setNextZIndex((z) => z + 1);
      return [...prev, newSheet];
    });
  }, [nextZIndex]);

  /**
   * Close Character Sheet
   */
  const closeCharacterSheet = useCallback((id: string) => {
    setOpenSheets((prev) => prev.filter((sheet) => sheet.id !== id));
  }, []);

  /**
   * Minimize Character Sheet
   */
  const minimizeCharacterSheet = useCallback((id: string) => {
    setOpenSheets((prev) =>
      prev.map((sheet) =>
        sheet.id === id ? { ...sheet, isMinimized: true } : sheet
      )
    );
  }, []);

  /**
   * Restore Character Sheet
   */
  const restoreCharacterSheet = useCallback((id: string) => {
    setOpenSheets((prev) => {
      const restored = prev.map((sheet) =>
        sheet.id === id
          ? { ...sheet, isMinimized: false, zIndex: nextZIndex }
          : sheet
      );
      setNextZIndex((z) => z + 1);
      return restored;
    });
  }, [nextZIndex]);

  /**
   * Focus Character Sheet
   */
  const focusCharacterSheet = useCallback((id: string) => {
    setOpenSheets((prev) => {
      const focused = prev.map((sheet) =>
        sheet.id === id ? { ...sheet, zIndex: nextZIndex } : sheet
      );
      setNextZIndex((z) => z + 1);
      return focused;
    });
  }, [nextZIndex]);

  /**
   * Update Sheet Position
   */
  const updateSheetPosition = useCallback((id: string, position: { x: number; y: number }) => {
    setOpenSheets((prev) =>
      prev.map((sheet) =>
        sheet.id === id ? { ...sheet, position } : sheet
      )
    );
  }, []);

  const value: CharacterSheetsContextValue = {
    openSheets,
    openCharacterSheet,
    closeCharacterSheet,
    minimizeCharacterSheet,
    restoreCharacterSheet,
    focusCharacterSheet,
    updateSheetPosition
  };

  return (
    <CharacterSheetsContext.Provider value={value}>
      {children}
    </CharacterSheetsContext.Provider>
  );
}

/**
 * useCharacterSheets Hook
 *
 * Access character sheets context.
 *
 * @returns {CharacterSheetsContextValue} Context value
 * @throws {Error} If used outside CharacterSheetsProvider
 * @since 2.0.0
 *
 * @example
 * ```tsx
 * function CharacterProfile() {
 *   const { openCharacterSheet } = useCharacterSheets();
 *
 *   const handleClick = () => {
 *     openCharacterSheet(character._id, character.name, character.avatar);
 *   };
 *
 *   return <div onClick={handleClick}>View Sheet</div>;
 * }
 * ```
 */
export function useCharacterSheets(): CharacterSheetsContextValue {
  const context = useContext(CharacterSheetsContext);

  if (!context) {
    throw new Error('useCharacterSheets must be used within CharacterSheetsProvider');
  }

  return context;
}
