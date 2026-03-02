/**
 * Step 2: Occupation Component
 *
 * Occupation selection with required and bonus skills preview.
 *
 * @module components/character/wizard/steps/Step2Occupation
 * @since 2.0.0
 */

'use client';

import { useWizardStore } from '@/store/wizardStore';
import { useOccupations } from '@/hooks/useCharacterCreation';
import styles from '@/styles/components/character/wizard.module.scss';

/**
 * Step 2: Occupation Component
 *
 * @returns {JSX.Element} Step 2 form
 */
export function Step2Occupation(): JSX.Element {
  const { occupation, updateOccupation, stepErrors } = useWizardStore();
  const errors = stepErrors[2] || {};

  // Fetch occupations from API
  const { data: occupations, isLoading, error: apiError } = useOccupations();

  const selectedOccupation = occupations?.find((occ) => occ.id === occupation.occupationId);

  /**
   * Handle Occupation Selection
   */
  const handleOccupationChange = (occupationId: string) => {
    const occ = occupations?.find((o) => o.id === occupationId);
    if (occ) {
      updateOccupation({
        occupationId: occ.id,
        currentOccupation: occ.name,
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.stepContent} data-step="occupation">
        <h2 className={styles.stepTitle}>Occupazione</h2>
        <div className={styles.infoBox}>⏳ Caricamento occupazioni...</div>
      </div>
    );
  }

  // Error state
  if (apiError || !occupations) {
    return (
      <div className={styles.stepContent} data-step="occupation">
        <h2 className={styles.stepTitle}>Occupazione</h2>
        <div className={styles.errorSummary}>
          <h4>❌ Errore nel caricamento delle occupazioni</h4>
          <p>{apiError?.message || 'Impossibile caricare le occupazioni dal server'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stepContent} data-step="occupation">
      <h2 className={styles.stepTitle}>Occupazione</h2>
      <p className={styles.stepDescription}>
        Scegli l'occupazione del tuo personaggio. L'occupazione determina quali abilità riceveranno bonus automatici.
      </p>

      {/* Occupation Selector */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Seleziona Occupazione</h3>

        <div className={styles.formGroup}>
          <label htmlFor="occupation" className={styles.label}>
            Occupazione <span className={styles.required}>*</span>
          </label>
          <select
            id="occupation"
            value={occupation.occupationId}
            onChange={(e) => handleOccupationChange(e.target.value)}
            className={`${styles.select} ${errors.occupationId ? styles.inputError : ''}`}
          >
            <option value="">Seleziona un'occupazione...</option>
            {occupations.map((occ) => (
              <option key={occ.id} value={occ.id}>
                {occ.name}
              </option>
            ))}
          </select>
          {errors.occupationId && <span className={styles.error}>{errors.occupationId}</span>}
        </div>

        {selectedOccupation && (
          <div className={styles.occupationDescription}>
            <p>{selectedOccupation.description}</p>
          </div>
        )}

        {/* Current Occupation Title (editable) */}
        {selectedOccupation && (
          <div className={styles.formGroup}>
            <label htmlFor="currentOccupation" className={styles.label}>
              Titolo Specifico
            </label>
            <input
              type="text"
              id="currentOccupation"
              value={occupation.currentOccupation}
              onChange={(e) => updateOccupation({ currentOccupation: e.target.value })}
              className={styles.input}
              placeholder={`es. ${selectedOccupation.name} Privato, Ispettore Capo...`}
            />
            <small className={styles.helpText}>
              Personalizza il titolo della tua occupazione se desideri essere più specifico
            </small>
          </div>
        )}
      </div>

      {/* Skills Preview */}
      {selectedOccupation && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Abilità dell'Occupazione</h3>

          {/* Required Skills */}
          <div className={styles.skillsPreview}>
            <h4 className={styles.skillsPreviewTitle}>Abilità Richieste ({selectedOccupation.requiredSkills.length})</h4>
            <p className={styles.skillsPreviewDescription}>
              Queste abilità riceveranno un bonus automatico (+{selectedOccupation.requiredSkills[0]?.bonusValue || 40} punti).
            </p>
            <div className={styles.skillsList}>
              {selectedOccupation.requiredSkills.map((skill) => (
                <div key={skill.skillId} className={styles.skillTag}>
                  {skill.name}
                </div>
              ))}
            </div>
          </div>

          {/* Bonus Skills */}
          <div className={styles.skillsPreview}>
            <h4 className={styles.skillsPreviewTitle}>Abilità Bonus (scegli 1)</h4>
            <p className={styles.skillsPreviewDescription}>
              Nello Step 4, potrai scegliere una di queste abilità per ricevere un bonus di +{selectedOccupation.bonusSkills[0]?.bonusValue || 30} punti.
            </p>
            <div className={styles.skillsList}>
              {selectedOccupation.bonusSkills.map((skill) => (
                <div key={skill.skillId} className={`${styles.skillTag} ${styles.skillTagBonus}`}>
                  {skill.name}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.infoBox}>
            <strong>ℹ️ Nota:</strong> I bonus dell'occupazione verranno applicati automaticamente nello Step 4 (Abilità). Non devi preoccupartene ora.
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {Object.keys(errors).length > 0 && (
        <div className={styles.errorSummary}>
          <h4>Errori di Validazione:</h4>
          <ul>
            {Object.entries(errors).map(([field, error]) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
