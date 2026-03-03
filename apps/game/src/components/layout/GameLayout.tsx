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

import { ReactNode, useMemo, useEffect } from 'react';
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
import { useLocationStore } from '@/store/locationStore';
import { useGameStateStore } from '@/store/gameStateStore';
import { useWindowManagerStore } from '@/store/windowManagerStore';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useQueryClient } from '@tanstack/react-query';
import { useOnGameUnreadCount } from '@/hooks/useOnGameMail';
import { useOffGameUnreadCount } from '@/hooks/useOffGameChat';
import { queryKeys } from '@/lib/api/queryClient';

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

  // Auth store: Get current character
  const selectedCharacter = useAuthStore((state) => state.selectedCharacter);
  const user = useAuthStore((state) => state.user);

  // Game state: Get current location (SINGLE SOURCE OF TRUTH)
  const currentLocationId = useGameStateStore((state) => state.currentLocationId);

  // Location store: Get all accessible locations
  const locations = useLocationStore((state) => state.locations);

  // Window manager: For opening mail window
  const { openWindow } = useWindowManagerStore();

  // Mail system: Unread count for TopBar badge
  const { data: unreadMailCount = 0 } = useOnGameUnreadCount();

  // OffGame chat system: Unread count for TopBar badge
  const { data: unreadOffGameChatCount = 0 } = useOffGameUnreadCount();

  // WebSocket + QueryClient: For real-time badge updates
  const { onMessageEvent } = useWebSocket();
  const queryClient = useQueryClient();

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
    });
    return unsubscribe;
  }, [onMessageEvent, queryClient]);

  return (
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
          unreadOnGameMailCount={unreadMailCount}
          onOffGameChatClick={handleOffGameChatClick}
          unreadOffGameChatCount={unreadOffGameChatCount}
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
  );
}
