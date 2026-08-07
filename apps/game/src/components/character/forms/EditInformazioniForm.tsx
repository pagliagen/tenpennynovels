/**
 * Edit Informazioni Form
 *
 * Form for editing character basic information:
 * - Name, age, gender
 * - Physical description
 * - Public background
 *
 * @module components/character/forms/EditInformazioniForm
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
 * Edit Informazioni Form Props
 */
interface EditInformazioniFormProps {
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
 * Edit Informazioni Form Component
 *
 * Editable fields:
 * - name, age, gender
 * - physicalDescription
 * - publicBackground
 *
 * @component
 * @param {EditInformazioniFormProps} props - Component props
 * @returns {JSX.Element} Form
 */
export function EditInformazioniForm({
  characterId,
  character,
  onSuccess,
  onCancel,
}: EditInformazioniFormProps): JSX.Element {
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState({
    name: character.name || '',
    age: character.age || 18,
    gender: character.gender || 'male',
    physicalDescription: character.physicalDescription || '',
    publicBackground: character.publicBackground || '',
    audioTheme: character.audioTheme || '',
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => characterApi.update(characterId, data),
    onSuccess: () => {
      // Invalidate character sheet query to refresh data
      // (era 'characterSheet': non combaciava con la queryKey reale ['character-sheet', id]
      // usata da useCharacterSheetData, quindi la scheda non si aggiornava mai da sola dopo il salvataggio)
      queryClient.invalidateQueries({ queryKey: ['character-sheet', characterId] });
      onSuccess();
    },
    onError: (error: any) => {
      logger.error('[EditInformazioniForm] Update failed:', { error });
      alert(`Errore durante il salvataggio: ${error.message || 'Riprova'}`);
    },
  });

  /**
   * Handle input change
   */
  const handleChange = (field: keyof typeof formData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * Handle form submit
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      alert('Il nome è obbligatorio');
      return;
    }

    if (formData.age < 1 || formData.age > 120) {
      alert('Età deve essere tra 1 e 120 anni');
      return;
    }

    // Submit
    updateMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.editForm}>
      {/* Name */}
      <div className={styles.formGroup}>
        <label htmlFor="name" className={styles.label}>
          Nome <span className={styles.required}>*</span>
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className={styles.input}
          placeholder="es. Arthur Pemberton"
          required
          maxLength={50}
        />
      </div>

      {/* Age */}
      <div className={styles.formGroup}>
        <label htmlFor="age" className={styles.label}>
          Età <span className={styles.required}>*</span>
        </label>
        <input
          type="number"
          id="age"
          value={formData.age}
          onChange={(e) => handleChange('age', parseInt(e.target.value, 10))}
          className={styles.input}
          min={1}
          max={120}
          required
        />
      </div>

      {/* Gender */}
      <div className={styles.formGroup}>
        <label htmlFor="gender" className={styles.label}>
          Genere <span className={styles.required}>*</span>
        </label>
        <select
          id="gender"
          value={formData.gender}
          onChange={(e) => handleChange('gender', e.target.value)}
          className={styles.select}
          required
        >
          <option value="male">Maschio</option>
          <option value="female">Femmina</option>
          <option value="other">Altro</option>
        </select>
      </div>

      {/* Physical Description */}
      <div className={styles.formGroup}>
        <label htmlFor="physicalDescription" className={styles.label}>
          Descrizione Fisica
        </label>
        <textarea
          id="physicalDescription"
          value={formData.physicalDescription}
          onChange={(e) => handleChange('physicalDescription', e.target.value)}
          className={styles.textarea}
          placeholder="Descrivi l'aspetto fisico del personaggio..."
          rows={5}
          maxLength={1000}
        />
        <span className={styles.charCount}>
          {formData.physicalDescription.length}/1000
        </span>
      </div>

      {/* Public Background */}
      <div className={styles.formGroup}>
        <label htmlFor="publicBackground" className={styles.label}>
          Descrizione Pubblica
        </label>
        <textarea
          id="publicBackground"
          value={formData.publicBackground}
          onChange={(e) => handleChange('publicBackground', e.target.value)}
          className={styles.textarea}
          placeholder="Background pubblico visibile a tutti i giocatori..."
          rows={8}
          maxLength={2000}
        />
        <span className={styles.charCount}>
          {formData.publicBackground.length}/2000
        </span>
      </div>

      {/* Musica scheda */}
      <div className={styles.formGroup}>
        <label htmlFor="audioTheme" className={styles.label}>
          Link musica del personaggio
        </label>
        <input
          type="url"
          id="audioTheme"
          value={formData.audioTheme}
          onChange={(e) => handleChange('audioTheme', e.target.value)}
          className={styles.input}
          placeholder="https://…"
          maxLength={500}
        />
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
