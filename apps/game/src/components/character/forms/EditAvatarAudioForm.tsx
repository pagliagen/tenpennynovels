/**
 * Edit Avatar/Audio Form
 *
 * Modifica scheda accessibile dall'header della finestra (owner/master),
 * per ora limitata ai due soli campi editabili anche a personaggio approvato:
 * avatar (ritratto, upload su CDN) e audioTheme (link YouTube riprodotto
 * quando la scheda è in primo piano). Gli altri campi restano bloccati.
 *
 * L'avatar si salva subito al momento dell'upload (l'endpoint dedicato
 * POST /game/characters/:id/avatar scrive avatar+profileImage lato server):
 * non serve passare dal bottone "Salva Modifiche", a differenza del link
 * musica che resta un campo testo esplicito.
 *
 * @module components/character/forms/EditAvatarAudioForm
 * @since 2.0.0
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ImageUploader } from '@/components/shared/ImageUploader';
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

  const [avatar, setAvatar] = useState(character.avatar || '');
  const [audioTheme, setAudioTheme] = useState(character.audioTheme || '');

  const handleAvatarChange = (url: string) => {
    setAvatar(url);
    // L'upload ha già salvato avatar+profileImage lato server: qui aggiorniamo
    // solo la cache locale così il resto della scheda (ritratto a sinistra) si
    // allinea subito, senza aspettare "Salva Modifiche".
    queryClient.invalidateQueries({ queryKey: ['character-sheet', characterId] });
  };

  const updateMutation = useMutation({
    mutationFn: (data: { audioTheme: string }) => characterApi.update(characterId, data),
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
    updateMutation.mutate({ audioTheme });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.editForm}>
      <div className={styles.formGroup}>
        <label className={styles.label}>
          Avatar
        </label>
        <ImageUploader
          value={avatar}
          onChange={handleAvatarChange}
          entityType="characters"
          entityId={characterId}
          placeholder="Trascina un'immagine qui oppure clicca per selezionare"
          helpText="Aggiorna subito il ritratto della scheda e l'avatar in chat/location."
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="audioTheme" className={styles.label}>
          Link YouTube musica del personaggio
        </label>
        <input
          type="url"
          id="audioTheme"
          value={audioTheme}
          onChange={(e) => setAudioTheme(e.target.value)}
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
          Chiudi
        </button>
        <button
          type="submit"
          className={styles.submitButton}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Salvataggio...' : 'Salva Link Musica'}
        </button>
      </div>
    </form>
  );
}
