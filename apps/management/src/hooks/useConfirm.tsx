/**
 * useConfirm hook - Custom confirm dialog
 *
 * Provides a programmatic way to show confirmation dialogs
 * Alternative to browser's confirm()
 */

import React, { useState, useCallback } from 'react';
import { ConfirmDialog, ConfirmDialogProps } from '@/components/shared/ConfirmDialog';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
}

export interface UseConfirmReturn {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  ConfirmDialogComponent: React.ReactElement | null;
}

export function useConfirm(): UseConfirmReturn {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    options: {
      title: '',
      message: ''
    },
    resolve: null
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        options,
        resolve
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (dialogState.resolve) {
      dialogState.resolve(true);
    }
    setDialogState({
      isOpen: false,
      options: { title: '', message: '' },
      resolve: null
    });
  }, [dialogState.resolve]);

  const handleCancel = useCallback(() => {
    if (dialogState.resolve) {
      dialogState.resolve(false);
    }
    setDialogState({
      isOpen: false,
      options: { title: '', message: '' },
      resolve: null
    });
  }, [dialogState.resolve]);

  const ConfirmDialogComponent = dialogState.isOpen ? (
    <ConfirmDialog
      isOpen={dialogState.isOpen}
      title={dialogState.options.title}
      message={dialogState.options.message}
      confirmLabel={dialogState.options.confirmLabel}
      cancelLabel={dialogState.options.cancelLabel}
      type={dialogState.options.type}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return {
    confirm,
    ConfirmDialogComponent
  };
}
