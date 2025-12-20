import React, { useState, useEffect, ReactNode, useMemo } from 'react';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { GameProvider } from '@/contexts/GameContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { NotificationSettingsProvider } from '@/contexts/NotificationSettingsContext';
import { CharacterSheetsProvider } from '@/contexts/CharacterSheetsContext';
import { GameApiService, GameInitResponse } from '@/lib/gameApi';
import { useWebSocketNotifications } from '@/hooks/useWebSocketNotifications';
import { LoginNotificationHandler } from './LoginNotificationHandler';

interface GameWrapperProps {
  children: ReactNode;
}

export const GameWrapper: React.FC<GameWrapperProps> = ({ children }) => {
  const [gameData, setGameData] = useState<GameInitResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  
  useEffect(() => {
    if (isInitialized) {
      return;
    }
    initializeGame();
  }, [isInitialized]);

  const initializeGame = async () => {
    try {
      const result = await GameApiService.initGame();
      if (result.success) {
        setGameData(result);
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('🎮 GameWrapper: Failed to initialize game:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !gameData?.character) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column' 
      }}>
        <h1>TenpennyNovels</h1>
        <p>Initializing Victorian London...</p>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <GameProvider gameData={gameData}>
      <NotificationSettingsProvider>
        <NotificationProvider>
          <CharacterSheetsProvider>
            <WebSocketProvider
              characterId={gameData.character.id}
              characterName={gameData.character.name}
              characterRoles={gameData.character.gameplayRoles || []}
            >
              <NotificationHandler>
                {children}
              </NotificationHandler>
            </WebSocketProvider>
          </CharacterSheetsProvider>
        </NotificationProvider>
      </NotificationSettingsProvider>
    </GameProvider>
  );
};

// Internal component to handle notifications
const NotificationHandler: React.FC<{ children: ReactNode }> = ({ children }) => {
  useWebSocketNotifications();
  return (
    <>
      <LoginNotificationHandler />
      {children}
    </>
  );
};