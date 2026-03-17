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
  // Single source of truth: input text value
  const [customTag, setCustomTag] = useState<string>(selectedTag || '');

  // Use positions from location DB, fallback to DEFAULT_TAGS if not set
  const positions = availablePositions && availablePositions.length > 0 ? availablePositions : DEFAULT_TAGS;

  /**
   * Handle preset button click - fills input like a shortcut
   */
  const handleSelect = (tag: string) => {
    setCustomTag(tag);
  };

  /**
   * Handle custom tag input change
   */
  const handleCustomTagChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 50) {
      setCustomTag(value);
    }
  };

  /**
   * Handle Enter key in input
   */
  const handleCustomTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmed = customTag.trim();
      if (trimmed.length > 0 && trimmed.length <= 50) {
        handleConfirm();
      }
    }
  };

  /**
   * Confirm selection with validation
   */
  const handleConfirm = () => {
    const trimmed = customTag.trim();
    if (trimmed.length > 0 && trimmed.length <= 50) {
      onTagChange(trimmed);
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
              className={`${styles.tagButton} ${customTag === tag ? styles.selected : ''}`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className={styles.customTagDivider}>
          <span className={styles.customTagDividerText}>oppure</span>
        </div>

        {/* Input tag personalizzato */}
        <div className={styles.customTagSection}>
          <label htmlFor="custom-tag-input" className={styles.customTagLabel}>
            Tag personalizzato
          </label>
          <input
            id="custom-tag-input"
            type="text"
            value={customTag}
            onChange={handleCustomTagChange}
            onKeyDown={handleCustomTagKeyDown}
            placeholder="es. Sala da biliardo..."
            className={styles.customTagInput}
            maxLength={50}
            aria-invalid={customTag.length > 0 && customTag.trim().length === 0}
            aria-describedby={customTag.length > 0 && customTag.trim().length === 0 ? 'custom-tag-error' : undefined}
          />
          <div className={styles.customTagHint}>
            <span className={styles.charCount}>{customTag.length}/50 caratteri</span>
            {customTag.trim().length === 0 && customTag.length > 0 && (
              <span id="custom-tag-error" role="alert" className={styles.validationError}>
                Il tag non può essere vuoto
              </span>
            )}
          </div>
        </div>

        <div className={styles.tagSelectorActions}>
          <button onClick={onClose} className={styles.cancelButton}>
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            disabled={customTag.trim().length === 0 || customTag.trim().length > 50}
            className={styles.confirmButton}
          >
            Conferma
          </button>
        </div>
      </div>
    </div>
  );
}
