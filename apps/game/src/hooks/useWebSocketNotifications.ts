import { useEffect } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useNotificationSettings } from '@/contexts/NotificationSettingsContext';
import { useGame } from '@/contexts/GameContext';

export const useWebSocketNotifications = () => {
  const { onLocationEvent, onLocationAction, onPresenceUpdate, onCharacterStatusChange } = useWebSocket();
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
    // Listen to location events (player entered/left)
    const unsubscribeLocationEvents = onLocationEvent((event) => {
      // Don't notify about own actions
      if (event.characterId === gameData.character?.id) {
        return;
      }

      if (event.type === 'player_entered') {
        addNotificationWithSettings({
          type: 'player_entered',
          title: 'Nuovo arrivo',
          content: `${event.characterName} è entrato nella location`,
          icon: '👋',
          volatile: true,
          duration: 5000,
          showBadge: false // Presence notifications don't need badge
        });
      } else if (event.type === 'player_left') {
        addNotificationWithSettings({
          type: 'player_entered', // Same type for consistency
          title: 'Partenza',
          content: `${event.characterName} ha lasciato la location`,
          icon: '👋',
          volatile: true,
          duration: 5000,
          showBadge: false // Presence notifications don't need badge
        });
      }
    });

    // Listen to location actions (chat messages)
    const unsubscribeLocationActions = onLocationAction((notification) => {
      // Don't notify about own messages
      if (notification.characterName === gameData.character?.name) {
        return;
      }

      // Only notify for certain action types
      const notifiableTypes = ['standard', 'whisper', 'dice_generic', 'dice_action'];
      if (notifiableTypes.includes(notification.actionType)) {
        addNotificationWithSettings({
          type: 'chat_message',
          title: 'Nuovo messaggio',
          content: `${notification.characterName} ha scritto in chat`,
          icon: '💬',
          volatile: true,
          duration: 8000,
          showBadge: true // Chat messages should show badge
        });
      }
    });

    // Listen to global presence updates
    const unsubscribePresenceUpdates = onPresenceUpdate((update) => {
      // Don't notify about own status
      if (update.characterId === gameData.character?.id) {
        return;
      }

      if (update.status === 'online') {
        addNotificationWithSettings({
          type: 'player_entered',
          title: 'Utente online',
          content: `${update.characterName} è ora online`,
          icon: '🟢',
          volatile: true,
          duration: 3000,
          showBadge: false // Online status notifications don't need badge
        });
      }
    });

    // Listen to character status changes (approval/rejection)
    const unsubscribeCharacterStatusChanges = onCharacterStatusChange((notification) => {
      // Only notify about our own character
      if (notification.characterId !== gameData.character?.id) {
        return;
      }

      if (notification.action === 'approve') {
        addNotificationWithSettings({
          type: 'character_approved',
          title: 'Personaggio Approvato! ✅',
          content: notification.message,
          icon: '✅',
          volatile: false,
          showBadge: true // Character approval should show badge
        });
      } else if (notification.action === 'reject') {
        addNotificationWithSettings({
          type: 'character_rejected',
          title: 'Personaggio Respinto ❌',
          content: notification.message,
          icon: '❌',
          volatile: false,
          showBadge: true // Character rejection should show badge
        });
      }
    });

    // Cleanup subscriptions
    return () => {
      unsubscribeLocationEvents();
      unsubscribeLocationActions();
      unsubscribePresenceUpdates();
      unsubscribeCharacterStatusChanges();
    };
  }, [onLocationEvent, onLocationAction, onPresenceUpdate, onCharacterStatusChange, addNotificationWithSettings, gameData.character]);

  // Function to add test notifications (for development)
  const addTestNotifications = () => {
    addNotificationWithSettings({
      type: 'system_message',
      title: 'Manutenzione Programmata',
      content: 'Il server sarà offline domani dalle 14:00 alle 16:00 per manutenzione',
      icon: '📢',
      volatile: false,
      showBadge: true // System messages should show badge
    });

    addNotificationWithSettings({
      type: 'character_approved',
      title: 'Personaggio Approvato',
      content: 'Il tuo personaggio è stato approvato dallo staff!',
      icon: '✅',
      volatile: false,
      showBadge: true // Character approval should show badge
    });

    addNotificationWithSettings({
      type: 'ingame_message',
      title: 'Nuova Lettera',
      content: 'Hai ricevuto una lettera da Lord Blackwood',
      icon: '✉️',
      volatile: false,
      showBadge: true // In-game messages should show badge
    });

    addNotificationWithSettings({
      type: 'offgame_message',
      title: 'Messaggio OOC',
      content: 'Ti ha scritto Alice: "Ciao, ci vediamo stasera?"',
      icon: '📱',
      volatile: true,
      duration: 10000,
      showBadge: true // Off-game messages should show badge
    });
  };

  return {
    addTestNotifications
  };
};