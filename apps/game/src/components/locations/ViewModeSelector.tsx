/**
 * View Mode Selector Component
 *
 * Floating control buttons for switching between different location views.
 * Positioned in top-left corner of the map.
 *
 * Views:
 * - Mappa: Interactive London map with clickable districts
 * - Testuale: Expandable tree list of all locations
 *
 * @module components/locations/ViewModeSelector
 * @since 2.0.0
 */

'use client';

import styles from '@/styles/components/locations/map.module.scss';

/**
 * View Mode Type
 */
export type ViewMode = 'mappa' | 'testuale';

/**
 * View Mode Selector Props
 */
interface ViewModeSelectorProps {
  /** Current active view mode */
  mode: ViewMode;
  /** Callback when view mode changes */
  onChange: (mode: ViewMode) => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * View Mode Selector Component
 *
 * Renders floating buttons for switching between map, list, and apartments views.
 *
 * @component
 * @param {ViewModeSelectorProps} props - Component props
 * @returns {JSX.Element} View mode selector
 *
 * @example
 * ```tsx
 * <ViewModeSelector
 *   mode="mappa"
 *   onChange={(mode) => setViewMode(mode)}
 * />
 * ```
 */
export function ViewModeSelector({
  mode,
  onChange,
  className = '',
}: ViewModeSelectorProps): JSX.Element {
  return (
    <div className={`${styles.viewModeControls} ${className}`}>
      <button
        type="button"
        className={`${styles.viewButton} ${mode === 'mappa' ? styles.active : ''}`}
        onClick={() => onChange('mappa')}
        aria-label="Vista mappa"
        aria-pressed={mode === 'mappa'}
      >
        Mappa
      </button>

      <button
        type="button"
        className={`${styles.viewButton} ${mode === 'testuale' ? styles.active : ''}`}
        onClick={() => onChange('testuale')}
        aria-label="Vista testuale"
        aria-pressed={mode === 'testuale'}
      >
        Lista
      </button>
    </div>
  );
}
