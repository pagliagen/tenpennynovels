/**
 * EditLocationModal - Modale per modificare una location esistente
 *
 * Carica i dati della location e permette di modificare tutti i campi.
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/FormField';
import { ImageUploader } from '@/components/shared/ImageUploader';
import { GenerateImageButton } from '@/components/shared/GenerateImageButton';
import { PositionsEditor } from '@/components/locations/PositionsEditor';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useLocation, useUpdateLocation, useLocations } from '@/hooks/api/useLocations';
import { useNotificationStore } from '@/store/notificationStore';
import type { UpdateLocationData } from '@/types/api/Location';
import styles from '@/styles/components/CreateLocationModal.module.scss';

interface EditLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationId: string;
}

const LEVEL_OPTIONS = [
  { value: 'root', label: 'Root (Mondo/Regione)' },
  { value: 'district', label: 'Distretto' },
  { value: 'quartiere', label: 'Quartiere' },
  { value: 'location', label: 'Location (Luogo specifico, con chat)' },
];

export function EditLocationModal({
  isOpen,
  onClose,
  locationId
}: EditLocationModalProps): React.ReactElement | null {
  const { data: location, isLoading, error } = useLocation(locationId);
  const updateLocation = useUpdateLocation();
  const addNotification = useNotificationStore(state => state.addNotification);
  const { data: locationsData } = useLocations({ showHidden: true });

  const [formData, setFormData] = useState<UpdateLocationData>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (location && !initialized) {
      setFormData({
        name: location.name,
        description: location.description,
        district: location.district,
        locationLevel: location.locationLevel,
        parentLocation: location.parentLocation,
        imageUrl: location.imageUrl || '',
        maxOccupants: location.maxOccupants || undefined,
        positions: location.positions || [],
        settings: { ...location.settings }
      });
      setInitialized(true);
    }
  }, [location, initialized]);

  useEffect(() => {
    if (!isOpen) {
      setInitialized(false);
    }
  }, [isOpen]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSettingChange = (setting: string, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      settings: { ...prev.settings, [setting]: value }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: UpdateLocationData = { ...formData };

    try {
      await updateLocation.mutateAsync({ id: locationId, data });
      addNotification({ type: 'success', message: 'Location aggiornata con successo' });
      onClose();
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nell\'aggiornamento'
      });
    }
  };

  const allLocations = locationsData?.data?.locations || [];
  const parentOptions = allLocations
    .filter(l => l.locationLevel !== 'location' && l.id !== locationId)
    .map(l => ({ value: l.id, label: `${l.name} (${l.locationLevel})` }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={location ? `Modifica: ${location.name}` : 'Modifica Location'}
      size="large"
      footer={
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} type="button">
            Annulla
          </button>
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={updateLocation.isPending || !formData.name?.trim() || !formData.description?.trim()}
          >
            {updateLocation.isPending ? 'Salvataggio...' : 'Salva Modifiche'}
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className={styles.loadingContainer}>
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className={styles.errorContainer}>
          <p>Errore nel caricamento: {error instanceof Error ? error.message : 'Errore sconosciuto'}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.row}>
            <FormField
              label="Nome"
              name="name"
              required
              value={formData.name || ''}
              onChange={(e: any) => handleChange('name', e.target.value)}
            />
            <FormField
              label="Livello"
              name="locationLevel"
              type="select"
              required
              value={formData.locationLevel || 'location'}
              onChange={(e: any) => handleChange('locationLevel', e.target.value)}
              options={LEVEL_OPTIONS}
            />
          </div>

          <FormField
            label="Descrizione"
            name="description"
            type="textarea"
            required
            value={formData.description || ''}
            onChange={(e: any) => handleChange('description', e.target.value)}
          />

          <div className={styles.row}>
            <FormField
              label="Distretto"
              name="district"
              value={formData.district || ''}
              onChange={(e: any) => handleChange('district', e.target.value)}
            />
            <FormField
              label="Location Padre"
              name="parentLocation"
              type="select"
              value={formData.parentLocation || ''}
              onChange={(e: any) => handleChange('parentLocation', e.target.value || null)}
              options={[{ value: '', label: '-- Nessun padre (root) --' }, ...parentOptions]}
            />
          </div>

          <div className={styles.section}>
            <h3>Immagine</h3>
            <ImageUploader
              value={formData.imageUrl || ''}
              onChange={(url) => handleChange('imageUrl', url)}
              entityType="locations"
              entityId={locationId}
            />
            <GenerateImageButton
              entityType="location"
              entityId={locationId}
              entityName={formData.name}
              onSuccess={(url) => handleChange('imageUrl', url)}
            />
          </div>

          <div className={styles.section}>
            <h3>Impostazioni</h3>
            <div className={styles.settingsGrid}>
              <FormField
                label="Visibile nella navigazione"
                name="visible"
                type="checkbox"
                checked={formData.settings?.visible ?? true}
                onChange={(e: any) => handleSettingChange('visible', e.target.checked)}
              />
              <FormField
                label="Chat abilitata"
                name="chat"
                type="checkbox"
                checked={formData.settings?.chat ?? true}
                onChange={(e: any) => handleSettingChange('chat', e.target.checked)}
              />
              <FormField
                label="Shop abilitato"
                name="shop"
                type="checkbox"
                checked={formData.settings?.shop ?? false}
                onChange={(e: any) => handleSettingChange('shop', e.target.checked)}
              />
              <FormField
                label="Accesso privato"
                name="private"
                type="checkbox"
                checked={formData.settings?.private ?? false}
                onChange={(e: any) => handleSettingChange('private', e.target.checked)}
              />
              <FormField
                label="Bot AI abilitato"
                name="bot_enabled"
                type="checkbox"
                checked={formData.settings?.bot_enabled ?? false}
                onChange={(e: any) => handleSettingChange('bot_enabled', e.target.checked)}
              />
            </div>
          </div>

          <div className={styles.row}>
            <FormField
              label="Max Occupanti"
              name="maxOccupants"
              type="number"
              value={formData.maxOccupants || ''}
              onChange={(e: any) => handleChange('maxOccupants', e.target.value ? parseInt(e.target.value) : undefined)}
              min={1}
              max={100}
            />
          </div>

          <div className={styles.section}>
            <h3>Posizioni</h3>
            <PositionsEditor
              positions={formData.positions || []}
              onChange={(positions) => handleChange('positions', positions)}
              locationId={locationId}
            />
          </div>

          {location && (
            <div className={styles.meta}>
              <p>Slug: <strong>{location.slug}</strong></p>
              <p>Creato da: <strong>{location.management.createdBy}</strong></p>
              <p>Ultima modifica: <strong>{new Date(location.management.lastModified).toLocaleString('it-IT')}</strong> da <strong>{location.management.modifiedBy}</strong></p>
              {location.childCount > 0 && (
                <p>Sotto-location: <strong>{location.childCount}</strong></p>
              )}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
