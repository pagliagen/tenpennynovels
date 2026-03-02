/**
 * ConfirmDialog - Custom confirmation dialog
 *
 * NO browser confirm() - sempre usare questo componente
 */

import React from 'react';
import { Modal } from './Modal';
import styles from '@/styles/components/ConfirmDialog.module.scss';
import classNames from 'classnames';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  type = 'info',
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.ReactElement {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="small"
      closeOnBackdropClick={false}
      showCloseButton={false}
    >
      <div className={styles.confirmDialog}>
        <div className={classNames(styles.message, styles[type])}>
          {message}
        </div>
        <div className={styles.actions}>
          <button
            onClick={onCancel}
            className={styles.cancelButton}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={classNames(styles.confirmButton, styles[type])}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
