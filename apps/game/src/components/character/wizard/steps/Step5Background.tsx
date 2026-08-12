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

import { useMemo, useState } from 'react';
import { validateStep5 } from '../validation/wizardValidation';
import { useWizardStore } from '@/store/wizardStore';
import styles from '@/styles/components/character/wizard/Step5Background.module.scss';
import { EyeIcon } from '../EyeIcon';

interface Step5BackgroundProps {
  fieldVisibility?: Record<string, boolean>;
}

/**
 * Step 5: Background Component
 */
export function Step5Background({ fieldVisibility }: Step5BackgroundProps): JSX.Element {
  const { background, updateBackground, creationConfig } = useWizardStore();

  // Live validation so errors are visible without clicking "next"
  const allErrors = useMemo(
    () => validateStep5(background, creationConfig).errors,
    [background, creationConfig]
  );

  // Un campo mostra l'errore solo dopo che l'utente l'ha abbandonato (blur),
  // non appena entra nello step o mentre sta ancora scrivendo: altrimenti un
  // campo vuoto allarma subito senza che l'utente abbia fatto nulla.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const handleBlur = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));
  const errors = useMemo(
    () => Object.fromEntries(Object.entries(allErrors).filter(([field]) => touched[field])),
    [allErrors, touched]
  );

  const bgLimits = creationConfig?.limits.backgroundFields;
  const briefHistoryMax = bgLimits?.briefHistory?.maxChar ?? 4000;
  const significantEventsMax = bgLimits?.significantEvents?.maxChar ?? 2500;
  const importantRelationshipsMax = bgLimits?.importantRelationships?.maxChar ?? 2500;
  const personalityMax = bgLimits?.personality?.maxChar ?? 2500;
  const ideologyMax = bgLimits?.ideology?.maxChar ?? 2500;

  const handleChange = (field: string, value: string) => {
    updateBackground({ [field]: value });
  };

  const isPrivate = (configKey: string, defaultIsPublic = true): boolean =>
    fieldVisibility ? !fieldVisibility[configKey] : !defaultIsPublic;

  return (
    <div className={styles.stepContent} data-step="background">
      <div className={styles.panels}>
        {/* LEFT COLUMN */}
        <div className={styles.leftColumn}>
          {/* STORIA IN BREVE */}
          <div className={styles.formGroupFull}>
            <label htmlFor="briefHistory" className={styles.label}>
              <EyeIcon visible={isPrivate('briefHistory')} /> STORIA IN BREVE
            </label>
            <textarea
              id="briefHistory"
              value={background.briefHistory || ''}
              onChange={(e) => handleChange('briefHistory', e.target.value)}
              onBlur={() => handleBlur('briefHistory')}
              className={`${styles.textarea} ${styles.textareaLarge} ${errors.briefHistory ? styles.inputError : ''}`}
              rows={12}
              maxLength={briefHistoryMax}
            />
            <div className={styles.helpTextContainer}>
              <small className={styles.helpText}>
                Racconta sinteticamente l&apos;origine, l&apos;educazione, i momenti di svolta, le scelte di vita ed eventuali eventi traumatici o formativi.
              </small>
              <small className={styles.counter}>{background.briefHistory?.length || 0}/{briefHistoryMax}</small>
            </div>
          </div>

          {/* FATTI SALIENTI */}
          <div className={styles.formGroupFull}>
            <label htmlFor="significantEvents" className={styles.label}>
              <EyeIcon visible={isPrivate('significantEvents')} /> FATTI SALIENTI
            </label>
            <textarea
              id="significantEvents"
              value={background.significantEvents || ''}
              onChange={(e) => handleChange('significantEvents', e.target.value)}
              onBlur={() => handleBlur('significantEvents')}
              className={styles.textarea}
              rows={8}
              maxLength={significantEventsMax}
            />
            <div className={styles.helpTextContainer}>
              <small className={styles.helpText}>
                Successi, fallimenti, lutti, incontri, cambi di città, carriere, scandali. Devono essere i momenti chiave che hanno segnato la vita o il modo di pensare del personaggio.
              </small>
              <small className={styles.counter}>{background.significantEvents?.length || 0}/{significantEventsMax}</small>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className={styles.rightColumn}>
          {/* RELAZIONI IMPORTANTI */}
          <div className={styles.formGroupFull}>
            <label htmlFor="importantRelationships" className={styles.label}>
              <EyeIcon visible={isPrivate('importantRelationships')} /> RELAZIONI IMPORTANTI
            </label>
            <textarea
              id="importantRelationships"
              value={background.importantRelationships || ''}
              onChange={(e) => handleChange('importantRelationships', e.target.value)}
              onBlur={() => handleBlur('importantRelationships')}
              className={styles.textarea}
              rows={6}
              maxLength={importantRelationshipsMax}
            />
            <div className={styles.helpTextContainer}>
              <small className={styles.helpText}>
                Famiglia, amori, amici, mentori, rivali, colleghi, nemici. Spiega brevemente la natura del legame e l&apos;impatto che ha avuto sul personaggio.
              </small>
              <small className={styles.counter}>{background.importantRelationships?.length || 0}/{importantRelationshipsMax}</small>
            </div>
          </div>

          {/* PERSONALITÀ */}
          <div className={styles.formGroupFull}>
            <label htmlFor="personality" className={styles.label}>
              <EyeIcon visible={isPrivate('personality')} /> PERSONALITÀ
            </label>
            <textarea
              id="personality"
              value={background.personality || ''}
              onChange={(e) => handleChange('personality', e.target.value)}
              onBlur={() => handleBlur('personality')}
              className={`${styles.textarea} ${errors.personality ? styles.inputError : ''}`}
              rows={6}
              maxLength={personalityMax}
            />
            <div className={styles.helpTextContainer}>
              <small className={styles.helpText}>
                Tratti dominanti, atteggiamento verso gli altri, abitudini, contraddizioni, ossessioni, modi di parlare e reagire.
              </small>
              <small className={styles.counter}>{background.personality?.length || 0}/{personalityMax}</small>
            </div>
          </div>

          {/* IDEOLOGIA/CREDO */}
          <div className={styles.formGroupFull}>
            <label htmlFor="ideology" className={styles.label}>
              <EyeIcon visible={isPrivate('ideology')} /> IDEOLOGIA/CREDO
            </label>
            <textarea
              id="ideology"
              value={background.ideology || ''}
              onChange={(e) => handleChange('ideology', e.target.value)}
              onBlur={() => handleBlur('ideology')}
              className={styles.textarea}
              rows={6}
              maxLength={ideologyMax}
            />
            <div className={styles.helpTextContainer}>
              <small className={styles.helpText}>
                Valori morali, religione, filosofia, visione del mondo o mancanza di essa. Deve includere anche il rapporto con la scienza, la società e la fede.
              </small>
              <small className={styles.counter}>{background.ideology?.length || 0}/{ideologyMax}</small>
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
