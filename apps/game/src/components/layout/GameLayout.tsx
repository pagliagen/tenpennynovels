/**
 * Game Layout Component
 *
 * Main layout structure for authenticated game pages.
 * Provides sidebar, top bar, and main content container.
 *
 * Architecture:
 * - Sidebar (left): Character info, presence list, weather/time
 * - TopBar (top): Quick actions, notifications
 * - MainContent (center): Page-specific content
 * - Overlays: CharacterSheets, Chat panels, Utility panel
 *
 * CRITICAL: This component is ONLY for visual structure.
 * NO business logic, NO API calls, NO WebSocket subscriptions.
 * All data comes from contexts or TanStack Query.
 *
 * @module components/layout/GameLayout
 * @since 2.0.0
 */

'use client';

import { ReactNode, useMemo, useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/router';
import styles from '@/styles/components/GameLayout.module.scss';
import { TopBar } from './TopBar';
import { CharacterProfile } from '../sidebar/CharacterProfile';
import { DateDisplay } from '../sidebar/DateDisplay';
import { MoonPhase } from '../sidebar/MoonPhase';
import { WeatherDisplay } from '../sidebar/WeatherDisplay';
import { CharactersList } from '../sidebar/CharactersList';
import { WindowRenderer } from '../windows/WindowRenderer';
import { MinimizedWindowsBar } from '../windows/MinimizedWindowsBar';
import { ConnectionStatus } from '../connection/ConnectionStatus';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api/client';
import { useLocationStore } from '@/store/locationStore';
import { useGameStateStore } from '@/store/gameStateStore';
import { useWindowManagerStore } from '@/store/windowManagerStore';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useQueryClient } from '@tanstack/react-query';
import { useOnGameUnreadCount } from '@/hooks/useOnGameMail';
import { useOffGameUnreadCount } from '@/hooks/useOffGameChat';
import { useTicketNotifications } from '@/hooks/useTicketNotifications';
import { useUnreadTicketsCount } from '@/hooks/useTickets';
import { queryKeys } from '@/lib/api/queryClient';
import { ForumModal } from '../forum/ForumModal';
import { useForumStore } from '@/store/forumStore';
import { PresenceModal } from '../presence/PresenceModal';

/**
 * Game Layout Props
 *
 * @interface GameLayoutProps
 * @since 2.0.0
 */
interface GameLayoutProps {
  /** Page content to render in main area */
  children: ReactNode;
}

/**
 * Game Layout Component
 *
 * Renders the main game layout with sidebar, top bar, and content area.
 * This is a pure presentational component - all data comes from contexts.
 *
 * @component
 * @param {GameLayoutProps} props - Component props
 * @returns {JSX.Element} Game layout structure
 * @since 2.0.0
 *
 * @example
 * ```tsx
 * <GameLayout>
 *   <LocationChat />
 * </GameLayout>
 * ```
 */
export function GameLayout({ children }: GameLayoutProps): JSX.Element {
  const router = useRouter();

  // Utility popups state
  const [showAudioPopup, setShowAudioPopup] = useState(false);
  const [showChatPopup, setShowChatPopup] = useState(false);

  // Auth store: Get current character and permissions
  const selectedCharacter = useAuthStore((state) => state.selectedCharacter);
  const user = useAuthStore((state) => state.user);
  const hasGamePermission = useAuthStore((state) => state.hasGamePermission);
  const setSelectedCharacter = useAuthStore((state) => state.setSelectedCharacter);
  const setGamePermissions = useAuthStore((state) => state.setGamePermissions);

  // Game state: Get current location (SINGLE SOURCE OF TRUTH)
  const currentLocationId = useGameStateStore((state) => state.currentLocationId);

  // Location store: Get all accessible locations
  const locations = useLocationStore((state) => state.locations);

  // Window manager: For opening mail window
  const { openWindow } = useWindowManagerStore();

  // Forum store
  const isForumOpen = useForumStore((s) => s.isOpen);

  // Mail system: Unread count for TopBar badge
  const { data: unreadMailCount = 0 } = useOnGameUnreadCount();

  // OffGame chat system: Unread count for TopBar badge
  const { data: unreadOffGameChatCount = 0 } = useOffGameUnreadCount();

  // Ticket system: Unread count for player (messages from staff not read yet)
  const { data: unreadTicketsCount = 0 } = useUnreadTicketsCount();

  // WebSocket + QueryClient: For real-time badge updates
  const { onMessageEvent } = useWebSocket();
  const queryClient = useQueryClient();

  // Ticket notifications: Real-time updates and invalidations
  useTicketNotifications();

  /**
   * Refresh auth session to pick up character status changes (e.g. approved/rejected via WebSocket)
   */
  const refreshSession = useCallback(async () => {
    try {
      const session = await api.get<any>('/auth/session');
      if (session.result && session.data?.valid) {
        if (session.data.character) {
          setSelectedCharacter(session.data.character);
        }
        if (session.data.gamePermissions) {
          setGamePermissions(session.data.gamePermissions);
        }
      }
    } catch {
      // Non-critical: session will refresh on next page load
    }
  }, [setSelectedCharacter, setGamePermissions]);

  /**
   * Redirect to wizard when character has game:character:wizard (draft) and we're on game home.
   */
  useEffect(() => {
    if (!selectedCharacter || !hasGamePermission('game:character:wizard') || selectedCharacter.playerStatus !== 'draft') return;
    if (router.pathname === '/game') {
      router.replace('/character/wizard');
    }
  }, [selectedCharacter, hasGamePermission, router.pathname, router]);

  /**
   * Initialize locationStore on mount
   *
   * Ensures locations are loaded from cache or fetched from API.
   * Required for TopBar and chat entry to work correctly.
   */
  useEffect(() => {
    if (selectedCharacter && locations.length === 0) {
      console.log('[GameLayout] Initializing locationStore...');
      useLocationStore.getState().initialize(selectedCharacter._id);
    }
  }, [selectedCharacter?._id, locations.length]);

  /**
   * Calculate TopBar location props from GameStateStore + locationStore
   *
   * SINGLE SOURCE OF TRUTH: currentLocationId from GameStateStore
   */
  const topBarLocationProps = useMemo(() => {
    // Default: London (when no currentLocation set)
    const defaultProps = {
      locationName: 'London',
      locationImageUrl: '/images/topbar/location-image.png',
      isInLondon: true,
    };

    // Guard: No currentLocation set
    if (!currentLocationId) {
      return defaultProps;
    }

    // Find location by ID from locationStore
    const currentLocation = locations.find((loc) => loc._id === currentLocationId);

    // If location not found, fallback to default
    if (!currentLocation) {
      console.warn('[GameLayout] ⚠️ Location not found for ID:', currentLocationId, '| Available:', locations.length);
      return defaultProps;
    }

    console.log('[GameLayout] ✅ TopBar updated:', currentLocation.name, '| ID:', currentLocation._id);

    // Return actual location props
    return {
      locationName: currentLocation.name,
      locationImageUrl: currentLocation.imageUrl || '/images/topbar/location-image.png',
      isInLondon: currentLocation.slug === 'londra', // TODO: Check if there's a better way to identify London
    };
  }, [currentLocationId, locations]);

  /**
   * Navigate to locations/map page
   */
  const handleQuickMapClick = () => {
    router.push('/locations');
  };

  /**
   * Open OnGame mail window
   */
  const handleOnGameMailClick = () => {
    openWindow('messageOnGame', {
      conversationId: 'inbox',
      conversationTitle: 'Posta Vittoriana',
      initialView: 'inbox',
    });
  };

  /**
   * Open OffGame chat window
   */
  const handleOffGameChatClick = () => {
    openWindow('messageOffGame', {
      conversationId: 'offgame-main',
      initialView: 'list',
    });
  };

  /**
   * Open Character Directory window (Anagrafica)
   */
  const handleCharacterDirectoryClick = () => {
    openWindow('utility', {
      utilityName: 'character-directory',
    });
  };

  /**
   * Open Character Face Claim window
   */
  const handleCharacterFaceClaimClick = () => {
    openWindow('utility', {
      utilityName: 'character-faceclaim',
    });
  };

  const handleForumClick = useCallback(() => {
    const { openForum } = useForumStore.getState();
    openForum();
  }, []);

  /**
   * Open Ticket utility window
   */
  const handleTicketClick = () => {
    openWindow('utility', {
      utilityName: 'tickets',
    });
  };

  /**
   * Open Audio Options popup
   */
  const handleAudioOptionsClick = useCallback(() => {
    setShowAudioPopup(true);
  }, []);

  /**
   * Open Chat Options popup
   */
  const handleChatOptionsClick = useCallback(() => {
    setShowChatPopup(true);
  }, []);

  /**
   * Handle logout
   */
  const handleLogout = useCallback(async () => {
    try {
      // Call logout endpoint
      await api.post('/auth/logout', {});
    } catch (error) {
      console.error('[GameLayout] Logout error:', error);
      // Continue anyway - cookies cleared server-side
    } finally {
      // Clear local auth state
      useAuthStore.getState().logout();

      // Hard redirect to landing page (absolute URL to avoid middleware interception)
      window.location.href = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:4000';
    }
  }, []);

  /**
   * WebSocket listener for real-time mail badge updates
   * Must work even when mail window is closed
   */
  useEffect(() => {
    const unsubscribe = onMessageEvent((event) => {
      if (event.type === 'ongame:message_delivered') {
        queryClient.invalidateQueries({
          queryKey: queryKeys.onGameMail.unreadCount,
        });
      }

      if (event.type === 'offgame_message_received') {
        queryClient.invalidateQueries({
          queryKey: queryKeys.offGameChat.unreadCount,
        });
      }

      if (event.type === 'character_status_changed') {
        refreshSession();
      }
    });
    return unsubscribe;
  }, [onMessageEvent, queryClient, refreshSession]);

  return (
    <>
      <div className={styles.gameContainer}>
        {/* ========================================
          SIDEBAR - Left side with character info
          ======================================== */}
        <aside className={styles.sidebar}>
          {/* Clock Upper - Date, Profile, Weather */}
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
              <MoonPhase />
              <WeatherDisplay />
            </div>
          </div>

          {/* Clock Middle - Characters List (Presenze) */}
          <div className={styles.clockMiddle}>
            <div className={styles.headerClockMiddle}>
              <img
                src="/images/sidebar/clock_middle.png"
                alt="Clock Pattern"
                className={styles.clockPattern}
              />
            </div>
            <div className={styles.charactersSection}>
              <CharactersList />
            </div>
          </div>

          {/* Clock Base - Footer */}
          <div className={styles.clockBase}>
            {/* Chat OffGame Button */}
            <button
              type="button"
              className={styles.offGameChatButton}
              onClick={handleOffGameChatClick}
              title="Chat OffGame - Comunicazioni fuori dal gioco"
            >
              Chat OffGame →
              {unreadOffGameChatCount > 0 && (
                <span style={{ marginLeft: '0.5rem', color: '#25d366', fontWeight: 'bold' }}>
                  ({unreadOffGameChatCount})
                </span>
              )}
            </button>

            <div className={styles.footerText}>THE VOICES OF LONDON</div>
          </div>
        </aside>

        {/* ========================================
          MAIN CONTENT - Right side with top bar + content
          ======================================== */}
        <div className={styles.mainContent}>
          {/* Top Bar - Quick actions and notifications */}
          <TopBar
            onQuickMapClick={handleQuickMapClick}
            onOnGameMailClick={handleOnGameMailClick}
            onForumClick={handleForumClick}
            onTicketClick={handleTicketClick}
            onAudioOptionsClick={handleAudioOptionsClick}
            onChatOptionsClick={handleChatOptionsClick}
            onCharacterDirectoryClick={handleCharacterDirectoryClick}
            onCharacterFaceClaimClick={handleCharacterFaceClaimClick}
            onLogoutClick={handleLogout}
            unreadOnGameMailCount={unreadMailCount}
            onOffGameChatClick={handleOffGameChatClick}
            unreadOffGameChatCount={unreadOffGameChatCount}
            unreadTicketsCount={unreadTicketsCount}
            canAccessAdmin={user?.canAccessAdminPanel ?? false}
            locationName={topBarLocationProps.locationName}
            locationImageUrl={topBarLocationProps.locationImageUrl}
            isInLondon={topBarLocationProps.isInLondon}
          />

          {/* Body Container - Page content */}
          <main className={styles.bodyContainer}>{children}</main>
        </div>

        {/* ========================================
          OVERLAYS - Character sheets, chat panels, etc.
          ======================================== */}
        {/* Window Manager - Renders all open windows */}
        <WindowRenderer />

        {/* Minimized Windows Bar - Bottom bar for minimized windows */}
        <MinimizedWindowsBar />

        {/* Connection Status - Shows overlay when WebSocket disconnects */}
        <ConnectionStatus />
      </div>

      {/* Forum Modal - Full screen overlay */}
      {isForumOpen && <ForumModal />}

      {/* Presence Modal - Side drawer */}
      <PresenceModal />

      {/* Audio Options Popup - Placeholder */}
      {showAudioPopup && (
        <div className={styles.utilityPopupOverlay} onClick={() => setShowAudioPopup(false)}>
          <div className={styles.utilityPopupContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.utilityPopupHeader}>
              <h2>Opzioni Audio</h2>
              <button
                type="button"
                className={styles.utilityPopupClose}
                onClick={() => setShowAudioPopup(false)}
                aria-label="Chiudi"
              >
                ✕
              </button>
            </div>
            <div className={styles.utilityPopupBody}>
              <p>QUI CI SARANNO LE OPZIONI AUDIO</p>
              <p style={{ fontSize: '14px', opacity: 0.7, marginTop: '1rem' }}>
                (Placeholder - da implementare)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Chat Options Popup - Placeholder */}
      {showChatPopup && (
        <div className={styles.utilityPopupOverlay} onClick={() => setShowChatPopup(false)}>
          <div className={styles.utilityPopupContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.utilityPopupHeader}>
              <h2>Opzioni Chat</h2>
              <button
                type="button"
                className={styles.utilityPopupClose}
                onClick={() => setShowChatPopup(false)}
                aria-label="Chiudi"
              >
                ✕
              </button>
            </div>
            <div className={styles.utilityPopupBody}>
              <p>QUI CI SARANNO LE OPZIONI CHAT</p>
              <p style={{ fontSize: '14px', opacity: 0.7, marginTop: '1rem' }}>
                (Placeholder - da implementare)
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
