import { NotificationType } from '@/contexts/NotificationContext';

// Notification message templates
export interface NotificationTemplate {
  type: NotificationType;
  defaultTitle: string;
  defaultIcon: string;
  volatile: boolean;
  showBadge: boolean;
  defaultDuration?: number;
}

// Default notification templates
export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  admin: {
    type: 'admin',
    defaultTitle: 'Messaggio Amministrativo',
    defaultIcon: '👑',
    volatile: false,
    showBadge: true
  },
  
  websocket_debug: {
    type: 'websocket_debug',
    defaultTitle: 'Debug WebSocket',
    defaultIcon: '🔧',
    volatile: true,
    showBadge: false,
    defaultDuration: 5000
  },
  
  chat_message: {
    type: 'chat_message',
    defaultTitle: 'Nuovo Messaggio Chat',
    defaultIcon: '💬',
    volatile: true,
    showBadge: true,
    defaultDuration: 8000
  },
  
  ingame_message: {
    type: 'ingame_message',
    defaultTitle: 'Messaggio In-Game',
    defaultIcon: '📜',
    volatile: false,
    showBadge: true
  },
  
  offgame_message: {
    type: 'offgame_message',
    defaultTitle: 'Messaggio Fuori Gioco',
    defaultIcon: '📱',
    volatile: true,
    showBadge: true,
    defaultDuration: 10000
  },
  
  character_approved: {
    type: 'character_approved',
    defaultTitle: 'Personaggio Approvato',
    defaultIcon: '✅',
    volatile: false,
    showBadge: true
  },
  
  character_rejected: {
    type: 'character_rejected',
    defaultTitle: 'Personaggio Respinto',
    defaultIcon: '❌',
    volatile: false,
    showBadge: true
  },
  
  player_entered: {
    type: 'player_entered',
    defaultTitle: 'Giocatore Entrato',
    defaultIcon: '🚪',
    volatile: true,
    showBadge: false,
    defaultDuration: 6000
  },
  
  system_message: {
    type: 'system_message',
    defaultTitle: 'Messaggio di Sistema',
    defaultIcon: '⚙️',
    volatile: true,
    showBadge: true,
    defaultDuration: 12000
  }
};

// Helper function to get template for notification type
export const getNotificationTemplate = (type: NotificationType): NotificationTemplate => {
  return NOTIFICATION_TEMPLATES[type];
};

// Helper function to create notification with template defaults
export const createNotificationFromTemplate = (
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
  const template = getNotificationTemplate(type);
  
  return {
    type,
    title: overrides?.title || template.defaultTitle,
    content,
    icon: overrides?.icon || template.defaultIcon,
    volatile: overrides?.volatile !== undefined ? overrides.volatile : template.volatile,
    showBadge: overrides?.showBadge !== undefined ? overrides.showBadge : template.showBadge,
    duration: overrides?.duration || template.defaultDuration,
    data: overrides?.data
  };
};