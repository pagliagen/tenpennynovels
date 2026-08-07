/**
 * Edit Avatar/Audio Form
 *
 * Modifica scheda accessibile dall'header della finestra (owner/master),
 * per ora limitata ai due soli campi editabili anche a personaggio approvato:
 * avatar (ritratto) e audioTheme (link YouTube riprodotto quando la scheda
 * è in primo piano). Gli altri campi restano bloccati per il momento.
 *
 * @module components/character/forms/EditAvatarAudioForm
 * @since 2.0.0
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { CharacterSheetData } from '@/hooks/useCharacterSheetData';
import { characterApi } from '@/lib/api/character';
import styles from '@/styles/components/character/CharacterEditForm.module.scss';
import { logger } from '@/lib/logger';

interface EditAvatarAudioFormProps {
  characterId: string;
  character: CharacterSheetData['character'];
  onSuccess: () => void;
  onCancel: () => void;
}

export function EditAvatarAudioForm({
  characterId,
  character,
  onSuccess,
  onCancel
}: EditAvatarAudioFormProps): JSX.Element {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    avatar: character.avatar || '',
    audioTheme: character.audioTheme || ''
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => characterApi.update(characterId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character-sheet', characterId] });
      onSuccess();
    },
    onError: (error: any) => {
      logger.error('[EditAvatarAudioForm] Update failed:', { error });
      alert(`Errore durante il salvataggio: ${error.message || 'Riprova'}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.editForm}>
      <div className={styles.formGroup}>
        <label htmlFor="avatar" className={styles.label}>
          Avatar (link immagine)
        </label>
        <input
          type="url"
          id="avatar"
          value={formData.avatar}
          onChange={(e) => setFormData((prev) => ({ ...prev, avatar: e.target.value }))}
          className={styles.input}
          placeholder="https://…"
          maxLength={500}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="audioTheme" className={styles.label}>
          Link YouTube musica del personaggio
        </label>
        <input
          type="url"
          id="audioTheme"
          value={formData.audioTheme}
          onChange={(e) => setFormData((prev) => ({ ...prev, audioTheme: e.target.value }))}
          className={styles.input}
          placeholder="https://www.youtube.com/watch?v=…"
          maxLength={500}
        />
      </div>

      <div className={styles.formActions}>
        <button
          type="button"
          onClick={onCancel}
          className={styles.cancelButton}
          disabled={updateMutation.isPending}
        >
          Annulla
        </button>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Salvataggio...' : 'Salva Modifiche'}
        </button>
      </div>
    </form>
  );
}
