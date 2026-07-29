/**
 * Position Selector Component
 *
 * Modal for selecting sub-chat position.
 * Positions are NOT social media tags - they represent physical positions
 * in the location (e.g., "Tavolo 1", "Bancone", "Angolo Nord").
 *
 * @module components/chat/PositionSelector
 * @since 2.0.0
 */

'use client';

import { useState, useEffect } from 'react';

import styles from '@/styles/components/chat/PositionSelector.module.scss';

/**
 * Position Selector Props
 */
interface PositionSelectorProps {
  /** Currently selected position */
  selectedPosition: string | null;

  /** Available positions for this location (from DB) */
  availablePositions?: string[];

  /** Callback when position is selected */
  onPositionChange: (position: string) => void;

  /** Callback to close modal */
  onClose: () => void;
}

/**
 * Default positions available in most locations
 * (backend doesn't enforce schema, so we provide preset list)
 */
const DEFAULT_POSITIONS = [
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
 * Position Selector Component
 *
 * Simple modal with list of available positions.
 * User MUST select a position before sending messages.
 *
 * @param {PositionSelectorProps} props - Component props
 * @returns {JSX.Element} Position selector modal
 */
export function PositionSelector({
  selectedPosition,
  availablePositions,
  onPositionChange,
  onClose,
}: PositionSelectorProps): JSX.Element {
  // Single source of truth: input text value
  const [customPosition, setCustomPosition] = useState<string>(selectedPosition || '');

  // Use positions from location DB, fallback to DEFAULT_POSITIONS if not set
  const positions = availablePositions && availablePositions.length > 0 ? availablePositions : DEFAULT_POSITIONS;

  /**
   * Handle preset button click - fills input like a shortcut
   */
  const handleSelect = (position: string) => {
    setCustomPosition(position);
  };

  /**
   * Handle custom position input change
   */
  const handleCustomPositionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 50) {
      setCustomPosition(value);
    }
  };

  /**
   * Handle Enter key in input
   */
  const handleCustomPositionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmed = customPosition.trim();
      if (trimmed.length > 0 && trimmed.length <= 50) {
        handleConfirm();
      }
    }
  };

  /**
   * Confirm selection with validation
   */
  const handleConfirm = () => {
    const trimmed = customPosition.trim();
    if (trimmed.length > 0 && trimmed.length <= 50) {
      onPositionChange(trimmed);
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
    <div className={styles.positionSelectorOverlay} onClick={onClose}>
      <div className={styles.positionSelectorModal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.positionSelectorTitle}>Seleziona Posizione</h3>
        <p className={styles.positionSelectorSubtitle}>
          Scegli dove ti trovi nella location. Questa posizione apparirà nei tuoi messaggi.
        </p>

        <div className={styles.positionList}>
          {positions.map((position) => (
            <button
              key={position}
              onClick={() => handleSelect(position)}
              className={`${styles.positionButton} ${customPosition === position ? styles.selected : ''}`}
            >
              {position}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className={styles.customPositionDivider}>
          <span className={styles.customPositionDividerText}>oppure</span>
        </div>

        {/* Input posizione personalizzata */}
        <div className={styles.customPositionSection}>
          <label htmlFor="custom-position-input" className={styles.customPositionLabel}>
            Posizione personalizzata
          </label>
          <input
            id="custom-position-input"
            type="text"
            value={customPosition}
            onChange={handleCustomPositionChange}
            onKeyDown={handleCustomPositionKeyDown}
            placeholder="es. Sala da biliardo..."
            className={styles.customPositionInput}
            maxLength={50}
            aria-invalid={customPosition.length > 0 && customPosition.trim().length === 0}
            aria-describedby={customPosition.length > 0 && customPosition.trim().length === 0 ? 'custom-position-error' : undefined}
          />
          <div className={styles.customPositionHint}>
            <span className={styles.charCount}>{customPosition.length}/50 caratteri</span>
            {customPosition.trim().length === 0 && customPosition.length > 0 && (
              <span id="custom-position-error" role="alert" className={styles.validationError}>
                La posizione non può essere vuota
              </span>
            )}
          </div>
        </div>

        <div className={styles.positionSelectorActions}>
          <button onClick={onClose} className={styles.cancelButton}>
            Annulla
          </button>
          <button
            onClick={handleConfirm}
            disabled={customPosition.trim().length === 0 || customPosition.trim().length > 50}
            className={styles.confirmButton}
          >
            Conferma
          </button>
        </div>
      </div>
    </div>
  );
}
