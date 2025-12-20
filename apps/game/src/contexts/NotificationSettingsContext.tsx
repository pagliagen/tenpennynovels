import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DEFAULT_AUDIO_ASSIGNMENTS, playAudioFile } from '@/constants/audioFiles';

// Notification settings interface
export interface NotificationSettings {
  // General settings
  showNotificationBar: boolean;
  audioEnabled: boolean;
  
  // Granular notification type settings
  showChatMessages: boolean;
  showInGameMessages: boolean;
  showOffGameMessages: boolean;
  showCharacterApproval: boolean;
  showPlayerPresence: boolean;
  showSystemMessages: boolean;
  
  // Audio settings per type (replaced with audio file assignments)
  audioAssignments: Record<string, string>; // notification type -> audio file ID
  
  // Display settings
  notificationDuration: number; // Default duration for volatile notifications
  maxNotifications: number; // Maximum number of notifications to keep
  
  // Admin panel settings
  adminPanelOpenMode: 'new_tab' | 'popup'; // How to open admin panel
  
  // Tickets panel settings  
  ticketsPanelOpenMode: 'new_tab' | 'popup'; // How to open tickets panel
}

// Default settings
const defaultSettings: NotificationSettings = {
  // General
  showNotificationBar: true,
  audioEnabled: true,
  
  // Show settings
  showChatMessages: true,
  showInGameMessages: true,
  showOffGameMessages: true,
  showCharacterApproval: true,
  showPlayerPresence: true,
  showSystemMessages: true,
  
  // Audio assignments (notification type -> audio file ID)
  audioAssignments: { ...DEFAULT_AUDIO_ASSIGNMENTS },
  
  // Display
  notificationDuration: 8000, // 8 seconds default
  maxNotifications: 50,
  
  // Admin panel
  adminPanelOpenMode: 'new_tab',
  
  // Tickets panel
  ticketsPanelOpenMode: 'new_tab'
};

// Context type
interface NotificationSettingsContextType {
  settings: NotificationSettings;
  updateSettings: (newSettings: Partial<NotificationSettings>) => void;
  resetSettings: () => void;
  shouldShowNotification: (type: string) => boolean;
  shouldPlayAudio: (type: string) => boolean;
  playAudioForType: (type: string) => Promise<void>;
  updateAudioAssignment: (type: string, audioId: string) => void;
}

const NotificationSettingsContext = createContext<NotificationSettingsContextType | null>(null);

// Hook
export const useNotificationSettings = (): NotificationSettingsContextType => {
  const context = useContext(NotificationSettingsContext);
  if (!context) {
    throw new Error('useNotificationSettings must be used within a NotificationSettingsProvider');
  }
  return context;
};

// Provider
interface NotificationSettingsProviderProps {
  children: ReactNode;
}

export const NotificationSettingsProvider: React.FC<NotificationSettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('tenpennynovels_notification_settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        // Merge with defaults to ensure all properties exist
        setSettings({ ...defaultSettings, ...parsedSettings });
      }
    } catch (error) {
      console.warn('Failed to load notification settings from localStorage:', error);
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('tenpennynovels_notification_settings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save notification settings to localStorage:', error);
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  // Helper function to check if a notification type should be shown
  const shouldShowNotification = (type: string): boolean => {
    if (!settings.showNotificationBar) return false;
    
    switch (type) {
      case 'chat_message':
        return settings.showChatMessages;
      case 'ingame_message':
        return settings.showInGameMessages;
      case 'offgame_message':
        return settings.showOffGameMessages;
      case 'character_approved':
      case 'character_rejected':
        return settings.showCharacterApproval;
      case 'player_entered':
        return settings.showPlayerPresence;
      case 'system_message':
        return settings.showSystemMessages;
      default:
        return true; // Show unknown types by default
    }
  };

  // Helper function to check if audio should be played for a notification type
  const shouldPlayAudio = (type: string): boolean => {
    if (!settings.audioEnabled) return false;
    
    const audioId = settings.audioAssignments[type];
    return Boolean(audioId && audioId !== 'none');
  };

  // Play audio for a specific notification type
  const playAudioForType = async (type: string): Promise<void> => {
    if (!shouldPlayAudio(type)) return;
    
    const audioId = settings.audioAssignments[type];
    if (audioId && audioId !== 'none') {
      try {
        await playAudioFile(audioId, 0.5);
      } catch (error) {
        console.warn(`Failed to play audio for type ${type}:`, error);
      }
    }
  };

  // Update audio assignment for a specific type
  const updateAudioAssignment = (type: string, audioId: string) => {
    updateSettings({
      audioAssignments: {
        ...settings.audioAssignments,
        [type]: audioId
      }
    });
  };

  const contextValue: NotificationSettingsContextType = {
    settings,
    updateSettings,
    resetSettings,
    shouldShowNotification,
    shouldPlayAudio,
    playAudioForType,
    updateAudioAssignment
  };

  return (
    <NotificationSettingsContext.Provider value={contextValue}>
      {children}
    </NotificationSettingsContext.Provider>
  );
};