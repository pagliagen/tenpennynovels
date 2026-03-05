/**
 * ConflictResolutionModal
 *
 * Modal for resolving key conflicts when restoring deleted records.
 * Allows user to input new values for conflicting keys (username, email, slug, name).
 */

import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import type { DeletedRecord } from '@/types/api/DeletedRecord';
import styles from './ConflictResolutionModal.module.scss';

interface Props {
  isOpen: boolean;
  record: DeletedRecord | null;
  conflicts: Record<string, boolean>;
  onResolve: (newKeys: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}

export default function ConflictResolutionModal({
  isOpen,
  record,
  conflicts,
  onResolve,
  onCancel
}: Props) {
  const [newKeys, setNewKeys] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && record) {
      setNewKeys({});
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, record]);

  if (!record) return null;

  const conflictKeys = Object.keys(conflicts).filter(key => conflicts[key]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all conflict keys have new values
    const newErrors: Record<string, string> = {};
    for (const key of conflictKeys) {
      if (!newKeys[key] || newKeys[key].trim() === '') {
        newErrors[key] = `Inserisci un nuovo valore per ${key}`;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      await onResolve(newKeys);
      // Success - modal will be closed by parent
    } catch (error: any) {
      // If still conflicts, show error
      if (error.code === 'KEY_CONFLICT') {
        setErrors({
          _general: 'Alcuni valori sono ancora in uso. Prova con valori diversi.'
        });
      } else {
        setErrors({
          _general: error.message || 'Errore durante il ripristino'
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldLabel = (key: string): string => {
    const labels: Record<string, string> = {
      username: 'Username',
      email: 'Email',
      name: 'Nome',
      slug: 'Slug'
    };
    return labels[key] || key;
  };

  const getFieldPlaceholder = (key: string): string => {
    const originalValue = record.originalKeys[key];
    if (key === 'username') return `es. ${originalValue}2`;
    if (key === 'email') return `es. new.${originalValue}`;
    if (key === 'name') return `es. ${originalValue} (nuovo)`;
    if (key === 'slug') return `es. ${originalValue}-new`;
    return `Nuovo ${key}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Risolvi Conflitti Chiavi"
      onClose={onCancel}
      size="medium"
    >
      <div className={styles.conflictModal}>
        <div className={styles.intro}>
          <p>
            Non è possibile ripristinare <strong>{record.displayName}</strong> con i valori originali
            perché alcuni campi sono già utilizzati da altri record.
          </p>
          <p>
            Inserisci nuovi valori per i campi in conflitto:
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.conflicts}>
            {conflictKeys.map(key => (
              <div key={key} className={styles.conflict}>
                <div className={styles.conflictHeader}>
                  <span className={styles.conflictBadge}>⚠️ {getFieldLabel(key)}</span>
                  <span className={styles.originalValue}>
                    Valore originale: <code>{record.originalKeys[key]}</code>
                  </span>
                </div>

                <p className={styles.conflictMessage}>
                  Il valore '{record.originalKeys[key]}' è già utilizzato da un altro record.
                </p>

                <div className={styles.inputGroup}>
                  <label htmlFor={`newKey-${key}`}>
                    Nuovo {getFieldLabel(key)}
                  </label>
                  <input
                    id={`newKey-${key}`}
                    type="text"
                    value={newKeys[key] || ''}
                    onChange={(e) => {
                      setNewKeys({ ...newKeys, [key]: e.target.value });
                      // Clear error on change
                      if (errors[key]) {
                        const newErrors = { ...errors };
                        delete newErrors[key];
                        setErrors(newErrors);
                      }
                    }}
                    placeholder={getFieldPlaceholder(key)}
                    disabled={isSubmitting}
                    className={errors[key] ? styles.inputError : ''}
                    autoFocus={key === conflictKeys[0]}
                  />
                  {errors[key] && (
                    <span className={styles.errorMessage}>{errors[key]}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {errors._general && (
            <div className={styles.generalError}>
              ❌ {errors._general}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Ripristino...' : 'Ripristina con Nuovi Valori'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Annulla
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
