/**
 * Location Detail Component
 *
 * Displays detailed information about a location.
 * Used in:
 * - Right panel of split-panel view (DistrictView)
 * - Standalone location detail pages
 *
 * Features:
 * - Name, district header
 * - Location image with typewriter-animated description and "Entra" button overlaid (if available)
 * - Statistics (occupants, features)
 *
 * @module components/locations/LocationDetail
 * @since 2.0.0
 */

'use client';

import { useRouter } from 'next/router';

import { useTypewriter } from '@/hooks/useTypewriter';
import { playTypewriterTick } from '@/lib/audio';
import styles from '@/styles/components/locations/detail.module.scss';
import type { AccessibleLocation } from '@/types/location';

/**
 * Location Detail Props
 */
interface LocationDetailProps {
  /** Location to display */
  location: AccessibleLocation | null;
  /** Optional callback when "Entra In Chat" is clicked (overrides default navigation) */
  onEnterChat?: (locationId: string) => void;
  /** Show action buttons */
  showActions?: boolean;
}

/**
 * Location Detail Component
 *
 * Renders detailed information about a location.
 *
 * @component
 * @param {LocationDetailProps} props - Component props
 * @returns {JSX.Element} Location detail panel
 *
 * @example
 * ```tsx
 * <LocationDetail
 *   location={selectedLocation}
 *   showActions={true}
 * />
 * ```
 */
export function LocationDetail({
  location,
  onEnterChat,
  showActions = true,
}: LocationDetailProps): JSX.Element {
  const router = useRouter();

  // NOTE: hook must run unconditionally (before the early return) per Rules of Hooks
  const { displayedText: typedDescription, isDone: isTypingDone } = useTypewriter(
    location?.description || '',
    {
      minSpeed: 18,
      maxSpeed: 55,
      onChar: (char) => {
        if (char.trim()) playTypewriterTick();
      },
    }
  );

  /**
   * Handle "Entra In Chat" button click
   */
  const handleEnterChat = () => {
    if (!location) return;

    if (onEnterChat) {
      onEnterChat(location._id);
    } else {
      // Default navigation to chat page (slug-based routing for SEO)
      router.push(`/locations/${location.slug}/chat`);
    }
  };


  // Empty state
  if (!location) {
    return (
      <div className={styles.detailContainer}>
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Seleziona una location per vedere i dettagli</p>
        </div>
      </div>
    );
  }

  const hasOccupants = (location.occupantCount || 0) > 0;
  const imageSrc = location.imageUrl || (location.image ? `/artifacts/locations/${location.image}` : undefined);

  const enterButton = showActions && location.hasChat && (
    <button
      type="button"
      className={imageSrc ? styles.enterButtonOverlay : styles.primaryButton}
      onClick={handleEnterChat}
    >
      Entra In Chat
    </button>
  );

  return (
    <div className={styles.detailContainer}>
      {/* Location Header */}
      <div className={styles.header}>
        <h2 className={styles.locationName}>{location.name}</h2>
        <span className={styles.locationDistrict}>{location.district}</span>
      </div>

      {/* Location Image with description overlay + Entra button */}
      {imageSrc ? (
        <div className={styles.imageBlock}>
          <img
            src={imageSrc}
            alt={location.name}
            className={styles.locationImage}
          />
          <div className={styles.imageOverlayGradient} />
          <p className={styles.overlayDescription}>
            {typedDescription}
            {!isTypingDone && <span className={styles.typewriterCursor} aria-hidden="true" />}
          </p>
          {enterButton}
        </div>
      ) : (
        <>
          {/* Location Description (fallback when no image is available) */}
          <div className={styles.description}>
            <p>
              {typedDescription}
              {!isTypingDone && <span className={styles.typewriterCursor} aria-hidden="true" />}
            </p>
          </div>
          {enterButton && <div className={styles.actions}>{enterButton}</div>}
        </>
      )}

      {/* Location Stats */}
      {hasOccupants ?
        <div className={styles.stats}>
          {/* Occupants */}
          {hasOccupants && (
            <div className={styles.stat}>
              <span className={styles.statIcon}>👥</span>
              <span className={styles.statLabel}>Presenti:</span>
              <span className={styles.statValue}>{location.occupantCount}</span>
            </div>
          )}
        </div>
        : null}

      {/* Occupants List (if present) */}
      {hasOccupants && location.occupants && location.occupants.length > 0 && (
        <div className={styles.occupantsList}>
          <h3 className={styles.occupantsTitle}>Personaggi Presenti</h3>
          <ul className={styles.occupantsItems}>
            {location.occupants.map((occupant) => (
              <li key={occupant.characterId} className={styles.occupantItem}>
                <span className={styles.occupantName}>{occupant.characterName}</span>
                {occupant.currentTag && (
                  <span className={styles.occupantTag}>({occupant.currentTag})</span>
                )}
                {!occupant.isActive && (
                  <span className={styles.occupantInactive}>(offline)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
