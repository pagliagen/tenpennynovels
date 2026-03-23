/**
 * Top Bar Component
 *
 * Navigation bar with quick actions, notifications, and location display.
 *
 * Features:
 * - Quick navigation (Map, OnGame Mail, OffGame Chat)
 * - Location display with conditional actions
 * - Utility buttons (Forum, Tickets, Market)
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

import { useEffect, useRef, useState } from 'react';

import styles from '@/styles/components/TopBar.module.scss';

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

  /** Utility panel button click handler */
  onUtilityClick?: () => void;

  /** Logout button click handler */
  onLogoutClick?: () => void;

  /** Audio options button click handler */
  onAudioOptionsClick?: () => void;

  /** Chat options button click handler */
  onChatOptionsClick?: () => void;

  /** Character directory button click handler */
  onCharacterDirectoryClick?: () => void;

  /** Character face claim button click handler */
  onCharacterFaceClaimClick?: () => void;

  /** Unread OnGame mail count */
  unreadOnGameMailCount?: number;

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
  onUtilityClick,
  onLogoutClick,
  onAudioOptionsClick,
  onChatOptionsClick,
  onCharacterDirectoryClick,
  onCharacterFaceClaimClick,
  unreadOnGameMailCount = 0,
  unreadTicketsCount = 0,
  canAccessAdmin = false,
  locationName = 'London',
  locationImageUrl = '/images/topbar/location-image.png',
  isInLondon = true,
}: TopBarProps): JSX.Element {
  // State per gestire apertura/chiusura dropdown utility
  const [isUtilityMenuOpen, setIsUtilityMenuOpen] = useState(false);
  const utilityMenuRef = useRef<HTMLDivElement>(null);

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
    console.log('[TopBar] 🎨 Rendered with props:', {
      locationName,
      isInLondon
    });
  }, [locationName, isInLondon]);

  // Click outside handler per chiudere il dropdown
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

  // Toggle utility menu
  const handleToggleUtilityMenu = () => {
    setIsUtilityMenuOpen((prev) => !prev);
  };

  // Handle utility menu item click
  const handleUtilityItemClick = (action?: () => void) => {
    action?.();
    setIsUtilityMenuOpen(false);
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
              title="Bacheca"
            >
              <img
                src="/images/topbar/button-forum.png"
                alt="Bacheca"
                className={styles.iconImage}
              />
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
            <div className={styles.semicerchio}>
              <img
                src={locationImageUrl}
                alt={locationName}
                className={styles.locationImage}
              />
              <div className={styles.locationName}>{locationName}</div>

              {/* Conditional action buttons for non-London locations */}
              {!isInLondon && (
                <div className={styles.locationActions}>
                  {onLocationInfoClick && (
                    <button
                      type="button"
                      onClick={onLocationInfoClick}
                      className={styles.locationChatLink}
                      title="Apri la chat della location"
                    >
                      Vai in Chat →
                    </button>
                  )}
                  {onLeaveLocationClick && (
                    <button
                      type="button"
                      onClick={onLeaveLocationClick}
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
            {/* Utility - Popup */}
            <button
              type="button"
              onClick={onUtilityClick}
              className={styles.iconButton}
              title={unreadTicketsCount > 0 ? `Utilità (${unreadTicketsCount} ticket non letti)` : 'Utilità'}
            >
              <img
                src="/images/topbar/button-utility.png"
                alt="Utilità"
                className={styles.iconImage}
              />
              {unreadTicketsCount > 0 && (
                <span className={styles.notificationBadge}>
                  {unreadTicketsCount > 99 ? '99+' : unreadTicketsCount}
                </span>
              )}
            </button>

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
          <svg
            className={styles.hamburgerIcon}
            viewBox="0 0 24 24"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect y="4" width="24" height="2.5" rx="1.25" />
            <rect y="10.75" width="24" height="2.5" rx="1.25" />
            <rect y="17.5" width="24" height="2.5" rx="1.25" />
          </svg>
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

            {/* Anagrafica Personaggi */}
            {onCharacterDirectoryClick && (
              <button
                type="button"
                onClick={() => handleUtilityItemClick(onCharacterDirectoryClick)}
                className={styles.utilityMenuItem}
                role="menuitem"
              >
                👥 Anagrafica
              </button>
            )}

            {/* il mio prestavolto */}
            {onCharacterFaceClaimClick && (
              <button
                type="button"
                onClick={() => handleUtilityItemClick(onCharacterFaceClaimClick)}
                className={styles.utilityMenuItem}
                role="menuitem"
              >
                🎭 il mio prestavolto
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
