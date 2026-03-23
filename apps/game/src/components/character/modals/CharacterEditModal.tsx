/**
 * Character Edit Modal
 *
 * Generic modal container for character editing.
 * Renders tab-specific forms based on modalType prop.
 *
 * @module components/character/modals/CharacterEditModal
 * @since 3.0.0
 */

'use client';

import { ReactNode } from 'react';

import styles from '@/styles/components/character/CharacterEditModal.module.scss';

/**
 * Character Edit Modal Props
 */
export interface CharacterEditModalProps {
  /** Modal title */
  title: string;

  /** Whether modal is open */
  isOpen: boolean;

  /** Form content (tab-specific) */
  children: ReactNode;

  /** Handle close */
  onClose: () => void;
}

/**
 * Character Edit Modal Component
 *
 * Reusable modal container for character editing forms.
 * Forms are passed as children for modularity.
 *
 * @component
 * @param {CharacterEditModalProps} props - Component props
 * @returns {JSX.Element | null} Modal overlay
 */
export function CharacterEditModal({
  title,
  isOpen,
  children,
  onClose,
}: CharacterEditModalProps): JSX.Element | null {
  if (!isOpen) return null;

  /**
   * Handle overlay click (close modal)
   */
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Close only if clicking overlay, not modal content
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  /**
   * Handle Escape key
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={styles.modalContent}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 id="modal-title" className={styles.modalTitle}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Body (form content) */}
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}
