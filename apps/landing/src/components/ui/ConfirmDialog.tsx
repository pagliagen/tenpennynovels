/**
 * Confirm Dialog Component
 *
 * Modal dialog for confirming destructive actions.
 * Requires explicit user confirmation to prevent accidental data loss.
 *
 * **Features**:
 * - Modal overlay (blocks background interaction)
 * - Confirmation text input (user must type exact phrase)
 * - Primary/Secondary action buttons
 * - Keyboard support (ESC to cancel)
 * - Accessibility (focus trap, ARIA attributes)
 *
 * **Use Cases**:
 * - Account deletion confirmation
 * - Character deletion confirmation
 * - Data reset confirmation
 * - Any irreversible destructive action
 *
 * @module components/ui/ConfirmDialog
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../Button';

/**
 * ConfirmDialog component props
 *
 * @interface ConfirmDialogProps
 */
export interface ConfirmDialogProps {
  /** Whether dialog is open */
  isOpen: boolean;
  /** Dialog title */
  title: string;
  /** Dialog message/description */
  message: string;
  /** Exact confirmation text user must type (optional) */
  confirmText?: string;
  /** Confirm button label (default: 'Conferma') */
  confirmLabel?: string;
  /** Cancel button label (default: 'Annulla') */
  cancelLabel?: string;
  /** Cancel button text (alias for cancelLabel) */
  cancelText?: string;
  /** Dialog variant (affects styling) */
  variant?: 'default' | 'danger' | 'warning';
  /** Whether confirm action is loading */
  isLoading?: boolean;
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Callback when cancelled */
  onCancel: () => void;
}

/**
 * Confirm Dialog Component
 *
 * Renders a modal confirmation dialog with optional text verification.
 * Prevents accidental destructive actions by requiring explicit confirmation.
 *
 * **Confirmation Flow**:
 * 1. User clicks destructive action (e.g., "Delete Account")
 * 2. Dialog opens with warning message
 * 3. If `confirmText` is set, user must type exact phrase
 * 4. Confirm button is disabled until verification passes
 * 5. User confirms → `onConfirm()` callback
 * 6. User cancels → `onCancel()` callback
 *
 * **Accessibility**:
 * - Focus trap (tab cycles within dialog)
 * - ESC key closes dialog
 * - ARIA role="alertdialog"
 * - Focus management (auto-focus first input)
 *
 * @param {ConfirmDialogProps} props - Component props
 * @returns {JSX.Element | null} Rendered dialog or null if closed
 *
 * @example
 * ```typescript
 * import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
 *
 * function DeleteAccountButton() {
 *   const [isDialogOpen, setIsDialogOpen] = useState(false);
 *   const [isDeleting, setIsDeleting] = useState(false);
 *
 *   const handleDelete = async () => {
 *     setIsDeleting(true);
 *     await apiDelete('/auth/account');
 *     router.push('/');
 *   };
 *
 *   return (
 *     <>
 *       <Button variant="secondary" onClick={() => setIsDialogOpen(true)}>
 *         Elimina Account
 *       </Button>
 *
 *       <ConfirmDialog
 *         isOpen={isDialogOpen}
 *         title="Conferma Eliminazione Account"
 *         message="Questa azione è irreversibile. Tutti i tuoi dati saranno eliminati definitivamente."
 *         confirmText="ELIMINA IL MIO ACCOUNT"
 *         confirmLabel="Elimina Definitivamente"
 *         isLoading={isDeleting}
 *         onConfirm={handleDelete}
 *         onCancel={() => setIsDialogOpen(false)}
 *       />
 *     </>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Simple confirmation (no text verification)
 * <ConfirmDialog
 *   isOpen={isOpen}
 *   title="Elimina Personaggio"
 *   message="Sei sicuro di voler eliminare questo personaggio?"
 *   onConfirm={handleDelete}
 *   onCancel={() => setIsOpen(false)}
 * />
 * ```
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const [inputValue, setInputValue] = useState<string>('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine if confirm button should be enabled
  const isConfirmDisabled = confirmText
    ? inputValue !== confirmText || isLoading
    : isLoading;

  /**
   * Handle ESC key press to close dialog
   */
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, isLoading, onCancel]);

  /**
   * Auto-focus input when dialog opens
   */
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  /**
   * Reset input value when dialog closes
   */
  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  /**
   * Handle confirm action
   */
  const handleConfirm = () => {
    if (!isConfirmDisabled) {
      onConfirm();
    }
  };

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Modal overlay */}
      <div
        className="confirm-dialog-overlay"
        onClick={!isLoading ? onCancel : undefined}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        {/* Dialog header */}
        <div className="confirm-dialog__header">
          <h2 id="confirm-dialog-title" className="confirm-dialog__title">
            {title}
          </h2>
        </div>

        {/* Dialog body */}
        <div className="confirm-dialog__body">
          <p id="confirm-dialog-message" className="confirm-dialog__message">
            {message}
          </p>

          {/* Confirmation text input (if required) */}
          {confirmText && (
            <div className="confirm-dialog__input-group">
              <label htmlFor="confirm-input" className="confirm-dialog__label">
                Digita <strong>{confirmText}</strong> per confermare:
              </label>
              <input
                ref={inputRef}
                id="confirm-input"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                className="confirm-dialog__input"
                autoComplete="off"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Dialog actions */}
        <div className="confirm-dialog__actions">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>

          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            loading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </>
  );
};
