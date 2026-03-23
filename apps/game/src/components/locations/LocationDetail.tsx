/**
 * Location Detail Component
 *
 * Displays detailed information about a location.
 * Used in:
 * - Right panel of split-panel view (DistrictView)
 * - Standalone location detail pages
 *
 * Features:
 * - Location image (if available)
 * - Name, description, district
 * - Statistics (occupants, features)
 * - Action buttons ("Entra In Chat", "Visit Shop", etc.)
 *
 * @module components/locations/LocationDetail
 * @since 2.0.0
 */

'use client';

import { useRouter } from 'next/router';

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

  return (
    <div className={styles.detailContainer}>
      {/* Location Image */}
      {location.imageUrl && (
        <div className={styles.imageWrapper}>
          <img
            src={location.imageUrl}
            alt={location.name}
            className={styles.locationImage}
          />
        </div>
      )}

      {/* Location Header */}
      <div className={styles.header}>
        <h2 className={styles.locationName}>{location.name}</h2>
        <span className={styles.locationDistrict}>{location.district}</span>
      </div>

      {/* Location Description */}
      <div className={styles.description}>
        <p>{location.description}</p>
      </div>

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

      {/* Action Buttons */}
      {showActions && (
        <div className={styles.actions}>
          {/* Enter Chat Button */}
          {location.hasChat && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleEnterChat}
            >
              Entra In Chat
            </button>
          )}
        </div>
      )}

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
