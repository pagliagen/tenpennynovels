import React from 'react';
import { useRouter } from 'next/router';
import { useGame } from '@/contexts/GameContext';
import styles from '@/styles/components/TopBar.module.scss';

interface TopBarProps {
  onQuickMapClick?: () => void; // Zona 4
  onOnGameMailClick?: () => void; // Zona 5
  onOffGameChatClick?: () => void; // Zona 6
  onLocationInfoClick?: () => void; // Zona 7
  onLogoutClick?: () => void; // Zona 11
  onMarketClick?: () => void; // MERCATO
  unreadOnGameMailCount?: number;
  unreadOffGameChatCount?: number;
  characterStatus?: string; // Per mostrare MERCATO solo se APPROVED
}

export const TopBar: React.FC<TopBarProps> = ({
  onQuickMapClick,
  onOnGameMailClick,
  onOffGameChatClick,
  onLocationInfoClick,
  onLogoutClick,
  onMarketClick,
  unreadOnGameMailCount = 0,
  unreadOffGameChatCount = 0,
  characterStatus
}) => {
  const { character } = useGame();
  const router = useRouter();

  // Get current location name
  const getCurrentLocationName = () => {
    // Try to get from router if on location page
    if (router.pathname.includes('/locations/')) {
      return router.query.locationId ? 'Location' : 'London';
    }
    return character?.currentLocationName || 'London';
  };

  const locationName = getCurrentLocationName();

  return (
    <div className={styles.topBar}>
      <div className={styles.topBarLeft}>
        <img 
          src="/images/topbar/topbar-left.png" 
          alt="Topbar left decoration" 
          className={styles.decorationLeft}
        />
      </div>
      
      <div className={styles.topBarContent}>
        {/* Icons Container Left - 3 elementi */}
        <div className={styles.iconsContainerLeft}>
          {/* Zona 4: Mappa Rapida */}
          <button
            type="button"
            onClick={onQuickMapClick}
            className={styles.iconButton}
            title="Mappa Rapida"
          >
            <img 
              src="/images/topbar/icon-quick-map.png" 
              alt="Mappa Rapida"
              className={styles.iconImage}
            />
          </button>

          {/* Zona 5: Messaggi OnGame (Posta Vittoriana) */}
          <button
            type="button"
            onClick={onOnGameMailClick}
            className={styles.iconButton}
            title="Posta Vittoriana"
          >
            <img 
              src="/images/topbar/location-image.png" 
              alt="Posta Vittoriana"
              className={styles.iconImage}
            />
            {unreadOnGameMailCount > 0 && (
              <span className={styles.notificationBadge}>
                {unreadOnGameMailCount > 99 ? '99+' : unreadOnGameMailCount}
              </span>
            )}
          </button>

          {/* Zona 6: Messaggi OffGame (Chat OffGame) */}
          <button
            type="button"
            onClick={onOffGameChatClick}
            className={styles.iconButton}
            title="Chat OffGame"
          >
            <img 
              src="/images/topbar/icon-ticket.png" 
              alt="Chat OffGame"
              className={styles.iconImage}
            />
            {unreadOffGameChatCount > 0 && (
              <span className={styles.notificationBadge}>
                {unreadOffGameChatCount > 99 ? '99+' : unreadOffGameChatCount}
              </span>
            )}
          </button>
        </div>

        {/* Location Name - Centrale */}
        <div className={styles.locationDisplay}>
          {locationName}
        </div>

        {/* Icons Container Right - 3 elementi */}
        <div className={styles.iconsContainerRight}>
          {/* MERCATO - Primo elemento (solo se APPROVED) */}
          {characterStatus === 'APPROVED' ? (
            <button
              type="button"
              onClick={onMarketClick}
              className={styles.iconButton}
              title="Mercato generale di Londra"
            >
              <img 
                src="/images/topbar/location-image.png" 
                alt="Mercato"
                className={styles.iconImage}
              />
            </button>
          ) : (
            <button
              type="button"
              className={styles.iconButton}
              disabled
              title="TBD"
            >
              {/* TBD */}
            </button>
          )}

          {/* TBD 1 - Placeholder */}
          <button
            type="button"
            className={styles.iconButton}
            disabled
            title="TBD"
          >
            {/* TBD */}
          </button>

          {/* TBD 2 - Placeholder */}
          <button
            type="button"
            className={styles.iconButton}
            disabled
            title="TBD"
          >
            {/* TBD */}
          </button>
        </div>
      </div>

      <div className={styles.topBarRight}>
        <img 
          src="/images/topbar/topbar-right.png" 
          alt="Topbar right decoration" 
          className={styles.decorationRight}
        />
        {/* Logout Button - Dentro topBarRight */}
        <button
          type="button"
          onClick={onLogoutClick}
          className={styles.logoutButton}
          title="Logout"
        >
          <img 
            src="/images/topbar/icon-exit.png" 
            alt="Logout"
            className={styles.iconImage}
          />
        </button>
      </div>
    </div>
  );
};

