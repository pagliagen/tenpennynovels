import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

// Prompt state
interface PromptState {
  isOpen: boolean;
  title: string;
  defaultValue: string;
  resolve: ((value: string | null) => void) | null;
}

// Context type
interface NotificationContextType {
  toasts: Toast[];
  showToast: (message: string, type: ToastType, duration?: number) => void;
  dismissToast: (id: string) => void;
  showPrompt: (title: string, defaultValue?: string) => Promise<string | null>;
  promptState: PromptState;
  handlePromptConfirm: (value: string) => void;
  handlePromptCancel: () => void;
}

// Create context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Default durations
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 5000,
  error: 7000,
  warning: 6000,
  info: 5000,
};

// Max visible toasts
const MAX_VISIBLE_TOASTS = 3;

// Provider component
export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [promptState, setPromptState] = useState<PromptState>({
    isOpen: false,
    title: '',
    defaultValue: '',
    resolve: null,
  });

  // Show toast notification
  const showToast = useCallback((message: string, type: ToastType, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toastDuration = duration || DEFAULT_DURATIONS[type];

    const newToast: Toast = {
      id,
      message,
      type,
      duration: toastDuration,
    };

    setToasts((prev) => {
      // Keep only the most recent MAX_VISIBLE_TOASTS
      const updated = [newToast, ...prev];
      return updated.slice(0, MAX_VISIBLE_TOASTS);
    });

    // Auto-dismiss after duration
    setTimeout(() => {
      dismissToast(id);
    }, toastDuration);
  }, []);

  // Dismiss toast
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Show prompt modal
  const showPrompt = useCallback((title: string, defaultValue: string = 'Aggiornamento Manutenzione'): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptState({
        isOpen: true,
        title,
        defaultValue,
        resolve,
      });
    });
  }, []);

  // Handle prompt confirm
  const handlePromptConfirm = useCallback((value: string) => {
    if (promptState.resolve) {
      promptState.resolve(value);
    }
    setPromptState({
      isOpen: false,
      title: '',
      defaultValue: '',
      resolve: null,
    });
  }, [promptState]);

  // Handle prompt cancel
  const handlePromptCancel = useCallback(() => {
    if (promptState.resolve) {
      promptState.resolve(null);
    }
    setPromptState({
      isOpen: false,
      title: '',
      defaultValue: '',
      resolve: null,
    });
  }, [promptState]);

  const value: NotificationContextType = {
    toasts,
    showToast,
    dismissToast,
    showPrompt,
    promptState,
    handlePromptConfirm,
    handlePromptCancel,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook
export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};
