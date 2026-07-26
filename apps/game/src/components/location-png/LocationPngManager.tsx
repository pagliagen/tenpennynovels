'use client';

import { useEffect, useState } from 'react';

import { locationPngApi } from '@/lib/api/locationPng';
import styles from '@/styles/components/fake-png/FakePngManager.module.scss';
import type { LocationPng } from '@/types/locationPng';

import { LocationPngForm } from './LocationPngForm';
import { logger } from '@/lib/logger';

interface LocationPngManagerProps {
  locationId: string;
  onClose: () => void;
  /** Called whenever the list changes (create/delete), so the caller can refetch its own query. */
  onChanged?: () => void;
}

const MAX_LOCATION_PNGS = 20;

export function LocationPngManager({ locationId, onClose, onChanged }: LocationPngManagerProps) {
  const [locationPngs, setLocationPngs] = useState<LocationPng[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadLocationPngs();
  }, [locationId]);

  const loadLocationPngs = async () => {
    try {
      setLoading(true);
      const data = await locationPngApi.list(locationId);
      setLocationPngs(data.locationPngs);
    } catch (error) {
      logger.error('Failed to load location PNGs:', { error });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: { name: string; surname?: string; avatar?: string }) => {
    try {
      await locationPngApi.create(locationId, data);
      await loadLocationPngs();
      setIsCreating(false);
      onChanged?.();
    } catch (error) {
      logger.error('Failed to create location PNG:', { error });
      alert('Errore durante la creazione');
    }
  };

  const handleDelete = async (pngId: string) => {
    if (!confirm('Eliminare questo PNG della location?')) return;

    try {
      await locationPngApi.delete(locationId, pngId);
      await loadLocationPngs();
      onChanged?.();
    } catch (error) {
      logger.error('Failed to delete location PNG:', { error });
      alert('Errore durante l\'eliminazione');
    }
  };

  if (loading) {
    return (
      <div className={styles.modal}>
        <div className={styles.modalContent}>Caricamento...</div>
      </div>
    );
  }

  if (isCreating) {
    return (
      <div className={styles.modal}>
        <div className={styles.modalContent}>
          <h2>Crea PNG della location</h2>
          <LocationPngForm
            locationId={locationId}
            onSubmit={handleCreate}
            onCancel={() => setIsCreating(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>PNG della location ({locationPngs.length}/{MAX_LOCATION_PNGS})</h2>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        <p style={{ marginTop: 0 }}>
          Personaggi rapidi (es. &quot;il barista&quot;) usabili per postare al posto del tuo
          nome/avatar in questa location. Visibili e modificabili solo da master e proprietario.
        </p>

        <div className={styles.slotsGrid}>
          {locationPngs.map((png) => (
            <div key={png._id} className={styles.slotCard}>
              <div className={styles.slotAvatar}>
                {png.avatar ? (
                  <img src={png.avatar} alt={png.name} />
                ) : (
                  <div className={styles.avatarPlaceholder}>{png.name[0]?.toUpperCase()}</div>
                )}
              </div>
              <div className={styles.slotInfo}>
                <div className={styles.slotName}>
                  {png.name}{png.surname ? ` ${png.surname}` : ''}
                </div>
              </div>
              <div className={styles.slotActions}>
                <button className={styles.actionButton} onClick={() => handleDelete(png._id)}>
                  Elimina
                </button>
              </div>
            </div>
          ))}

          {locationPngs.length < MAX_LOCATION_PNGS && (
            <div className={styles.slotEmpty} onClick={() => setIsCreating(true)}>
              <div className={styles.plusIcon}>+</div>
              <div className={styles.slotLabel}>Aggiungi PNG</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
