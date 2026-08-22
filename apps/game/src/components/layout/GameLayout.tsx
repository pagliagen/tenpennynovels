/**
 * Game Layout Component
 *
 * Struttura principale delle pagine autenticate: sidebar, top bar, area contenuto.
 *
 * Comportamento (non è solo “presentational”):
 * - Composizione UI (sidebar, TopBar, finestre modali, ecc.)
 * - Orchestrazione: hook di query (mail, chat, ticket), WebSocket per invalidazioni,
 *   refresh sessione dopo eventi, init location store.
 *
 * @module components/layout/GameLayout
 * @since 2.0.0
 */

'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { ReactNode, useMemo, useEffect, useCallback, useState } from 'react';

import { useWebSocket } from '@/contexts/WebSocketContext';
import { forumPreferenceKeys, useForumUnreadSummary } from '@/hooks/useForumPreferences';
import { forumSocialKeys } from '@/hooks/useForumSocial';
import { useOffGameUnreadCount } from '@/hooks/useOffGameChat';
import { useOnGameUnreadCount } from '@/hooks/useOnGameMessages';
import { useIsCompactLayout, useIsMobileShell } from '@/hooks/useIsCompactLayout';
import { useTicketNotifications } from '@/hooks/useTicketNotifications';
import { useUnreadTicketsCount } from '@/hooks/useTickets';
import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/api/queryClient';
import { useAuthStore } from '@/store/authStore';
import { useForumStore } from '@/store/forumStore';
import { useGameStateStore } from '@/store/gameStateStore';
import { useLocationStore } from '@/store/locationStore';
import { CHAT_NOTIFICATION_SOUND_FILES, uiSelectors, useUIStore } from '@/store/uiStore';
import { useWindowManagerStore } from '@/store/windowManagerStore';
import styles from '@/styles/components/GameLayout.module.scss';
import type { AuthSessionApiResponse, CharacterBanSessionPayload } from '@/types/authSession';

import { CharacterReviewOutcomeModal } from '../character/CharacterReviewOutcomeModal';
import { ConnectionStatus } from '../connection/ConnectionStatus';
import { ForumModal } from '../forum/ForumModal';
import { PresenceModal } from '../presence/PresenceModal';
import { CharacterProfile } from '../sidebar/CharacterProfile';
import { CharactersList } from '../sidebar/CharactersList';
import { DateDisplay } from '../sidebar/DateDisplay';
import { MoonPhase } from '../sidebar/MoonPhase';
import { WeatherDisplay } from '../sidebar/WeatherDisplay';
import { MinimizedWindowsBar } from '../windows/MinimizedWindowsBar';
import { AudioManagerController } from '../windows/AudioManagerController';
import { WindowRenderer } from '../windows/WindowRenderer';

import { LocationInfoModal } from './LocationInfoModal';
import { MobileTabBar } from './MobileTabBar';
import { TopBar } from './TopBar';
import { logger } from '@/lib/logger';

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

type ChatNotificationSoundFile = (typeof CHAT_NOTIFICATION_SOUND_FILES)[number];

/** Friendly label for each notification sound file, in file order */
const CHAT_NOTIFICATION_SOUND_LABELS: Record<ChatNotificationSoundFile, string> = Object.fromEntries(
  CHAT_NOTIFICATION_SOUND_FILES.map((file, i) => [file, `Suono ${i + 1}`])
) as Record<ChatNotificationSoundFile, string>;

/**
 * Layout di gioco con shell UI, stato globale e sottoscrizioni real-time dove servono.
 */
export function GameLayout({ children }: GameLayoutProps): JSX.Element {
  const router = useRouter();

  // Utility popups state
  const [showAudioPopup, setShowAudioPopup] = useState(false);
  const [showChatPopup, setShowChatPopup] = useState(false);
  const [showLocationInfo, setShowLocationInfo] = useState(false);

  // Chat auto-scroll preference (Opzioni Chat popup)
  const chatAutoScrollMode = useUIStore(uiSelectors.chatAutoScrollMode);
  const setChatAutoScrollMode = useUIStore((state) => state.setChatAutoScrollMode);

  // Chat notification sound preference (Opzioni Chat popup)
  const chatNotificationSound = useUIStore(uiSelectors.chatNotificationSound);
  const setChatNotificationSound = useUIStore((state) => state.setChatNotificationSound);

  /**
   * Preview a notification sound (Opzioni Chat popup)
   */
  const handlePreviewSound = useCallback((sound: ChatNotificationSoundFile) => {
    const audio = new Audio(`/audio/${sound}.mp3`);
    audio.volume = 0.5;
    audio.play().catch((error) => {
      logger.warn('[GameLayout] Failed to preview notification sound:', { error });
    });
  }, []);

  // Sidebar responsive: sotto COMPACT_LAYOUT_BREAKPOINT non c'è più spazio per la
  // colonna fissa (325px sidebar + 1024px mainContent = 1349px richiesti) - diventa
  // un drawer a comparsa invece di stare sempre nel flusso. Stessa soglia usata da
  // ForumModal per passare a schermo intero - unica fonte di verità condivisa.
  const isCompactLayout = useIsCompactLayout();
  const isMobileShell = useIsMobileShell();
  const [isSidebarDrawerOpen, setIsSidebarDrawerOpen] = useState(false);

  // Se la finestra torna larga mentre il drawer è aperto, richiudilo: altrimenti
  // resterebbe "aperto" in stato ma invisibile (la sidebar torna inline) e si
  // riaprirebbe da sola come overlay al prossimo giro sotto la soglia. Vale
  // anche entrando nella shell mobile (isMobileShell): lì l'icona/drawer non
  // esiste più, ma isCompactLayout resta true (1024 < 1500) quindi da solo
  // non basterebbe a far scattare la chiusura.
  useEffect(() => {
    if (!isCompactLayout || isMobileShell) setIsSidebarDrawerOpen(false);
  }, [isCompactLayout, isMobileShell]);

  // Auth store: Get current character and permissions
  const selectedCharacter = useAuthStore((state) => state.selectedCharacter);
  const user = useAuthStore((state) => state.user);
  const adminPanelAccessFromSession = useAuthStore((state) => state.adminPanelAccessFromSession);
  const setSelectedCharacter = useAuthStore((state) => state.setSelectedCharacter);
  const setGamePermissions = useAuthStore((state) => state.setGamePermissions);
  const setAdminPanelAccessFromSession = useAuthStore((state) => state.setAdminPanelAccessFromSession);
  const characterBan = useAuthStore((state) => state.characterBan);
  const setCharacterBan = useAuthStore((state) => state.setCharacterBan);

  // Game state: Get current location (SINGLE SOURCE OF TRUTH)
  const currentLocationId = useGameStateStore((state) => state.currentLocationId);

  // Location store: Get all accessible locations
  const locations = useLocationStore((state) => state.locations);
  const rootLocation = useLocationStore((state) => state.rootLocation);

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

  // Forum system: bacheche with unread content, for TopBar badge
  const { data: forumUnreadSummary } = useForumUnreadSummary();

  // WebSocket + QueryClient: For real-time badge updates
  const { onMessageEvent, onGlobalEvent, onForumEvent } = useWebSocket();
  const queryClient = useQueryClient();

  // Ticket notifications: Real-time updates and invalidations
  useTicketNotifications();

  /**
   * Refresh auth session to pick up character status changes (e.g. approved/rejected via WebSocket)
   */
  const refreshSession = useCallback(async () => {
    try {
      const session = await api.get<AuthSessionApiResponse>('/auth/session');
      if (session.success && session.data?.valid) {
        if (session.data.user) {
          setAdminPanelAccessFromSession(!!session.data.user.canAccessAdminPanel);
        }
        if (session.data.character) {
          setSelectedCharacter(session.data.character);
        }
        if (session.data.gamePermissions) {
          setGamePermissions(session.data.gamePermissions);
        }
        const b = session.data.ban as CharacterBanSessionPayload | null | undefined;
        setCharacterBan(b ?? null);
      }
    } catch {
      // Non-critical: session will refresh on next page load
    }
  }, [setSelectedCharacter, setGamePermissions, setAdminPanelAccessFromSession, setCharacterBan]);

  /**
   * Ban aggiornato da staff: socket → refresh sessione.
   */
  useEffect(() => {
    const unsub = onGlobalEvent((ev) => {
      if (ev.type === 'character_ban_updated') {
        void refreshSession();
      }
    });
    return unsub;
  }, [onGlobalEvent, refreshSession]);

  /**
   * Ban full (blocco land): reindirizza alla pagina informativa (ticket restano usabili da TopBar).
   */
  useEffect(() => {
    if (!selectedCharacter || !characterBan?.active || !characterBan.blocksLandAccess) return;
    if (router.pathname === '/character-banned') return;
    void router.replace('/character-banned');
  }, [selectedCharacter, characterBan, router]);

  /**
   * Esito approvazione/rifiuto non ancora confermato: sopravvive alla
   * disconnessione (viene da reviewHistory via /auth/session), quindi
   * compare anche al primo login dopo l'esito, non solo se si era online
   * al momento dell'evento WebSocket. Stato locale separato dallo store
   * così la modale si chiude subito dopo l'ack, senza aspettare un
   * secondo refreshSession().
   */
  const [activeReviewNotification, setActiveReviewNotification] = useState<
    NonNullable<typeof selectedCharacter>['pendingReviewNotification'] | null
  >(null);

  useEffect(() => {
    if (selectedCharacter?.pendingReviewNotification) {
      setActiveReviewNotification(selectedCharacter.pendingReviewNotification);
    }
  }, [selectedCharacter?.pendingReviewNotification]);

  /**
   * Initialize locationStore on mount
   *
   * Always calls initialize() — the store itself decides whether the persisted
   * cache is still valid (cacheVersion match + TTL + non-empty) or needs a
   * refetch; it's cheap to call when already valid (early return, one log
   * line). Gating this on `locations.length === 0` (as before) meant anyone
   * with a non-empty persisted cache from a previous schema version NEVER
   * re-entered the store's own cacheVersion check, so a `positions: string[]`
   * -> `{name,description}[]` schema change (or any future one) would leave
   * existing users stuck on stale data indefinitely.
   */
  useEffect(() => {
    if (selectedCharacter) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn('[GameLayout] Initializing locationStore');
      }
      useLocationStore.getState().initialize(selectedCharacter._id);
    }
  }, [selectedCharacter?._id]);

  /**
   * Calculate TopBar location props from GameStateStore + locationStore
   *
   * SINGLE SOURCE OF TRUTH: currentLocationId from GameStateStore
   */
  const topBarLocationProps = useMemo(() => {
    // Default: root location (London) — excluded from locationStore.locations
    // by design (see LocationService.getAccessibleLocations), fetched separately.
    const defaultProps = {
      locationName: rootLocation?.name || 'London',
      locationImageUrl:
        rootLocation?.imageUrl ||
        (rootLocation?.image ? `/artifacts/locations/${rootLocation.image}` : '/images/topbar/location-image.png'),
      isInLondon: true,
      description: rootLocation?.description,
      positions: rootLocation?.positions || [],
      descriptionImages: rootLocation?.descriptionImages || [],
    };

    // Guard: No currentLocation set
    if (!currentLocationId) {
      return defaultProps;
    }

    // Find location by ID from locationStore
    const currentLocation = locations.find((loc) => loc._id === currentLocationId);

    // If location not found, fallback to default
    if (!currentLocation) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn('[GameLayout] Location not found for ID:', { args: [currentLocationId, '| Available locations:', locations.length] });
      }
      return defaultProps;
    }

    // Return actual location props
    return {
      locationName: currentLocation.name,
      locationImageUrl:
        currentLocation.imageUrl ||
        (currentLocation.image ? `/artifacts/locations/${currentLocation.image}` : '/images/topbar/location-image.png'),
      isInLondon: currentLocation.slug === 'londra', // Slug-based check is correct (SEO-friendly)
      description: currentLocation.description,
      positions: currentLocation.positions || [],
      descriptionImages: currentLocation.descriptionImages || [],
    };
  }, [currentLocationId, locations, rootLocation]);

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
   * Open Market window (Mercato)
   */
  const handleMarketClick = () => {
    openWindow('utility', {
      utilityName: 'market',
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
      logger.error('[GameLayout] Logout error:', { error });
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

  /**
   * WebSocket listener for real-time forum badge updates (unread bacheche).
   * Must work even when the forum modal is closed.
   */
  useEffect(() => {
    const unsubscribe = onForumEvent((event) => {
      if (
        event.type === 'forum:discussion:created' ||
        event.type === 'forum:post:created' ||
        event.type === 'forum:notification:new'
      ) {
        queryClient.invalidateQueries({ queryKey: forumPreferenceKeys.unreadSummary() });
      }

      if (event.type === 'forum:notification:new') {
        queryClient.invalidateQueries({ queryKey: forumSocialKeys.unreadCount() });
        queryClient.invalidateQueries({ queryKey: ['forum', 'notifications'] });
      }
    });
    return unsubscribe;
  }, [onForumEvent, queryClient]);

  return (
    <>
      <div className={styles.gameContainer}>
        {/* ========================================
          SIDEBAR - Left side with character info
          Sotto i 1600px non sta più inline: diventa un drawer, montato solo
          quando aperto (backdrop + pannello), invece di essere sempre nel
          flusso flex.
          ======================================== */}
        {(!isCompactLayout || isSidebarDrawerOpen) && (
        <>
        {isCompactLayout && (
          <div
            className={styles.sidebarBackdrop}
            onClick={() => setIsSidebarDrawerOpen(false)}
            aria-hidden="true"
          />
        )}
        <aside className={`${styles.sidebar} ${isCompactLayout ? styles.sidebarDrawer : ''}`.trim()}>
          {isCompactLayout && (
            <button
              type="button"
              className={styles.sidebarDrawerClose}
              onClick={() => setIsSidebarDrawerOpen(false)}
              aria-label="Chiudi menu personaggio"
            >
              ✕
            </button>
          )}

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
                <span className={styles.offGameUnreadCount}>
                  ({unreadOffGameChatCount})
                </span>
              )}
            </button>

            <div className={styles.footerText}>THE VOICES OF LONDON</div>
          </div>
        </aside>
        </>
        )}

        {/* ========================================
          MAIN CONTENT - Right side with top bar + content
          ======================================== */}
        <div className={`${styles.mainContent} ${router.pathname === '/locations' ? styles.locations : ''}`.trim()}>
          {/* Top Bar - Quick actions and notifications */}
          <TopBar
            onQuickMapClick={handleQuickMapClick}
            onOnGameMailClick={handleOnGameMailClick}
            onForumClick={handleForumClick}
            onTicketClick={handleTicketClick}
            onAudioOptionsClick={handleAudioOptionsClick}
            onChatOptionsClick={handleChatOptionsClick}
            onMarketClick={handleMarketClick}
            onCharacterDirectoryClick={handleCharacterDirectoryClick}
            onCharacterFaceClaimClick={handleCharacterFaceClaimClick}
            onLogoutClick={handleLogout}
            unreadOnGameMailCount={unreadMailCount}
            unreadForumCount={forumUnreadSummary?.count ?? 0}
            onOffGameChatClick={handleOffGameChatClick}
            unreadOffGameChatCount={unreadOffGameChatCount}
            unreadTicketsCount={unreadTicketsCount}
            canAccessAdmin={
              adminPanelAccessFromSession || user?.canAccessAdminPanel === true
            }
            locationName={topBarLocationProps.locationName}
            locationImageUrl={topBarLocationProps.locationImageUrl}
            isInLondon={topBarLocationProps.isInLondon}
            onLocationDisplayClick={() => setShowLocationInfo(true)}
            showSidebarToggle={isCompactLayout && !isMobileShell}
            isSidebarOpen={isSidebarDrawerOpen}
            onToggleSidebar={() => setIsSidebarDrawerOpen((v) => !v)}
            sidebarToggleAvatar={selectedCharacter?.avatar ?? undefined}
            isMobileShell={isMobileShell}
          />

          {/* Body Container - Page content */}
          <main className={styles.bodyContainer}>{children}</main>
        </div>

        {/* ========================================
          OVERLAYS - Character sheets, chat panels, etc.
          ======================================== */}
        {/* Window Manager - Renders all open windows */}
        <WindowRenderer />
        <AudioManagerController />

        {/* Minimized Windows Bar - Bottom bar for minimized windows */}
        <MinimizedWindowsBar />

        {/* Connection Status - Shows overlay when WebSocket disconnects */}
        <ConnectionStatus />
      </div>

      {/* Forum Modal - Full screen overlay */}
      {isForumOpen && <ForumModal />}

      {/* Presence Modal - Side drawer */}
      <PresenceModal />

      {/* Esito approvazione/rifiuto personaggio non ancora confermato */}
      {activeReviewNotification && selectedCharacter && (
        <CharacterReviewOutcomeModal
          characterId={selectedCharacter._id}
          notification={activeReviewNotification}
          onAcknowledged={() => {
            setActiveReviewNotification(null);
            void refreshSession();
          }}
        />
      )}

      {/* Mobile Tab Bar - sotto MOBILE_SHELL_BREAKPOINT: Presenti | Game | Bacheca */}
      {isMobileShell && <MobileTabBar unreadForumCount={forumUnreadSummary?.count ?? 0} />}

      {/* Location Info Modal - Name, description and points of interest */}
      {showLocationInfo && (
        <LocationInfoModal
          locationName={topBarLocationProps.locationName}
          description={topBarLocationProps.description}
          descriptionImages={topBarLocationProps.descriptionImages}
          positions={topBarLocationProps.positions}
          onClose={() => setShowLocationInfo(false)}
        />
      )}

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
              <p className={styles.utilityPopupPlaceholderNote}>
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
            <div className={`${styles.utilityPopupBody} ${styles.utilityPopupBodyLeft}`}>
              <div className={styles.optionGroupLabel}>
                Quando arriva un nuovo messaggio mentre stai rileggendo la chat più in alto:
              </div>
              <div className={styles.optionGroup} role="radiogroup" aria-label="Comportamento auto-scroll chat">
                <label className={styles.optionCard}>
                  <input
                    type="radio"
                    name="chatAutoScrollMode"
                    value="button"
                    checked={chatAutoScrollMode === 'button'}
                    onChange={() => setChatAutoScrollMode('button')}
                  />
                  <span className={styles.optionCardText}>
                    <strong>Mostra un pulsante &quot;Nuovi messaggi&quot;</strong>
                    <span>Resti dove sei a leggere; un pulsante in fondo alla chat ti avvisa e ti riporta giù con un click.</span>
                  </span>
                </label>
                <label className={styles.optionCard}>
                  <input
                    type="radio"
                    name="chatAutoScrollMode"
                    value="force"
                    checked={chatAutoScrollMode === 'force'}
                    onChange={() => setChatAutoScrollMode('force')}
                  />
                  <span className={styles.optionCardText}>
                    <strong>Scorri sempre in fondo</strong>
                    <span>Ogni nuovo messaggio ti riporta subito in fondo alla chat, anche se stavi leggendo più in alto.</span>
                  </span>
                </label>
              </div>

              <div className={styles.optionGroupLabel}>
                Suono quando arriva un messaggio da un altro personaggio:
              </div>
              <div className={styles.optionGroup} role="radiogroup" aria-label="Suono notifica chat">
                {CHAT_NOTIFICATION_SOUND_FILES.map((file) => (
                  <label key={file} className={styles.optionCard}>
                    <input
                      type="radio"
                      name="chatNotificationSound"
                      value={file}
                      checked={chatNotificationSound === file}
                      onChange={() => setChatNotificationSound(file)}
                    />
                    <span className={styles.optionCardText}>
                      <strong>{CHAT_NOTIFICATION_SOUND_LABELS[file]}</strong>
                    </span>
                    <button
                      type="button"
                      className={styles.optionPreviewButton}
                      onClick={(e) => {
                        e.preventDefault();
                        handlePreviewSound(file);
                      }}
                      aria-label={`Ascolta ${CHAT_NOTIFICATION_SOUND_LABELS[file]}`}
                    >
                      ▶
                    </button>
                  </label>
                ))}
                <label className={styles.optionCard}>
                  <input
                    type="radio"
                    name="chatNotificationSound"
                    value="none"
                    checked={chatNotificationSound === 'none'}
                    onChange={() => setChatNotificationSound('none')}
                  />
                  <span className={styles.optionCardText}>
                    <strong>Nessun suono</strong>
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
