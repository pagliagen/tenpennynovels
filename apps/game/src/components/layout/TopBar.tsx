/**
 * Top Bar Component
 *
 * Navigation bar with quick actions, notifications, and location display.
 *
 * Features:
 * - Quick navigation (Map, OnGame Mail, OffGame Chat)
 * - Location display with conditional actions
 * - "Utilità" feature hub popup, split in two sections:
 *   - Utility OnGame: character/game-world features (Mercato — wired to the
 *     market utility window; Banca — not yet built, shown disabled)
 *   - Utility OffGame: player-level features not tied to a single character
 *     (Anagrafica, il mio Prestavolto)
 * - Separate ☰ menu (linguetta): audio/chat options, admin panel access
 *   (conditional), logout
 * - Admin panel access (conditional)
 * - Logout button
 *
 * CRITICAL: This is a PRESENTATIONAL component.
 * All callbacks are passed as props - NO business logic here.
 *
 * @module components/layout/TopBar
 * @since 2.0.0
 */

'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useGamePermission } from '@/hooks/useGamePermission';
import styles from '@/styles/components/TopBar.module.scss';
import { logger } from '@/lib/logger';

/**
 * Top Bar Props
 *
 * @interface TopBarProps
 * @since 2.0.0
 */
interface TopBarProps {
  /** Quick map button click handler */
  onQuickMapClick?: () => void;

  /** OnGame mail button click handler */
  onOnGameMailClick?: () => void;

  /** OffGame chat button click handler */
  onOffGameChatClick?: () => void;

  /** Location info/chat button click handler */
  onLocationInfoClick?: () => void;

  /** Leave location button click handler (return to London) */
  onLeaveLocationClick?: () => void;

  /** Forum button click handler */
  onForumClick?: () => void;

  /** Ticket button click handler */
  onTicketClick?: () => void;

  /** Logout button click handler */
  onLogoutClick?: () => void;

  /** Audio options button click handler */
  onAudioOptionsClick?: () => void;

  /** Chat options button click handler */
  onChatOptionsClick?: () => void;

  /** Market (Mercato) button click handler */
  onMarketClick?: () => void;

  /** Character directory button click handler */
  onCharacterDirectoryClick?: () => void;

  /** Character face claim button click handler */
  onCharacterFaceClaimClick?: () => void;

  /** Unread OnGame mail count */
  unreadOnGameMailCount?: number;

  /** Number of forum bacheche with unread content */
  unreadForumCount?: number;

  /** Unread OffGame chat count */
  unreadOffGameChatCount?: number;

  /** Unread tickets count (messages from staff not read yet) */
  unreadTicketsCount?: number;

  /** Whether user can access admin panel */
  canAccessAdmin?: boolean;

  /** Current location name */
  locationName?: string;

  /** Current location image URL */
  locationImageUrl?: string;

  /** Whether current location is London */
  isInLondon?: boolean;

  /** Click handler for the location display (opens location info popup) */
  onLocationDisplayClick?: () => void;
}

/**
 * Top Bar Component
 *
 * Renders navigation bar with icons, notifications, and location info.
 * Uses Victorian-themed images and styling.
 *
 * @component
 * @param {TopBarProps} props - Component props
 * @returns {JSX.Element} Top bar navigation
 * @since 2.0.0
 *
 * @example
 * ```tsx
 * <TopBar
 *   locationName="Baker Street"
 *   locationImageUrl="/images/locations/baker-street.png"
 *   isInLondon={false}
 *   unreadOnGameMailCount={3}
 *   onQuickMapClick={() => router.push('/locations')}
 *   onLogoutClick={handleLogout}
 * />
 * ```
 */
export function TopBar({
  onQuickMapClick,
  onOnGameMailClick,
  onLocationInfoClick,
  onLeaveLocationClick,
  onForumClick,
  onTicketClick,
  onLogoutClick,
  onAudioOptionsClick,
  onChatOptionsClick,
  onMarketClick,
  onCharacterDirectoryClick,
  onCharacterFaceClaimClick,
  unreadOnGameMailCount = 0,
  unreadForumCount = 0,
  unreadTicketsCount = 0,
  canAccessAdmin = false,
  locationName = 'London',
  locationImageUrl = '/images/topbar/location-image.png',
  isInLondon = true,
  onLocationDisplayClick,
}: TopBarProps): JSX.Element {
  // State per gestire apertura/chiusura dropdown utility (linguetta ☰)
  const [isUtilityMenuOpen, setIsUtilityMenuOpen] = useState(false);
  const utilityMenuRef = useRef<HTMLDivElement>(null);

  // Auto-fit del nome location: resta su una riga e si scala per non uscire mai dal semicerchio
  const locationNameContainerRef = useRef<HTMLDivElement>(null);
  const locationNameTextRef = useRef<HTMLSpanElement>(null);

  // State per gestire apertura/chiusura del popup "Utilità" (hub funzionalità di gioco)
  const [isFeatureHubOpen, setIsFeatureHubOpen] = useState(false);
  const featureHubRef = useRef<HTMLDivElement>(null);

  // Personaggi draft/pending non hanno accesso ai negozi (StatusRestrictions lato backend) —
  // mostriamo il bottone Mercato disabilitato con un messaggio invece di farlo fallire silenziosamente.
  const canAccessMarket = useGamePermission('game:shops:list');

  // Build URLs with sessionId for cross-origin navigation
  const [documentsUrl, setDocumentsUrl] = useState(process.env.NEXT_PUBLIC_DOCUMENTS_URL || '');
  const [managementUrl, setManagementUrl] = useState(process.env.NEXT_PUBLIC_MANAGEMENT_URL || '');

  useEffect(() => {
    // Read sessionId from sessionStorage and append to URLs
    const sessionId = sessionStorage.getItem('character_session_id');

    if (sessionId) {
      const baseDocumentsUrl = process.env.NEXT_PUBLIC_DOCUMENTS_URL || '';
      const baseManagementUrl = process.env.NEXT_PUBLIC_MANAGEMENT_URL || '';

      setDocumentsUrl(`${baseDocumentsUrl}?sessionId=${sessionId}`);
      setManagementUrl(`${baseManagementUrl}?sessionId=${sessionId}`);
    }
  }, []);

  // DEBUG: Log props received
  useEffect(() => {
    logger.info('[TopBar] 🎨 Rendered with props:', { value: {
      locationName,
      isInLondon
    } });
  }, [locationName, isInLondon]);

  // Scala il nome location per stare sempre su una riga dentro la larghezza fissa del semicerchio
  useLayoutEffect(() => {
    const container = locationNameContainerRef.current;
    const text = locationNameTextRef.current;
    if (!container || !text) return;

    const fit = () => {
      text.style.transform = 'scale(1)';
      const { paddingLeft, paddingRight } = window.getComputedStyle(container);
      const availableWidth = container.clientWidth - parseFloat(paddingLeft) - parseFloat(paddingRight);
      const naturalWidth = text.scrollWidth;
      const scale = naturalWidth > availableWidth ? availableWidth / naturalWidth : 1;
      text.style.transform = `scale(${scale})`;
    };

    fit();

    // Il font custom può caricare dopo il primo render, cambiando la larghezza naturale del testo
    document.fonts?.ready.then(fit);
  }, [locationName]);

  // Click outside handler per chiudere il dropdown (linguetta ☰)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (utilityMenuRef.current && !utilityMenuRef.current.contains(event.target as Node)) {
        setIsUtilityMenuOpen(false);
      }
    }

    if (isUtilityMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isUtilityMenuOpen]);

  // Click outside handler per chiudere il popup "Utilità"
  useEffect(() => {
    function handleClickOutsideFeatureHub(event: MouseEvent) {
      if (featureHubRef.current && !featureHubRef.current.contains(event.target as Node)) {
        setIsFeatureHubOpen(false);
      }
    }

    if (isFeatureHubOpen) {
      document.addEventListener('mousedown', handleClickOutsideFeatureHub);
      return () => document.removeEventListener('mousedown', handleClickOutsideFeatureHub);
    }
  }, [isFeatureHubOpen]);

  // Toggle utility menu (linguetta ☰)
  const handleToggleUtilityMenu = () => {
    setIsUtilityMenuOpen((prev) => !prev);
  };

  // Handle utility menu item click (linguetta ☰)
  const handleUtilityItemClick = (action?: () => void) => {
    action?.();
    setIsUtilityMenuOpen(false);
  };

  // Toggle "Utilità" feature hub popup
  const handleToggleFeatureHub = () => {
    setIsFeatureHubOpen((prev) => !prev);
  };

  // Handle feature hub item click
  const handleFeatureHubItemClick = (action?: () => void) => {
    action?.();
    setIsFeatureHubOpen(false);
  };

  return (
    <div className={styles.topBarContainer}>
      <div className={styles.topBar}>
        {/* ========================================
          LEFT DECORATION
          ======================================== */}
        <div className={styles.topBarLeft}>
          <img
            src="/images/topbar/topbar-left.png"
            alt="Topbar left decoration"
            className={styles.decorationLeft}
          />
        </div>

        {/* ========================================
          MAIN CONTENT
          ======================================== */}
        <div className={styles.topBarContent}>
          {/* Left Icons - 3 elements */}
          <div className={styles.iconsContainerLeft}>
            {/* Quick Map */}
            <button
              type="button"
              onClick={onQuickMapClick}
              className={styles.iconButton}
              title="Mappa Rapida"
            >
              <img
                src="/images/topbar/button-quick-map.png"
                alt="Mappa Rapida"
                className={styles.iconImage}
              />
            </button>

            {/* Forum (Bacheca) - Popup */}
            <button
              type="button"
              onClick={onForumClick}
              className={styles.iconButton}
              title={unreadForumCount > 0 ? `Bacheca (${unreadForumCount} argomenti con novità)` : 'Bacheca'}
            >
              <img
                src="/images/topbar/button-forum.png"
                alt="Bacheca"
                className={styles.iconImage}
              />
              {unreadForumCount > 0 && (
                <span className={styles.notificationBadge}>
                  {unreadForumCount > 99 ? '99+' : unreadForumCount}
                </span>
              )}
            </button>

            {/* OnGame Mail (Victorian Post) - Popup */}
            <button
              type="button"
              onClick={onOnGameMailClick}
              className={styles.iconButton}
              title="Posta Vittoriana"
            >
              <img
                src="/images/topbar/button-ongame.png"
                alt="Posta Vittoriana"
                className={styles.iconImage}
              />
              {unreadOnGameMailCount > 0 && (
                <span className={styles.notificationBadge}>
                  {unreadOnGameMailCount > 99 ? '99+' : unreadOnGameMailCount}
                </span>
              )}
            </button>
          </div>

          {/* Location Display - Center */}
          <div className={styles.locationDisplay}>
            <div
              className={styles.semicerchio}
              onClick={onLocationDisplayClick}
              role={onLocationDisplayClick ? 'button' : undefined}
              tabIndex={onLocationDisplayClick ? 0 : undefined}
              onKeyDown={
                onLocationDisplayClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onLocationDisplayClick();
                      }
                    }
                  : undefined
              }
              title={onLocationDisplayClick ? 'Info sulla location' : undefined}
            >
              <div
                className={styles.locationImage}
              >
                <img
                  src={locationImageUrl}
                  alt={locationName}
                  className={styles.locationImageInner}
                />
              </div>
              <div className={styles.locationName} ref={locationNameContainerRef}>
                <span className={styles.locationNameText} ref={locationNameTextRef}>
                  {locationName}
                </span>
              </div>

              {/* Conditional action buttons for non-London locations */}
              {!isInLondon && (
                <div className={styles.locationActions}>
                  {onLocationInfoClick && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLocationInfoClick();
                      }}
                      className={styles.locationChatLink}
                      title="Apri la chat della location"
                    >
                      Vai in Chat →
                    </button>
                  )}
                  {onLeaveLocationClick && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLeaveLocationClick();
                      }}
                      className={styles.locationLeaveLink}
                      title="Torna a Londra e lascia questa location"
                    >
                      Torna a Londra
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Icons - 3 elements */}
          <div className={styles.iconsContainerRight}>
            {/* Utility - Feature hub popup */}
            <div className={styles.featureHubAnchor} ref={featureHubRef}>
              <button
                type="button"
                onClick={handleToggleFeatureHub}
                className={styles.iconButton}
                title="Utilità"
                aria-label="Apri hub funzionalità"
                aria-expanded={isFeatureHubOpen}
                aria-haspopup="true"
              >
                <img
                  src="/images/topbar/button-utility.png"
                  alt="Utilità"
                  className={styles.iconImage}
                />
              </button>

              {isFeatureHubOpen && (
                <div className={styles.featureHubDropdown} role="menu">
                  <div className={styles.featureHubTitle}>Utilità</div>

                  {/* Utility OnGame: features tied to the character/game world. */}
                  <div className={styles.featureHubSectionTitle}>Utility OnGame</div>

                  {onMarketClick && (
                    canAccessMarket ? (
                      <button
                        type="button"
                        onClick={() => handleFeatureHubItemClick(onMarketClick)}
                        className={styles.featureHubItem}
                        role="menuitem"
                      >
                        🏪 Mercato
                      </button>
                    ) : (
                      <div
                        className={`${styles.featureHubItem} ${styles.featureHubItemDisabled}`}
                        role="menuitem"
                        aria-disabled="true"
                        title="Devi prima approvare il personaggio"
                      >
                        <span>🏪 Mercato</span>
                        <span className={styles.featureHubComingSoon}>Richiede personaggio approvato</span>
                      </div>
                    )
                  )}

                  {/* Coming soon: not implemented yet, shown disabled rather than hidden. */}
                  <div className={`${styles.featureHubItem} ${styles.featureHubItemDisabled}`} role="menuitem" aria-disabled="true">
                    <span>🏦 Banca</span>
                    <span className={styles.featureHubComingSoon}>Presto disponibile</span>
                  </div>

                  <div className={styles.featureHubDivider} />

                  {/* Utility OffGame: player-level features, not tied to a single character. */}
                  <div className={styles.featureHubSectionTitle}>Utility OffGame</div>

                  {onCharacterDirectoryClick && (
                    <button
                      type="button"
                      onClick={() => handleFeatureHubItemClick(onCharacterDirectoryClick)}
                      className={styles.featureHubItem}
                      role="menuitem"
                    >
                      👥 Anagrafica
                    </button>
                  )}

                  {onCharacterFaceClaimClick && (
                    <button
                      type="button"
                      onClick={() => handleFeatureHubItemClick(onCharacterFaceClaimClick)}
                      className={styles.featureHubItem}
                      role="menuitem"
                    >
                      🎭 il mio prestavolto
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Documents - Link to new page */}
            <a
              id="tpn_documenti"
              href={documentsUrl}
              target="tpn_documenti"
              rel="noopener noreferrer"
              className={styles.iconButton}
              title="Documenti"
            >
              <img
                src="/images/topbar/button-documents.png"
                alt="Documenti"
                className={styles.iconImage}
              />
            </a>

            {/* Tickets - Popup */}
            <button
              type="button"
              onClick={onTicketClick}
              className={styles.iconButton}
              title="Gestione Tickets"
            >
              <img
                src="/images/topbar/button-ticket.png"
                alt="Ticket"
                className={styles.iconImage}
              />
              {unreadTicketsCount > 0 && (
                <span className={styles.notificationBadge}>
                  {unreadTicketsCount > 99 ? '99+' : unreadTicketsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ========================================
          RIGHT DECORATION
          ======================================== */}
        <div className={styles.topBarRight}>
          <img
            src="/images/topbar/topbar-right.png"
            alt="Topbar right decoration"
            className={styles.decorationRight}
          />
        </div>
      </div>

      {/* ========================================
          UTILITY MENU DROPDOWN
          ======================================== */}
      <div className={styles.utilityButtonsContainer} ref={utilityMenuRef}>
        {/* Toggle Button (Linguetta) */}
        <button
          type="button"
          onClick={handleToggleUtilityMenu}
          className={styles.utilityToggleButton}
          title="Utilità"
          aria-label="Apri menu utilità"
          aria-expanded={isUtilityMenuOpen}
          aria-haspopup="true"
        >
          <img
            src="/images/topbar/icon-options.png"
            alt="Utilità"
            className={styles.hamburgerIcon}
          />
        </button>

        {/* Dropdown Menu */}
        {isUtilityMenuOpen && (
          <div className={styles.utilityDropdown} role="menu">
            {/* Opzioni Audio */}
            {onAudioOptionsClick && (
              <button
                type="button"
                onClick={() => handleUtilityItemClick(onAudioOptionsClick)}
                className={styles.utilityMenuItem}
                role="menuitem"
              >
                Opzioni audio
              </button>
            )}

            {/* Opzioni Chat */}
            {onChatOptionsClick && (
              <button
                type="button"
                onClick={() => handleUtilityItemClick(onChatOptionsClick)}
                className={styles.utilityMenuItem}
                role="menuitem"
              >
                Opzioni chat
              </button>
            )}

            {/* Divider before admin section */}
            {canAccessAdmin && <div className={styles.utilityMenuDivider}></div>}

            {/* Pannello Amministrazione - Conditional */}
            {canAccessAdmin && (
              <a
                id="tpn_management"
                href={managementUrl}
                target="tpn_management"
                rel="noopener noreferrer"
                className={styles.utilityMenuItem}
                role="menuitem"
                onClick={() => setIsUtilityMenuOpen(false)}
              >
                → Pannello amministrazione
              </a>
            )}

            {/* Divider */}
            <div className={styles.utilityMenuDivider} />

            {/* Logout Button */}
            <button
              type="button"
              onClick={() => handleUtilityItemClick(onLogoutClick)}
              className={styles.utilityMenuLogout}
              role="menuitem"
            >
              <img
                src="/images/topbar/icon-exit.png"
                alt="Logout"
                className={styles.logoutIcon}
              />
              LOGOUT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
