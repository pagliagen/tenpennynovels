/**
 * Step 5: Background Component
 *
 * Layout matching wizard5.png:
 * - Left: Storia in Breve, Fatti salienti
 * - Right: Relazioni importanti, Personalità, Ideologia/Credo
 *
 * @module components/character/wizard/steps/Step5Background
 * @since 2.0.0
 */

'use client';

import { useWizardStore } from '@/store/wizardStore';
import styles from '@/styles/components/character/wizard/Step5Background.module.scss';

/**
 * Step 5: Background Component
 */
export function Step5Background(): JSX.Element {
  const { background, updateBackground, stepErrors } = useWizardStore();
  const errors = stepErrors[5] || {};

  const handleChange = (field: string, value: string) => {
    updateBackground({ [field]: value });
  };

  return (
    <div className={styles.stepContent} data-step="background">
      <div className={styles.panels}>
        {/* LEFT COLUMN */}
        <div className={styles.leftColumn}>
          {/* STORIA IN BREVE */}
          <div className={styles.formGroupFull}>
            <label htmlFor="briefHistory" className={styles.label}>
              STORIA IN BREVE
            </label>
            <textarea
              id="briefHistory"
              value={background.briefHistory || ''}
              onChange={(e) => handleChange('briefHistory', e.target.value)}
              className={`${styles.textarea} ${styles.textareaLarge} ${errors.briefHistory ? styles.inputError : ''}`}
              rows={12}
              maxLength={4000}
              placeholder="Devi realizzare la storia del tuo personaggio. Una cinquantina di righe, almeno 500 parole..."
            />
            <div className={styles.helpTextContainer}>
              <small className={styles.helpText}>
                Racconta sinteticamente l'origine, l'educazione, i momenti di svolta, le scelte di vita ed eventuali eventi traumatici o formativi.
              </small>
              <small className={styles.counter}>{background.briefHistory?.length || 0}/4000</small>
            </div>
          </div>

          {/* FATTI SALIENTI */}
          <div className={styles.formGroupFull}>
            <label htmlFor="significantEvents" className={styles.label}>
              FATTI SALIENTI
            </label>
            <textarea
              id="significantEvents"
              value={background.significantEvents || ''}
              onChange={(e) => handleChange('significantEvents', e.target.value)}
              className={styles.textarea}
              rows={8}
              maxLength={2500}
              placeholder="Successi, fallimenti, lutti, incontri, scandali..."
            />
            <div className={styles.helpTextContainer}>
              <small className={styles.helpText}>
                Successi, fallimenti, lutti, incontri, cambi di città, carriere, scandali. Devono essere i momenti chiave che hanno segnato la vita o il modo di pensare del personaggio.
              </small>
              <small className={styles.counter}>{background.significantEvents?.length || 0}/2500</small>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className={styles.rightColumn}>
          {/* RELAZIONI IMPORTANTI */}
          <div className={styles.formGroupFull}>
            <label htmlFor="importantRelationships" className={styles.label}>
              RELAZIONI IMPORTANTI
            </label>
            <textarea
              id="importantRelationships"
              value={background.importantRelationships || ''}
              onChange={(e) => handleChange('importantRelationships', e.target.value)}
              className={styles.textarea}
              rows={6}
              maxLength={2500}
              placeholder="Ci sono personaggi della community con cui hai o potresti avere un rapporto speciale?..."
            />
            <div className={styles.helpTextContainer}>
              <small className={styles.helpText}>
                Famiglia, amori, amici, mentori, rivali, colleghi, nemici. Spiega brevemente la natura del legame e l’impatto che ha avuto sul personaggio.
              </small>
              <small className={styles.counter}>{background.importantRelationships?.length || 0}/2500</small>
            </div>
          </div>

          {/* PERSONALITÀ */}
          <div className={styles.formGroupFull}>
            <label htmlFor="personality" className={styles.label}>
              PERSONALITÀ
            </label>
            <textarea
              id="personality"
              value={background.personality || ''}
              onChange={(e) => handleChange('personality', e.target.value)}
              className={`${styles.textarea} ${errors.personality ? styles.inputError : ''}`}
              rows={6}
              maxLength={2500}
              placeholder="Tratti dominanti, atteggiamento, abitudini, contraddizioni..."
            />
            <div className={styles.helpTextContainer}>
              <small className={styles.helpText}>
                Tratti dominanti, atteggiamento verso gli altri, abitudini, contraddizioni, ossessioni, modi di parlare e reagire.
              </small>
              <small className={styles.counter}>{background.personality?.length || 0}/2500</small>
            </div>
          </div>

          {/* IDEOLOGIA/CREDO */}
          <div className={styles.formGroupFull}>
            <label htmlFor="ideology" className={styles.label}>
              IDEOLOGIA/CREDO
            </label>
            <textarea
              id="ideology"
              value={background.ideology || ''}
              onChange={(e) => handleChange('ideology', e.target.value)}
              className={styles.textarea}
              rows={6}
              maxLength={2500}
              placeholder="Valori morali, religione, filosofia, visione del mondo..."
            />
            <div className={styles.helpTextContainer}>
              <small className={styles.helpText}>
                Valori morali, religione, filosofia, visione del mondo o mancanza di essa. Deve includere anche il rapporto con la scienza, la società e la fede.
              </small>
              <small className={styles.counter}>{background.ideology?.length || 0}/2500</small>
            </div>
          </div>
        </div>
      </div>

      {/* Error Summary */}
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
