/**
 * CreateLocationModal - Modale per la creazione di una nuova location
 *
 * Form con campi: nome, descrizione, livello, distretto, parent, settings, immagine
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/FormField';
import { ImageUploader } from '@/components/shared/ImageUploader';
import { useCreateLocation, useLocations } from '@/hooks/api/useLocations';
import { useNotificationStore } from '@/store/notificationStore';
import type { CreateLocationData, LocationLevel } from '@/types/api/Location';
import styles from '@/styles/components/CreateLocationModal.module.scss';

interface CreateLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedParentId?: string | null;
  preselectedLevel?: LocationLevel;
}

const LEVEL_OPTIONS = [
  { value: 'root', label: 'Root (Mondo/Regione)' },
  { value: 'district', label: 'Distretto (Quartiere/Zona)' },
  { value: 'location', label: 'Location (Luogo specifico)' },
];

export function CreateLocationModal({
  isOpen,
  onClose,
  preselectedParentId,
  preselectedLevel
}: CreateLocationModalProps): React.ReactElement | null {
  const createLocation = useCreateLocation();
  const addNotification = useNotificationStore(state => state.addNotification);
  const { data: locationsData } = useLocations({ showHidden: true });

  const [formData, setFormData] = useState<CreateLocationData>({
    name: '',
    description: '',
    locationLevel: preselectedLevel || 'location',
    district: '',
    parentLocation: preselectedParentId || null,
    imageUrl: '',
    tags: [],
    positions: [],
    maxOccupants: undefined,
    settings: {
      visible: true,
      chat: true,
      shop: false,
      private: false,
      bot_enabled: false
    }
  });

  const [tagsInput, setTagsInput] = useState('');
  const [positionsInput, setPositionsInput] = useState('');

  useEffect(() => {
    if (preselectedParentId) {
      setFormData(prev => ({ ...prev, parentLocation: preselectedParentId }));
    }
    if (preselectedLevel) {
      setFormData(prev => ({ ...prev, locationLevel: preselectedLevel }));
    }
  }, [preselectedParentId, preselectedLevel]);

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

    const data: CreateLocationData = {
      ...formData,
      tags: tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [],
      positions: positionsInput ? positionsInput.split(',').map(p => p.trim()).filter(Boolean) : [],
    };

    try {
      await createLocation.mutateAsync(data);
      addNotification({ type: 'success', message: `Location "${data.name}" creata con successo` });
      onClose();
    } catch (error) {
      addNotification({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore nella creazione'
      });
    }
  };

  const allLocations = locationsData?.data?.locations || [];
  const parentOptions = allLocations
    .filter(l => l.locationLevel !== 'location')
    .map(l => ({ value: l.id, label: `${l.name} (${l.locationLevel})` }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Crea Nuova Location"
      size="large"
      footer={
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose} type="button">
            Annulla
          </button>
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={createLocation.isPending || !formData.name.trim() || !formData.description.trim()}
          >
            {createLocation.isPending ? 'Creazione...' : 'Crea Location'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.row}>
          <FormField
            label="Nome"
            name="name"
            required
            value={formData.name}
            onChange={(e: any) => handleChange('name', e.target.value)}
            placeholder="es. Whitechapel Hospital"
          />
          <FormField
            label="Livello"
            name="locationLevel"
            type="select"
            required
            value={formData.locationLevel}
            onChange={(e: any) => handleChange('locationLevel', e.target.value)}
            options={LEVEL_OPTIONS}
          />
        </div>

        <FormField
          label="Descrizione"
          name="description"
          type="textarea"
          required
          value={formData.description}
          onChange={(e: any) => handleChange('description', e.target.value)}
          placeholder="Descrizione della location..."
        />

        <div className={styles.row}>
          <FormField
            label="Distretto"
            name="district"
            value={formData.district}
            onChange={(e: any) => handleChange('district', e.target.value)}
            placeholder="es. Whitechapel"
            helpText="Opzionale per location di livello root"
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
            helpText="Salva la location per abilitare l'upload delle immagini"
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
            placeholder="es. 20"
            min={1}
            max={100}
          />
          <FormField
            label="Tags (separati da virgola)"
            name="tags"
            value={tagsInput}
            onChange={(e: any) => setTagsInput(e.target.value)}
            placeholder="es. ospedale, pubblico, whitechapel"
          />
        </div>

        <FormField
          label="Posizioni (separate da virgola)"
          name="positions"
          value={positionsInput}
          onChange={(e: any) => setPositionsInput(e.target.value)}
          placeholder="es. Bancone, Tavolo 1, Angolo Nord"
          helpText="Posizioni fisiche all'interno della location"
        />
      </form>
    </Modal>
  );
}
