import { useCallback } from 'react';
import { useNotifications, NotificationData, NotificationType } from '@/contexts/NotificationContext';
import { useNotificationSettings } from '@/contexts/NotificationSettingsContext';
import { createNotificationFromTemplate } from '@/constants/notificationMessages';

/**
 * Hook that integrates notifications with user settings
 * Handles filtering and audio based on user preferences
 */
export const useNotificationsWithSettings = () => {
  const { 
    state, 
    addNotification: baseAddNotification,
    addNotificationFromTemplate: baseAddFromTemplate,
    markAsSeen, 
    markAsRead, 
    getUnreadBadgeCount, 
    clearAll, 
    removeNotification 
  } = useNotifications();
  
  const { 
    shouldShowNotification, 
    shouldPlayAudio, 
    playAudioForType,
    settings 
  } = useNotificationSettings();

  // Add notification with settings filtering and audio
  const addNotificationWithSettings = useCallback((notification: Omit<NotificationData, 'id' | 'timestamp' | 'read'>) => {
    // Check if this type of notification should be shown
    if (!shouldShowNotification(notification.type)) {
      return; // Don't add notification if filtered out
    }

    // Apply settings duration if not specified
    const notificationWithSettings = {
      ...notification,
      duration: notification.duration || settings.notificationDuration
    };

    // Play audio if enabled for this type
    if (shouldPlayAudio(notification.type)) {
      playAudioForType(notification.type).catch(error => {
        console.warn(`Failed to play audio for ${notification.type}:`, error);
      });
    }

    // Add to notifications
    baseAddNotification(notificationWithSettings);
  }, [shouldShowNotification, shouldPlayAudio, playAudioForType, settings.notificationDuration, baseAddNotification]);

  // Add notification from template with settings integration
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
    // Check if this type of notification should be shown
    if (!shouldShowNotification(type)) {
      return; // Don't add notification if filtered out
    }

    // Create notification with template and apply settings
    const notification = createNotificationFromTemplate(type, content, {
      ...overrides,
      duration: overrides?.duration || settings.notificationDuration
    });

    // Play audio if enabled for this type
    if (shouldPlayAudio(type)) {
      playAudioForType(type).catch(error => {
        console.warn(`Failed to play audio for ${type}:`, error);
      });
    }

    // Add to notifications
    baseAddNotification(notification);
  }, [shouldShowNotification, shouldPlayAudio, playAudioForType, settings.notificationDuration, baseAddNotification]);

  // Filter notifications based on settings
  const filteredNotifications = state.notifications.filter(notification => 
    shouldShowNotification(notification.type)
  );

  // Apply max notifications limit
  const limitedNotifications = filteredNotifications.slice(-settings.maxNotifications);

  return {
    // State with filtered notifications
    state: {
      ...state,
      notifications: limitedNotifications
    },
    // Functions with settings integration
    addNotification: addNotificationWithSettings,
    addNotificationFromTemplate,
    markAsSeen,
    markAsRead,
    getUnreadBadgeCount,
    clearAll,
    removeNotification,
    // Settings integration
    isNotificationBarVisible: settings.showNotificationBar,
    settings
  };
};