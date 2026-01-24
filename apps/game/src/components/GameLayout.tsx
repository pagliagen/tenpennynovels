import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '@/styles/components/GameLayout.module.scss';
import { CharactersList } from './CharactersList';
import { NotificationBar } from './NotificationBar';
import { DevNotificationTester } from './DevNotificationTester';
import CharacterSheet from './character/CharacterSheet';
import CharacterSheetsBar from './character/CharacterSheetsBar';
import { GameInitResponse } from '@/lib/gameApi';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useGame } from '@/contexts/GameContext';
import { useCharacterSheets } from '@/contexts/CharacterSheetsContext';
import { getLondonLocationId } from '@/utils/cache';
import { OffGameChatPanel } from './offgame-chat/OffGameChatPanel';
import { OnGameThreadPanel } from './ongame-mail/OnGameThreadPanel';
import { TopBar } from './TopBar';
import { CharacterProfile } from './sidebar/CharacterProfile';
import { DateDisplay } from './sidebar/DateDisplay';

interface Character {
  characterId: string;
  characterName: string;
  characterSurname: string | null;
  locationId: string;
  locationName: string;
  isCurrentCharacter: boolean;
  avatar: string | null;
}

interface GameLayoutProps {
  children: React.ReactNode;
  gameData: GameInitResponse;
}

export const GameLayout: React.FC<GameLayoutProps> = ({
  children,
  gameData
}) => {
  const router = useRouter();
  const { onPresenceUpdate, onLocationJoined, onOffGameMessage, socket } = useWebSocket();
  const { character } = useGame();
  const { openSheets } = useCharacterSheets();

  // Simple state management - no complex contexts
  const [showNotificationBar, setShowNotificationBar] = useState(true);
  const [showOffGameChat, setShowOffGameChat] = useState(false);
  const [showOnGameMail, setShowOnGameMail] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadMailCount, setUnreadMailCount] = useState(0);
  const [unreadTicketsCount, setUnreadTicketsCount] = useState(0); // TODO: Implementare logica ticket nei prossimi task

  // GameContext now handles ALL character location updates immediately
  // - Click location -> updateCharacter({ currentLocationId }) 
  // - WebSocket ping -> updateGlobalPresence() syncs with other players

  // CharactersList now uses GameContext directly - no need for this function

  const handleMappeClick = () => {
    router.push('/locations');
  };

  const handleCharacterListClick = () => {
    router.push('/characters');
  };

  const handleMarketClick = () => {
    router.push('/shop/london');
  };

  const handleEntraChatClick = () => {
    const currentLocationId = character?.currentLocationId;
    if (currentLocationId) {
      router.push(`/locations/${currentLocationId}`);
    }
  };

  const handleOffGameChatOpen = () => {
    setShowOffGameChat(true);
    // Reset unread count when opening chat
    setUnreadChatCount(0);
  };

  const handleOffGameNotificationsSeen = () => {
    // Reset unread count when notifications are marked as seen from NotificationBar
    setUnreadChatCount(0);
  };

  const handleOffGameChatClick = () => {
    if (showOffGameChat) {
      setShowOffGameChat(false);
    } else {
      handleOffGameChatOpen();
    }
  };

  const handleOnGameMailOpen = () => {
    setShowOnGameMail(true);
    // Reset unread count when opening mail
    setUnreadMailCount(0);
  };

  const handleOnGameMailClick = () => {
    if (showOnGameMail) {
      setShowOnGameMail(false);
    } else {
      handleOnGameMailOpen();
    }
  };

  // Handle location info click (Zona 7)
  const handleLocationInfoClick = () => {
    // TODO: Implementare modal/pannello con info location corrente
    const currentLocationId = character?.currentLocationId;
    if (currentLocationId) {
      // Per ora naviga alla location, in futuro aprire modal con info
      router.push(`/locations/${currentLocationId}`);
    }
  };

  // Handle logout (Zona 11)
  const handleLogoutClick = async () => {
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'https://api.tenpennynovels.com';
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Clear local storage and redirect
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        router.push('/');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Redirect anyway
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        router.push('/');
      }
    }
  };

  // Get current location name for display
  const getCurrentLocationName = () => {
    const currentLocationId = character?.currentLocationId;
    if (!currentLocationId) return 'London';

    // Find location in gameData.locations
    const location = gameData.locations?.find(loc => loc.id === currentLocationId);
    return location?.name || 'Location Sconosciuta';
  };

  // Check if current location is London (using precise ID)
  const isCurrentLocationLondon = () => {
    const currentLocationId = character?.currentLocationId;
    const londonId = getLondonLocationId();
    return londonId && currentLocationId === londonId;
  };

  // Check if user is currently viewing a location chat page
  const isViewingLocationChat = () => {
    return router.pathname === '/locations/[locationId]';
  };

  const currentLocationName = getCurrentLocationName();

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  // Handle window resize
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen for off-game message notifications
  useEffect(() => {
    const unsubscribe = onOffGameMessage((notification) => {

      // Only increment counter if chat is closed
      if (!showOffGameChat) {
        setUnreadChatCount(prev => prev + 1);
      }
    });

    return unsubscribe;
  }, [onOffGameMessage, showOffGameChat]);

  // Listen for OnGame mail notifications
  useEffect(() => {
    if (!socket) return;

    const handleMailDelivered = (notification: any) => {

      // Only increment counter if mail panel is closed
      if (!showOnGameMail) {
        setUnreadMailCount(prev => prev + 1);
      }
    };

    socket.on('ongame:message_delivered', handleMailDelivered);

    return () => {
      socket.off('ongame:message_delivered', handleMailDelivered);
    };
  }, [socket, showOnGameMail]);

  // Listen for custom events to open OffGameChat panel
  useEffect(() => {
    const handleOpenOffGameChat = () => {
      handleOffGameChatOpen();
    };

    window.addEventListener('openOffGameChat', handleOpenOffGameChat);

    return () => {
      window.removeEventListener('openOffGameChat', handleOpenOffGameChat);
    };
  }, []);

  // Dynamic styles based on notification bar visibility and responsive breakpoints
  // Padding-right rimosso come richiesto
  const rightContainerStyle = {};

  return (
    <div className={styles.gameContainer}>
      {/* Sidebar - Full Height */}
      <aside className={styles.sidebar}>
        {/* Clock Upper - Top section with date, profile, weather */}
        <div className={styles.clockUpper}>
          {/* Date Display */}
          <div className={styles.dateSection}>
            <DateDisplay />
          </div>

          {/* Character Profile */}
          <div className={styles.profileSection}>
            <CharacterProfile />
          </div>

          {/* Moon Phase and Weather */}
          <div className={styles.moonWeatherSection}>
            <img
              src="/images/sidebar/luna_calante.png"
              alt="Fase lunare: waning"
              className={styles.moonImage}
            />
            <img
              src="/images/sidebar/meteo_nuvolenebbia.png"
              alt="Condizioni meteo: fog"
              className={styles.weatherIcon}
            />
            <span className={styles.temperature}>5°</span>
          </div>
        </div>

        {/* Clock Middle and Pattern - Middle section with Presenze list */}
        <div className={styles.clockMiddle}>
          {/* Characters List (Presenze) */}
          <div className={styles.charactersSection}>
            <CharactersList
              characters={[]} // Non serve più, usa globalPresence dal context
              currentCharacterId={character?.id || ''}
              currentCharacterLocation={character?.currentLocationId || null}
            />
          </div>
        </div>

        {/* Clock Base - Bottom section with footer */}
        <div className={styles.clockBase}>
          <div className={styles.footerText}>THE VOICES OF LONDON</div>
        </div>
      </aside>

      {/* Main Content: TopBar + Right Container */}
      <div className={styles.mainContent}>
        {/* TopBar */}
        <TopBar
          onQuickMapClick={handleMappeClick}
          onOnGameMailClick={handleOnGameMailClick}
          onOffGameChatClick={handleOffGameChatClick}
          onLocationInfoClick={handleLocationInfoClick}
          onLogoutClick={handleLogoutClick}
          onMarketClick={handleMarketClick}
          unreadOnGameMailCount={unreadMailCount}
          unreadOffGameChatCount={unreadChatCount}
          characterStatus={gameData.character?.status}
        />

        {/* Right side container */}
        <div className={styles.rightContainer} style={rightContainerStyle}>
          {/* Header - Non mostrato su /locations o /locations/[locationId] */}
          {router.pathname !== '/locations' && !isViewingLocationChat() && (
            <header className={styles.header}>
              <div className={styles.headerContent}>
                <div className={styles.headerLeft}>
                  <h1 className={styles.gameTitle}>TenpennyNovels</h1>
                  <p className={styles.description}>GDR di Londra Vittoriana</p>
                </div>

                <div className={styles.headerActions}>
                  {/* Bottoni 1, 2, 3 */}
                  <div className={styles.buttonGroup}>
                    {/* Bottone 1 - Placeholder per futuro */}
                    <button
                      className={styles.headerButton}
                      disabled
                      title="TBD"
                    >
                      {/* TBD */}
                    </button>

                    {/* Bottone 2 - Placeholder per futuro */}
                    <button
                      className={styles.headerButton}
                      disabled
                      title="TBD"
                    >
                      {/* TBD */}
                    </button>

                    {/* Bottone 3 - Placeholder per futuro */}
                    <button
                      className={styles.headerButton}
                      disabled
                      title="TBD"
                    >
                      {/* TBD */}
                    </button>
                  </div>

                  {/* Bottone MAPPA (centrale) */}
                  <button
                    className={`${styles.headerButton} ${styles.mapButton}`}
                    onClick={handleMappeClick}
                    title="Visualizza mappe e locations"
                  >
                    🗺️ MAPPE
                  </button>

                  {/* Bottoni 4, 5, 6 */}
                  <div className={styles.buttonGroup}>
                    {/* Bottone 4: PERSONAGGI */}
                    <button
                      className={styles.headerButton}
                      onClick={handleCharacterListClick}
                      title="Lista personaggi registrati"
                    >
                      👥 PERSONAGGI
                    </button>

                    {/* Bottone 5: TBD (MERCATO spostato in TopBar) */}
                    <button
                      className={styles.headerButton}
                      disabled
                      title="TBD"
                    >
                      {/* TBD */}
                    </button>

                    {/* Bottone 6: ENTRA IN CHAT o TBD */}
                    {character?.currentLocationId && !isCurrentLocationLondon() && !isViewingLocationChat() ? (
                      <button
                        className={styles.headerButton}
                        onClick={handleEntraChatClick}
                        title={`Entra nella chat di ${currentLocationName}`}
                      >
                        💬 ENTRA IN CHAT
                      </button>
                    ) : (
                      <button
                        className={styles.headerButton}
                        disabled
                        title="TBD"
                      >
                        {/* TBD */}
                      </button>
                    )}
                  </div>
                </div>

                <div className={styles.headerRight}>
                  <div className={styles.userInfo}>
                    {gameData.character ? (
                      <div className={styles.userCard}>
                        <div className={styles.userDetails}>
                          <span className={styles.characterName}>
                            {gameData.character.name}
                          </span>
                          {gameData.character.occupation && (
                            <span className={styles.occupation}>
                              {gameData.character.occupation}
                            </span>
                          )}
                        </div>
                        <div className={styles.userBadges}>
                          {gameData.character.gameplayRoles?.includes('master') && (
                            <span className={styles.masterBadge}>MASTER</span>
                          )}
                          {gameData.character.gameplayRoles?.includes('moderatore') && (
                            <span className={styles.modBadge}>MOD</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className={styles.loginPrompt}>
                        <span>Personaggio non selezionato</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </header>
          )}

          {/* Body Container - Senza wrapper main su /locations */}
          {router.pathname === '/locations' || isViewingLocationChat() ? (
            <div className={styles.bodyContainer}>
              {children}
            </div>
          ) : (
            <main className={styles.bodyContainer}>
              {children || (
                <div style={{
                  padding: '2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'rgba(255, 149, 0, 0.7)',
                  fontWeight: 'bold',
                  border: '1px dashed rgba(255, 149, 0, 0.3)',
                  margin: '1rem',
                  borderRadius: '8px',
                  background: 'rgba(255, 149, 0, 0.05)'
                }}>
                  BODY CONTAINER
                </div>
              )}
            </main>
          )}
        </div>
      </div>

      {/* Notification Bar - Fixed position */}
      <NotificationBar
        canAccessAdmin={gameData.user?.canAccessAdmin || false}
        canAccessTickets={gameData.user?.canAccessTickets || false}
        workableTicketsCount={gameData.user?.workableTicketsCount || 0}
        unreadTicketsCount={unreadTicketsCount}
        onOffGameChatOpen={handleOffGameChatOpen}
        onOffGameNotificationsSeen={handleOffGameNotificationsSeen}
        onOnGameMailOpen={handleOnGameMailOpen}
        onOnGameNotificationsSeen={() => setUnreadMailCount(0)}
      />

      {/* Character Sheets Popups */}
      {openSheets.map(sheet => (
        <CharacterSheet key={sheet.id} sheet={sheet} />
      ))}

      {/* Character Sheets Bar */}
      <CharacterSheetsBar />

      {/* OffGame Chat Panel */}
      <OffGameChatPanel
        isVisible={showOffGameChat}
        onClose={() => setShowOffGameChat(false)}
      />

      {/* OnGame Thread Panel */}
      <OnGameThreadPanel
        isVisible={showOnGameMail}
        onClose={() => setShowOnGameMail(false)}
      />
    </div>
  );
};