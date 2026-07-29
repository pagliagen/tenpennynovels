/**
 * PositionsEditor - Editor per le posizioni fisiche di una location
 *
 * Ogni posizione ha nome, immagine (upload) e descrizione.
 */

import React from 'react';
import { FormField } from '@/components/shared/FormField';
import { ImageUploader } from '@/components/shared/ImageUploader';
import type { LocationPosition } from '@/types/api/Location';
import styles from '@/styles/components/PositionsEditor.module.scss';

interface PositionsEditorProps {
  positions: LocationPosition[];
  onChange: (positions: LocationPosition[]) => void;
  locationId?: string;
}

export function PositionsEditor({
  positions,
  onChange,
  locationId
}: PositionsEditorProps): React.ReactElement {
  const updatePosition = (index: number, field: keyof LocationPosition, value: string) => {
    const next = positions.map((p, i) => (i === index ? { ...p, [field]: value } : p));
    onChange(next);
  };

  const removePosition = (index: number) => {
    onChange(positions.filter((_, i) => i !== index));
  };

  const addPosition = () => {
    onChange([...positions, { name: '', image: '', description: '' }]);
  };

  return (
    <div className={styles.list}>
      {positions.length === 0 && (
        <p className={styles.empty}>Nessuna posizione definita.</p>
      )}

      {positions.map((position, index) => (
        <div key={index} className={styles.positionRow}>
          <div className={styles.positionRowHeader}>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => removePosition(index)}
            >
              Rimuovi
            </button>
          </div>

          <FormField
            label="Nome"
            name={`position-name-${index}`}
            required
            value={position.name}
            onChange={(e: any) => updatePosition(index, 'name', e.target.value)}
            placeholder="es. Ingresso"
          />

          <ImageUploader
            value={position.image || ''}
            onChange={(url) => updatePosition(index, 'image', url)}
            entityType="locations"
            entityId={locationId}
            helpText={locationId ? undefined : 'Salva la location per abilitare l\'upload delle immagini'}
          />

          <FormField
            label="Descrizione"
            name={`position-description-${index}`}
            type="textarea"
            value={position.description || ''}
            onChange={(e: any) => updatePosition(index, 'description', e.target.value)}
            placeholder="Descrizione della posizione..."
          />
        </div>
      ))}

      <button type="button" className={styles.addBtn} onClick={addPosition}>
        + Aggiungi posizione
      </button>
    </div>
  );
}
