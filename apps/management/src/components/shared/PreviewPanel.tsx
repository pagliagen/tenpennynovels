/**
 * Simple sliding panel for previewing content
 * Simpler alternative to SidePanel (which is form-based)
 */
import React, { useEffect } from 'react';
import classNames from 'classnames';
import styles from './PreviewPanel.module.scss';

interface PreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: 'medium' | 'large' | 'full';
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = 'large'
}) => {
  // Lock body scroll when panel is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Panel */}
      <div className={classNames(styles.panel, styles[width])}>
        {/* Header */}
        <div className={styles.header}>
          {title && <h2>{title}</h2>}
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </>
  );
};
