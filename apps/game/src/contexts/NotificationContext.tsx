import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { createNotificationFromTemplate } from '@/constants/notificationMessages';

// Notification types
export type NotificationType = 
  | 'admin'
  | 'websocket_debug'
  | 'chat_message'
  | 'ingame_message'
  | 'offgame_message'
  | 'character_approved'
  | 'character_rejected'
  | 'player_entered'
  | 'system_message';

export interface NotificationData {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  icon: string;
  timestamp: Date;
  volatile: boolean; // True = disappears after 10 seconds
  duration?: number; // Custom duration in ms (overrides volatile default)
  read: boolean; // True = notification has been read/seen by user
  showBadge: boolean; // True = should contribute to unread badge count
  data?: any; // Additional data for the notification
}

// Notification state
interface NotificationState {
  notifications: NotificationData[];
}

// Actions
type NotificationAction = 
  | { type: 'ADD_NOTIFICATION'; payload: NotificationData }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'MARK_READ'; payload: string }
  | { type: 'MARK_SEEN'; payload: string } // Mark as seen (opened bubble) but not necessarily read
  | { type: 'CLEAR_ALL' };

// Context
interface NotificationContextType {
  state: NotificationState;
  addNotification: (notification: Omit<NotificationData, 'id' | 'timestamp' | 'read'>) => void;
  addNotificationFromTemplate: (type: NotificationType, content: string, overrides?: {
    title?: string;
    icon?: string;
    volatile?: boolean;
    showBadge?: boolean;
    duration?: number;
    data?: any;
  }) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAsSeen: (id: string) => void;
  getUnreadBadgeCount: () => number;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// Reducer
function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return {
        notifications: [...state.notifications, { ...action.payload, read: false }]
      };
    
    case 'REMOVE_NOTIFICATION':
      return {
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };
    
    case 'MARK_READ':
      return {
        notifications: state.notifications.map(n => 
          n.id === action.payload ? { ...n, read: true } : n
        )
      };
    
    case 'MARK_SEEN':
      return {
        notifications: state.notifications.map(n => 
          n.id === action.payload ? { ...n, read: true } : n
        )
      };
    
    case 'CLEAR_ALL':
      return {
        notifications: []
      };
    
    default:
      return state;
  }
}

// Hook
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Provider
interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, {
    notifications: []
  });

  // Add basic notification (without settings integration)
  const addNotification = useCallback((notification: Omit<NotificationData, 'id' | 'timestamp' | 'read'>) => {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullNotification: NotificationData = {
      ...notification,
      id,
      timestamp: new Date(),
      read: false
    };

    dispatch({ type: 'ADD_NOTIFICATION', payload: fullNotification });

    // Auto-remove volatile notifications
    if (notification.volatile) {
      const duration = notification.duration || 10000; // Default 10 seconds
      setTimeout(() => {
        dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
      }, duration);
    }
  }, []);

  // Add notification from template (this is the preferred method)
  const addNotificationFromTemplate = useCallback((
    type: NotificationType, 
    content: string, 
    overrides?: {
      title?: string;
      icon?: string;
      volatile?: boolean;
      showBadge?: boolean;
      duration?: number;
      data?: any;
    }
  ) => {
    const notification = createNotificationFromTemplate(type, content, overrides);
    addNotification(notification);
  }, [addNotification]);

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  const markAsRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_READ', payload: id });
  }, []);

  const markAsSeen = useCallback((id: string) => {
    dispatch({ type: 'MARK_SEEN', payload: id });
  }, []);

  const getUnreadBadgeCount = useCallback(() => {
    return state.notifications.filter(n => !n.read && n.showBadge).length;
  }, [state.notifications]);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const contextValue: NotificationContextType = {
    state,
    addNotification,
    addNotificationFromTemplate,
    removeNotification,
    markAsRead,
    markAsSeen,
    getUnreadBadgeCount,
    clearAll
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};