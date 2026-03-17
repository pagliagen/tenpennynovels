'use client';

import { useState } from 'react';
import { ImageUploader } from '../shared/ImageUploader';
import type { FakePng } from '@/types/fakePng';
import styles from '@/styles/components/fake-png/FakePngManager.module.scss';

interface FakePngFormProps {
  characterId: string;
  initialData?: FakePng;
  onSubmit: (data: { name: string; surname?: string; avatar?: string }) => void;
  onCancel: () => void;
}

export function FakePngForm({
  characterId,
  initialData,
  onSubmit,
  onCancel
}: FakePngFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [surname, setSurname] = useState(initialData?.surname || '');
  const [avatar, setAvatar] = useState(initialData?.avatar || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Nome richiesto');
      return;
    }

    onSubmit({
      name: name.trim(),
      surname: surname.trim() || undefined,
      avatar: avatar.trim() || undefined
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
          placeholder="Nome fake"
        />
      </div>

      <div className={styles.formGroup}>
        <label>Cognome</label>
        <input
          type="text"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          maxLength={50}
          placeholder="Cognome fake (opzionale)"
        />
      </div>

      <div className={styles.formGroup}>
        <label>Avatar</label>
        <ImageUploader
          value={avatar}
          onChange={setAvatar}
          entityType="characters"
          entityId={characterId}
          placeholder="Trascina un'immagine qui oppure clicca per selezionare"
        />
      </div>

      <div className={styles.formActions}>
        <button type="button" onClick={onCancel} className={styles.cancelButton}>
          Annulla
        </button>
        <button type="submit" className={styles.submitButton}>
          {initialData ? 'Salva' : 'Crea'}
        </button>
      </div>
    </form>
  );
}
