'use client';

import { useState } from 'react';

import styles from '@/styles/components/fake-png/FakePngManager.module.scss';

import { ImageUploader } from '../shared/ImageUploader';

interface LocationPngFormProps {
  locationId: string;
  onSubmit: (data: { name: string; surname?: string; avatar?: string }) => void;
  onCancel: () => void;
}

export function LocationPngForm({ locationId, onSubmit, onCancel }: LocationPngFormProps) {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [avatar, setAvatar] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Nome richiesto');
      return;
    }

    onSubmit({
      name: name.trim(),
      surname: surname.trim() || undefined,
      avatar: avatar.trim() || undefined,
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label>Nome *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={50}
          placeholder='Es. "il barista"'
        />
      </div>

      <div className={styles.formGroup}>
        <label>Cognome</label>
        <input
          type="text"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          maxLength={50}
          placeholder="Opzionale"
        />
      </div>

      <div className={styles.formGroup}>
        <label>Avatar</label>
        <ImageUploader
          value={avatar}
          onChange={setAvatar}
          entityType="locations"
          entityId={locationId}
          placeholder="Trascina un'immagine qui oppure clicca per selezionare"
        />
      </div>

      <div className={styles.formActions}>
        <button type="button" onClick={onCancel} className={styles.cancelButton}>
          Annulla
        </button>
        <button type="submit" className={styles.submitButton}>
          Crea
        </button>
      </div>
    </form>
  );
}
