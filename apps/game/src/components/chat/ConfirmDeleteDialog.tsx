/**
 * ConfirmDeleteDialog
 *
 * Modal dialog for confirming message deletion.
 * Victorian-themed overlay with confirmation buttons.
 */

import { useEffect } from 'react';
import styles from '@/styles/components/chat/ConfirmDeleteDialog.module.scss';

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteDialog({
  isOpen,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={styles.confirmDialogBackdrop}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className={styles.confirmDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
      >
        <h3 id="confirm-delete-title" className={styles.confirmDialogTitle}>
          Conferma eliminazione
        </h3>

        <p className={styles.confirmDialogMessage}>
          Sei sicuro di voler eliminare questo messaggio?
          <br />
          <span className={styles.confirmDialogWarning}>
            Questa azione non può essere annullata.
          </span>
        </p>

        <div className={styles.confirmDialogActions}>
          <button
            className={styles.confirmDialogButtonCancel}
            onClick={onCancel}
            type="button"
          >
            Annulla
          </button>
          <button
            className={styles.confirmDialogButtonConfirm}
            onClick={onConfirm}
            type="button"
            autoFocus
          >
            Conferma
          </button>
        </div>
      </div>
    </>
  );
}
