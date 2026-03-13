/**
 * Tag Selector Component
 *
 * Modal for selecting sub-chat position (tag).
 * Tags are NOT social media tags - they represent physical positions
 * in the location (e.g., "Tavolo 1", "Bancone", "Angolo Nord").
 *
 * @module components/chat/TagSelector
 * @since 2.0.0
 */

'use client';

import { useState, useEffect } from 'react';
import styles from '@/styles/components/chat/TagSelector.module.scss';

/**
 * Tag Selector Props
 */
interface TagSelectorProps {
  /** Currently selected tag */
  selectedTag: string | null;

  /** Available positions for this location (from DB) */
  availablePositions?: string[];

  /** Callback when tag is selected */
  onTagChange: (tag: string) => void;

  /** Callback to close modal */
  onClose: () => void;
}

/**
 * Default tags available in most locations
 * (backend doesn't enforce schema, so we provide preset list)
 */
const DEFAULT_TAGS = [
  'Tavolo 1',
  'Tavolo 2',
  'Tavolo 3',
  'Bancone',
  'Angolo Nord',
  'Angolo Sud',
  'Ingresso',
  'Sala Principale',
];

/**
 * Tag Selector Component
 *
 * Simple modal with list of available tags.
 * User MUST select a tag before sending messages.
 *
 * @param {TagSelectorProps} props - Component props
 * @returns {JSX.Element} Tag selector modal
 */
export function TagSelector({
  selectedTag,
  availablePositions,
  onTagChange,
  onClose,
}: TagSelectorProps): JSX.Element {
  const [localTag, setLocalTag] = useState<string>(selectedTag || '');

  // Use positions from location DB, fallback to DEFAULT_TAGS if not set
  const positions = availablePositions && availablePositions.length > 0 ? availablePositions : DEFAULT_TAGS;

  /**
   * Handle tag selection
   */
  const handleSelect = (tag: string) => {
    setLocalTag(tag);
  };

  /**
   * Confirm selection
   */
  const handleConfirm = () => {
    if (localTag) {
      onTagChange(localTag);
      onClose();
    }
  };

  /**
   * Close modal on Escape key
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.tagSelectorOverlay} onClick={onClose}>
      <div className={styles.tagSelectorModal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.tagSelectorTitle}>Seleziona Posizione</h3>
        <p className={styles.tagSelectorSubtitle}>
          Scegli dove ti trovi nella location. Questa posizione apparirà nei tuoi messaggi.
        </p>

        <div className={styles.tagList}>
          {positions.map((tag) => (
            <button
              key={tag}
              onClick={() => handleSelect(tag)}
              className={`${styles.tagButton} ${localTag === tag ? styles.selected : ''}`}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className={styles.tagSelectorActions}>
          <button onClick={onClose} className={styles.cancelButton}>
            Annulla
          </button>
          <button onClick={handleConfirm} disabled={!localTag} className={styles.confirmButton}>
            Conferma
          </button>
        </div>
      </div>
    </div>
  );
}
