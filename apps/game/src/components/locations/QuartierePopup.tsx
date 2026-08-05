/**
 * Quartiere Popup
 *
 * Shown when clicking a quartiere marker on the map (or, for Suburbs/Country
 * Side which have no quartiere tier, when clicking the district marker
 * itself). Displays the entity's name + description, and its Location
 * children as compact cards (image, description, "Entra In Chat").
 *
 * @module components/locations/QuartierePopup
 * @since 2.0.0
 */

'use client';

import { useRouter } from 'next/router';

import { Modal } from '@/components/shared/Modal';
import styles from '@/styles/components/locations/quartierePopup.module.scss';
import type { AccessibleLocation } from '@/types/location';

interface QuartierePopupProps {
  /** The quartiere, or the district itself for Suburbs/Country Side */
  entity: AccessibleLocation;
  /** Direct Location children of the entity */
  locations: AccessibleLocation[];
  onClose: () => void;
}

function LocationCard({ location }: { location: AccessibleLocation }): JSX.Element {
  const router = useRouter();
  const imageSrc = location.imageUrl || (location.image ? `/artifacts/locations/${location.image}` : undefined);
  const hasOccupants = (location.occupantCount || 0) > 0;

  const handleEnterChat = () => {
    router.push(`/locations/${location.slug}/chat`);
  };

  return (
    <div className={styles.card}>
      {imageSrc && (
        <div className={styles.cardImageWrapper}>
          <img src={imageSrc} alt={location.name} className={styles.cardImage} />
          {hasOccupants && (
            <span className={styles.occupantsBadge}>{location.occupantCount} presenti</span>
          )}
        </div>
      )}
      <div className={styles.cardBody}>
        <h3 className={styles.cardName}>{location.name}</h3>
        <p className={styles.cardDescription}>{location.description}</p>
        {location.hasChat && (
          <button type="button" className={styles.enterButton} onClick={handleEnterChat}>
            Entra In Chat
          </button>
        )}
      </div>
    </div>
  );
}

export function QuartierePopup({ entity, locations, onClose }: QuartierePopupProps): JSX.Element {
  return (
    <Modal isOpen onClose={onClose} title={entity.name} size="large">
      {entity.description && <p className={styles.entityDescription}>{entity.description}</p>}

      {locations.length === 0 ? (
        <p className={styles.emptyHint}>Nessuna location disponibile qui, per ora.</p>
      ) : (
        <div className={styles.cardsList}>
          {locations.map((location) => (
            <LocationCard key={location._id} location={location} />
          ))}
        </div>
      )}
    </Modal>
  );
}
