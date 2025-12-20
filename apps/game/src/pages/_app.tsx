import type { AppProps } from 'next/app';
import Head from 'next/head';
import React, { useEffect, useState } from 'react';
// Import game-specific styles (includes shared design system)
import '@/styles/globals.scss';
import { GameApiService, GameInitResponse } from '@/lib/gameApi';
import { GameLayout } from '@/components/GameLayout';
import { GameProvider } from '@/contexts/GameContext';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { NotificationSettingsProvider } from '@/contexts/NotificationSettingsContext';
import { CharacterSheetsProvider } from '@/contexts/CharacterSheetsContext';
import { useAuthCheck } from '@/hooks/useAuthCheck';

export default function App({ Component, pageProps }: AppProps) {
  const [gameData, setGameData] = useState<GameInitResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth check (ping every 5 seconds)
  useAuthCheck();

  // console.log('🎮 _app.tsx: Component rendering, Component.name:', Component.name || Component.displayName || 'Unknown');

  useEffect(() => {
    // Initialize game data once when app starts
    const initGame = async () => {
      try {
        // console.log('🎮 App: Initializing game');
        const result = await GameApiService.initGame();
        if (result.success) {
          // console.log('🎮 App: Game initialized successfully');
          setGameData(result);
        } else {
          console.error('🎮 App: Game initialization failed');
        }
      } catch (error) {
        console.error('🎮 App: Game initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initGame();
  }, []);

  if (loading) {
    return (
      <>
        <Head>
          <title>TenpennyNovels Londra vittoriana</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column'
        }}>
          <h1>TenpennyNovels</h1>
          <p>Inizializzazione della Londra vittoriana...</p>
        </div>
      </>
    );
  }

  if (!gameData?.character) {
    return (
      <>
        <Head>
          <title>TenpennyNovels Londra vittoriana - Caricamento...</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column'
        }}>
          <h1>Autenticazione richiesta</h1>
          <p>Reindirizzamento al login...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>TenpennyNovels Londra vittoriana</title>
        {/* Favicon */}
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
        <link rel="icon" href="/favicon/favicon.ico" />
        <meta name="theme-color" content="#8B4513" />
      </Head>
      
      <GameProvider gameData={gameData}>
        <NotificationSettingsProvider>
          <NotificationProvider>
            <CharacterSheetsProvider>
              <WebSocketProvider
                characterId={gameData.character?.id || ''}
                characterName={gameData.character?.name || ''}
                characterRoles={gameData.character?.gameplayRoles || []}
              >
                <GameLayout gameData={gameData}>
                  <Component {...pageProps} gameData={gameData} />
                </GameLayout>
              </WebSocketProvider>
            </CharacterSheetsProvider>
          </NotificationProvider>
        </NotificationSettingsProvider>
      </GameProvider>
    </>
  );
}