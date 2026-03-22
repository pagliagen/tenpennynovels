/**
 * Minimized Windows Bar Component
 *
 * Fixed bottom bar showing minimized windows.
 * Appears within mainContent section (not full-page footer).
 *
 * @module components/windows/MinimizedWindowsBar
 * @since 2.0.0
 */

'use client';

import { useWindowManagerStore } from '@/store/windowManagerStore';
import styles from '@/styles/components/windows/MinimizedWindowsBar.module.scss';
import { WindowState } from '@/types/window-manager';

/**
 * Get Window Title Helper
 *
 * @param {WindowState} window - Window state
 * @returns {string} Window title
 */
function getWindowTitle(window: WindowState): string {
  switch (window.type) {
    case 'characterSheet':
      return window.data.type === 'characterSheet'
        ? window.data.characterName || 'Loading...'
        : 'Character Sheet';
    case 'messageOnGame':
      return window.data.type === 'messageOnGame'
        ? window.data.conversationTitle || 'Messaggio IN-GAME'
        : 'Messaggio IN-GAME';
    case 'messageOffGame':
      return window.data.type === 'messageOffGame'
        ? window.data.conversationTitle || 'Messaggio OFF-GAME'
        : 'Messaggio OFF-GAME';
    case 'utility':
      if (window.data.type === 'utility') {
        switch (window.data.utilityName) {
          case 'character-directory':
            return '📖 Anagrafica Personaggi';
          case 'character-faceclaim':
            return '🎭 Gestione Prestavolto';
          default:
            return window.data.utilityName;
        }
      }
      return 'Utility';
    default:
      return 'Window';
  }
}

/**
 * Minimized Windows Bar Component
 *
 * Shows minimized windows in a horizontal bar at bottom of mainContent.
 *
 * @component
 * @returns {JSX.Element | null} Minimized bar or null if no minimized windows
 * @since 2.0.0
 *
 * @example
 * ```tsx
 * // In MainLayout
 * <MinimizedWindowsBar />
 * ```
 */
export function MinimizedWindowsBar(): JSX.Element | null {
  const { windows, restoreWindow, closeWindow } = useWindowManagerStore();

  // Only show minimized windows
  const minimizedWindows = windows.filter((w) => w.isMinimized);

  if (minimizedWindows.length === 0) {
    return null;
  }

  return (
    <div className={styles.minimizedBar}>
      {minimizedWindows.map((window) => (
        <div key={window.id} className={styles.minimizedWindow}>
          {/* Icon/Avatar varies by window type */}
          <div className={styles.icon}>
            {window.type === 'characterSheet' && window.data.type === 'characterSheet' && (
              <img
                src={window.data.avatar || '/images/sidebar/miniavatar_default.png'}
                alt={window.data.characterName || 'Character'}
                className={styles.avatar}
              />
            )}

            {window.type === 'messageOnGame' && <span className={styles.emoji}>💬</span>}

            {window.type === 'messageOffGame' && <span className={styles.emoji}>📧</span>}

            {window.type === 'utility' && window.data.type === 'utility' && (
              <span className={styles.emoji}>
                {window.data.utilityName === 'character-directory' ? '👥' :
                 window.data.utilityName === 'character-faceclaim' ? '🎭' : '🔧'}
              </span>
            )}
          </div>

          {/* Title */}
          <span className={styles.title}>{getWindowTitle(window)}</span>

          {/* Actions */}
          <div className={styles.actions}>
            <button
              className={styles.restoreBtn}
              onClick={() => restoreWindow(window.id)}
              aria-label="Restore"
              title="Restore"
            >
              <span>↑</span>
            </button>

            <button
              className={styles.closeBtn}
              onClick={() => closeWindow(window.id)}
              aria-label="Close"
              title="Close"
            >
              <span>×</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
