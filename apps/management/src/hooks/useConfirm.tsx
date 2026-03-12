/**
 * useConfirm hook - Custom confirm dialog
 *
 * Provides a programmatic way to show confirmation dialogs.
 * Alternative to browser's confirm() and prompt().
 *
 * - `confirm()` → Promise<boolean> (backward compatible)
 * - `confirmWithInput()` → Promise<{ confirmed, inputValue }> (with input field)
 */

import React, { useState, useCallback, useRef } from 'react';
import { ConfirmDialog, ConfirmDialogInputConfig } from '@/components/shared/ConfirmDialog';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
}

export interface ConfirmWithInputOptions extends ConfirmOptions {
  input: ConfirmDialogInputConfig;
}

export interface ConfirmWithInputResult {
  confirmed: boolean;
  inputValue?: string;
}

export interface UseConfirmReturn {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  confirmWithInput: (options: ConfirmWithInputOptions) => Promise<ConfirmWithInputResult>;
  ConfirmDialogComponent: React.ReactElement | null;
}

type ResolverFn = (value: { confirmed: boolean; inputValue?: string }) => void;

export function useConfirm(): UseConfirmReturn {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions & { input?: ConfirmDialogInputConfig };
  }>({
    isOpen: false,
    options: { title: '', message: '' }
  });

  const resolverRef = useRef<ResolverFn | null>(null);

  const openDialog = useCallback((options: ConfirmOptions & { input?: ConfirmDialogInputConfig }): Promise<{ confirmed: boolean; inputValue?: string }> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialogState({ isOpen: true, options });
    });
  }, []);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return openDialog(options).then(r => r.confirmed);
  }, [openDialog]);

  const confirmWithInput = useCallback((options: ConfirmWithInputOptions): Promise<ConfirmWithInputResult> => {
    return openDialog(options);
  }, [openDialog]);

  const closeDialog = useCallback(() => {
    setDialogState({ isOpen: false, options: { title: '', message: '' } });
    resolverRef.current = null;
  }, []);

  const handleConfirm = useCallback((inputValue?: string) => {
    resolverRef.current?.({ confirmed: true, inputValue });
    closeDialog();
  }, [closeDialog]);

  const handleCancel = useCallback(() => {
    resolverRef.current?.({ confirmed: false });
    closeDialog();
  }, [closeDialog]);

  const ConfirmDialogComponent = dialogState.isOpen ? (
    <ConfirmDialog
      isOpen={dialogState.isOpen}
      title={dialogState.options.title}
      message={dialogState.options.message}
      confirmLabel={dialogState.options.confirmLabel}
      cancelLabel={dialogState.options.cancelLabel}
      type={dialogState.options.type}
      input={dialogState.options.input}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return {
    confirm,
    confirmWithInput,
    ConfirmDialogComponent
  };
}
