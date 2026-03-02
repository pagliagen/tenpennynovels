/**
 * Notification Store - Zustand store for toast notifications
 */

import { create } from 'zustand';

/**
 * Notification types
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * Notification interface
 */
export interface Notification {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number; // milliseconds, 0 = no auto-dismiss
  action?: {
    label: string;
    handler: () => void;
  };
}

/**
 * Notification state interface
 */
interface NotificationState {
  notifications: Notification[];
}

/**
 * Notification actions interface
 */
interface NotificationActions {
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  // Convenience methods
  success: (message: string, title?: string, duration?: number) => string;
  error: (message: string, title?: string, duration?: number, retryHandler?: () => void) => string;
  warning: (message: string, title?: string, duration?: number) => string;
  info: (message: string, title?: string, duration?: number) => string;
}

/**
 * Notification store type
 */
type NotificationStore = NotificationState & NotificationActions;

/**
 * Generate unique ID
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Create notification store
 */
export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  /**
   * Add notification
   */
  addNotification: (notification) => {
    const id = generateId();
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000 // Default 5 seconds
    };

    set(state => ({
      notifications: [...state.notifications, newNotification]
    }));

    // Auto-dismiss after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  },

  /**
   * Remove notification
   */
  removeNotification: (id) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }));
  },

  /**
   * Clear all notifications
   */
  clearAll: () => {
    set({ notifications: [] });
  },

  /**
   * Success notification
   */
  success: (message, title, duration) => {
    return get().addNotification({
      type: 'success',
      title,
      message,
      duration
    });
  },

  /**
   * Error notification with optional retry
   */
  error: (message, title, duration, retryHandler) => {
    return get().addNotification({
      type: 'error',
      title,
      message,
      duration: duration ?? 0, // Errors don't auto-dismiss by default
      action: retryHandler ? {
        label: 'Riprova',
        handler: retryHandler
      } : undefined
    });
  },

  /**
   * Warning notification
   */
  warning: (message, title, duration) => {
    return get().addNotification({
      type: 'warning',
      title,
      message,
      duration
    });
  },

  /**
   * Info notification
   */
  info: (message, title, duration) => {
    return get().addNotification({
      type: 'info',
      title,
      message,
      duration
    });
  }
}));

/**
 * Selectors
 */
export const selectNotifications = (state: NotificationStore) => state.notifications;
