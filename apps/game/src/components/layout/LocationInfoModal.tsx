/**
 * Location Info Modal
 *
 * Popup shown when clicking the location display in the TopBar.
 * Shows the current location's name, description, and points of interest
 * (positions) with their own descriptions.
 *
 * @module components/layout/LocationInfoModal
 * @since 2.0.0
 */

'use client';

import { useEffect } from 'react';

import styles from '@/styles/components/LocationInfoModal.module.scss';

interface LocationPosition {
  name: string;
  description?: string;
  image?: string;
}

interface LocationInfoModalProps {
  locationName: string;
  description?: string;
  descriptionImages?: string[];
  positions?: LocationPosition[];
  onClose: () => void;
}

export function LocationInfoModal({
  locationName,
  description,
  descriptionImages = [],
  positions = [],
  onClose,
}: LocationInfoModalProps): JSX.Element {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{locationName}</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Chiudi"
          >
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {(description || descriptionImages.length > 0) && (
            <div className={styles.descriptionRow}>
              {description && <p className={styles.description}>{description}</p>}

              {descriptionImages.length > 0 && (
                <div className={styles.descriptionImages}>
                  {descriptionImages.map((src) => (
                    <img
                      key={src}
                      src={src}
                      alt={locationName}
                      className={styles.descriptionImage}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {positions.length > 0 && (
            <div className={styles.positionsSection}>
              <h3 className={styles.positionsTitle}>Punti d&apos;interesse</h3>
              <ul className={styles.positionsList}>
                {positions.map((position) => (
                  <li key={position.name} className={styles.positionItem}>
                    {position.image && (
                      <img
                        src={position.image}
                        alt={position.name}
                        className={styles.positionImage}
                      />
                    )}
                    <div className={styles.positionText}>
                      <div className={styles.positionName}>{position.name}</div>
                      {position.description && (
                        <div className={styles.positionDescription}>{position.description}</div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
