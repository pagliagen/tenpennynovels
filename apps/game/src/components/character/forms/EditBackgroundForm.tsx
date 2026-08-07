/**
 * Edit Background Form
 *
 * Form for editing character private background fields:
 * - Private background (owner/master only)
 * - Motivations
 * - Fears
 * - Traumas
 * - Belief system
 * - Bonds
 * - Secrets
 *
 * @module components/character/forms/EditBackgroundForm
 * @since 3.0.0
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { CharacterSheetData } from '@/hooks/useCharacterSheetData';
import { characterApi } from '@/lib/api/character';
import styles from '@/styles/components/character/CharacterEditForm.module.scss';
import { logger } from '@/lib/logger';

/**
 * Edit Background Form Props
 */
interface EditBackgroundFormProps {
  /** Character ID */
  characterId: string;

  /** Current character data */
  character: CharacterSheetData['character'];

  /** Handle successful save (close modal) */
  onSuccess: () => void;

  /** Handle cancel (close modal without saving) */
  onCancel: () => void;
}

/**
 * Edit Background Form Component
 *
 * Editable fields (all private):
 * - privateBackground
 * - motivations, fears, traumas
 * - beliefSystem, bonds, secrets
 *
 * @component
 * @param {EditBackgroundFormProps} props - Component props
 * @returns {JSX.Element} Form
 */
export function EditBackgroundForm({
  characterId,
  character,
  onSuccess,
  onCancel,
}: EditBackgroundFormProps): JSX.Element {
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    privateBackground: character.privateBackground || '',
    motivations: character.motivations || '',
    fears: character.fears || '',
    traumas: character.traumas || '',
    beliefSystem: character.beliefSystem || '',
    bonds: character.bonds || '',
    secrets: character.secrets || '',
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => characterApi.update(characterId, data),
    onSuccess: () => {
      // era 'characterSheet': non combaciava con la queryKey reale ['character-sheet', id]
      queryClient.invalidateQueries({ queryKey: ['character-sheet', characterId] });
      onSuccess();
    },
    onError: (error: any) => {
      logger.error('[EditBackgroundForm] Update failed:', { error });
      alert(`Errore durante il salvataggio: ${error.message || 'Riprova'}`);
    },
  });

  /**
   * Handle input change
   */
  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * Handle form submit
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.editForm}>
      {/* Private Background */}
      <div className={styles.formGroup}>
        <label htmlFor="privateBackground" className={styles.label}>
          🔒 Background Privato
        </label>
        <p className={styles.hint}>
          Visibile solo a te e ai game master. Dettagli riservati del passato del personaggio.
        </p>
        <textarea
          id="privateBackground"
          value={formData.privateBackground}
          onChange={(e) => handleChange('privateBackground', e.target.value)}
          className={styles.textarea}
          placeholder="Background segreto, eventi che nessuno conosce..."
          rows={6}
          maxLength={2000}
        />
        <span className={styles.charCount}>
          {formData.privateBackground.length}/2000
        </span>
      </div>

      {/* Motivations */}
      <div className={styles.formGroup}>
        <label htmlFor="motivations" className={styles.label}>
          💫 Motivazioni
        </label>
        <textarea
          id="motivations"
          value={formData.motivations}
          onChange={(e) => handleChange('motivations', e.target.value)}
          className={styles.textarea}
          placeholder="Cosa spinge il personaggio? Obiettivi, desideri, ambizioni..."
          rows={4}
          maxLength={1000}
        />
        <span className={styles.charCount}>
          {formData.motivations.length}/1000
        </span>
      </div>

      {/* Fears */}
      <div className={styles.formGroup}>
        <label htmlFor="fears" className={styles.label}>
          😨 Paure
        </label>
        <textarea
          id="fears"
          value={formData.fears}
          onChange={(e) => handleChange('fears', e.target.value)}
          className={styles.textarea}
          placeholder="Fobie, ansie, ciò che terrorizza il personaggio..."
          rows={4}
          maxLength={1000}
        />
        <span className={styles.charCount}>
          {formData.fears.length}/1000
        </span>
      </div>

      {/* Traumas */}
      <div className={styles.formGroup}>
        <label htmlFor="traumas" className={styles.label}>
          💔 Traumi
        </label>
        <textarea
          id="traumas"
          value={formData.traumas}
          onChange={(e) => handleChange('traumas', e.target.value)}
          className={styles.textarea}
          placeholder="Eventi traumatici del passato, cicatrici emotive..."
          rows={4}
          maxLength={1000}
        />
        <span className={styles.charCount}>
          {formData.traumas.length}/1000
        </span>
      </div>

      {/* Belief System */}
      <div className={styles.formGroup}>
        <label htmlFor="beliefSystem" className={styles.label}>
          ✨ Sistema di Credenze
        </label>
        <textarea
          id="beliefSystem"
          value={formData.beliefSystem}
          onChange={(e) => handleChange('beliefSystem', e.target.value)}
          className={styles.textarea}
          placeholder="Religione, filosofia, valori morali, superstizioni..."
          rows={4}
          maxLength={1000}
        />
        <span className={styles.charCount}>
          {formData.beliefSystem.length}/1000
        </span>
      </div>

      {/* Bonds */}
      <div className={styles.formGroup}>
        <label htmlFor="bonds" className={styles.label}>
          💞 Legami
        </label>
        <textarea
          id="bonds"
          value={formData.bonds}
          onChange={(e) => handleChange('bonds', e.target.value)}
          className={styles.textarea}
          placeholder="Relazioni importanti, persone care, legami significativi..."
          rows={4}
          maxLength={1000}
        />
        <span className={styles.charCount}>
          {formData.bonds.length}/1000
        </span>
      </div>

      {/* Secrets */}
      <div className={styles.formGroup}>
        <label htmlFor="secrets" className={styles.label}>
          🤫 Segreti
        </label>
        <textarea
          id="secrets"
          value={formData.secrets}
          onChange={(e) => handleChange('secrets', e.target.value)}
          className={styles.textarea}
          placeholder="Segreti oscuri, verità nascoste che potrebbero distruggere tutto..."
          rows={4}
          maxLength={1000}
        />
        <span className={styles.charCount}>
          {formData.secrets.length}/1000
        </span>
      </div>

      {/* Actions */}
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
