import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './shared/Modal';
import { useNotification } from '../contexts/NotificationContext';
import styles from '../styles/PromptModal.module.scss';

const MIN_CHARS = 5;
const MAX_CHARS = 500;

export const PromptModal: React.FC = () => {
  const { promptState, handlePromptConfirm, handlePromptCancel } = useNotification();
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize value when modal opens
  useEffect(() => {
    if (promptState.isOpen) {
      setValue(promptState.defaultValue);

      // Focus textarea after modal renders
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }, 150);
    }
  }, [promptState.isOpen, promptState.defaultValue]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // CTRL+Enter to confirm
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (isValid) {
        handleConfirm();
      }
    }
  };

  const handleConfirm = () => {
    if (value.trim().length >= MIN_CHARS) {
      handlePromptConfirm(value.trim());
      setValue('');
    }
  };

  const handleCancel = () => {
    handlePromptCancel();
    setValue('');
  };

  const isValid = value.trim().length >= MIN_CHARS;
  const charCount = value.length;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <Modal
      isOpen={promptState.isOpen}
      onClose={handleCancel}
      title={promptState.title}
      size="medium"
      closeOnEscape={true}
      closeOnOverlayClick={false}
      actions={[
        {
          label: 'Annulla',
          onClick: handleCancel,
          variant: 'secondary',
        },
        {
          label: 'Conferma',
          onClick: handleConfirm,
          variant: 'primary',
          disabled: !isValid || isOverLimit,
        },
      ]}
    >
      <div className={styles.promptContent}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className={styles.textarea}
          rows={4}
          maxLength={MAX_CHARS}
          placeholder="Inserisci il motivo dell'operazione..."
          aria-label="Motivo dell'operazione"
        />

        <div className={styles.footer}>
          <div className={styles.charCounter}>
            <span className={isOverLimit ? styles.overLimit : ''}>
              {charCount}/{MAX_CHARS}
            </span>
          </div>

          {!isValid && value.length > 0 && (
            <div className={styles.validation}>
              Minimo {MIN_CHARS} caratteri richiesti
            </div>
          )}

          <div className={styles.hint}>
            Suggerimento: Premi CTRL+Invio per confermare rapidamente
          </div>
        </div>
      </div>
    </Modal>
  );
};
