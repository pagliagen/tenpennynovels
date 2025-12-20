import { useEffect } from 'react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useNotificationSettings } from '@/contexts/NotificationSettingsContext';
import { useGame } from '@/contexts/GameContext';

/**
 * Component to handle notifications when game initializes
 * Must be inside NotificationProvider and GameProvider contexts
 */
export const LoginNotificationHandler: React.FC = () => {
  const { addNotification } = useNotifications();
  const { shouldShowNotification, playAudioForType } = useNotificationSettings();
  const { gameData } = useGame();

  // Enhanced addNotification with settings integration
  const addNotificationWithSettings = async (notification: Parameters<typeof addNotification>[0]) => {
    // Check if this type should be shown
    if (!shouldShowNotification(notification.type)) {
      return;
    }

    // Play audio for this type (if enabled)
    try {
      await playAudioForType(notification.type);
    } catch (error) {
      console.warn(`Failed to play audio for notification type ${notification.type}:`, error);
    }

    // Add the notification
    addNotification(notification);
  };

  useEffect(() => {
    if (!gameData?.notifications) {
      return;
    }

    // Check for unread offgame messages
    const { unreadOffGameMessages } = gameData.notifications;
    
    if (unreadOffGameMessages > 0) {
      const messageText = unreadOffGameMessages === 1 
        ? 'Hai 1 messaggio OOC non letto'
        : `Hai ${unreadOffGameMessages} messaggi OOC non letti`;

      console.log('🔔 LoginNotificationHandler: Showing unread messages notification', { 
        count: unreadOffGameMessages 
      });

      addNotificationWithSettings({
        type: 'offgame_message',
        title: 'Messaggi non letti',
        content: messageText,
        icon: '📱',
        volatile: false, // Keep persistent so user sees it
        showBadge: true,
        data: { count: unreadOffGameMessages }
      });
    }
  }, [gameData?.notifications, addNotificationWithSettings]);

  // This component renders nothing, it just handles side effects
  return null;
};