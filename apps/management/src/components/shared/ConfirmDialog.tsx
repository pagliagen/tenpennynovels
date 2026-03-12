/**
 * ConfirmDialog - Custom confirmation dialog
 *
 * NO browser confirm() - sempre usare questo componente.
 * Supporta un campo input opzionale (es. motivo del rifiuto).
 */

import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import styles from '@/styles/components/ConfirmDialog.module.scss';
import classNames from 'classnames';

export interface ConfirmDialogInputConfig {
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
  input?: ConfirmDialogInputConfig;
  onConfirm: (inputValue?: string) => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  type = 'info',
  input,
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (!isOpen) setInputValue('');
  }, [isOpen]);

  const isConfirmDisabled = input?.required && inputValue.trim().length === 0;

  const handleConfirm = () => {
    onConfirm(input ? inputValue.trim() : undefined);
  };

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

        {input && (
          <div className={styles.inputWrapper}>
            {input.multiline ? (
              <textarea
                className={styles.input}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={input.placeholder}
                rows={3}
                autoFocus
              />
            ) : (
              <input
                type="text"
                className={styles.input}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={input.placeholder}
                autoFocus
              />
            )}
          </div>
        )}

        <div className={styles.actions}>
          <button
            onClick={onCancel}
            className={styles.cancelButton}
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={classNames(styles.confirmButton, styles[type])}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
