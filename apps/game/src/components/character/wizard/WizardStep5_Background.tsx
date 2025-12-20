import React from 'react';
import { CharacterWizardData } from '@/pages/character/wizard';
import styles from './WizardSteps.module.scss';

interface WizardStep5Props {
  characterData: CharacterWizardData;
  updateCharacterData: (updates: Partial<CharacterWizardData>) => void;
  onNext: () => void;
  onPrev: () => void;
  goToStep: (step: number) => void;
  onSubmit: () => void;
  onManualSave: () => void;
  isLastStep: boolean;
}

export const WizardStep5_Background: React.FC<WizardStep5Props> = ({
  characterData,
  updateCharacterData,
  onNext,
  onPrev,
  onManualSave
}) => {

  const handleInputChange = (field: keyof CharacterWizardData, value: string) => {
    updateCharacterData({ [field]: value });
  };

  // NEW SYSTEM: Handle background structured fields
  const handleBackgroundChange = (field: string, value: string) => {
    const currentBackground = characterData.background || {};
    updateCharacterData({
      background: {
        ...currentBackground,
        [field]: value
      }
    });
  };

  const isStepValid = () => {
    // Check old required fields (for backward compatibility)
    const hasPublicDescription = characterData.publicDescription && characterData.publicDescription.trim().length >= 50;
    const hasPrivateDescription = characterData.privateDescription && characterData.privateDescription.trim().length >= 50;

    // NEW SYSTEM: Check structured background required fields
    const background = characterData.background || {};
    const hasBriefHistory = background.briefHistory && background.briefHistory.trim().length >= 100;
    const hasPersonality = background.personality && background.personality.trim().length >= 50;
    const hasGoalsAndMotivations = background.goalsAndMotivations && background.goalsAndMotivations.trim().length >= 50;

    return hasPublicDescription && hasPrivateDescription && hasBriefHistory && hasPersonality && hasGoalsAndMotivations;
  };

  const background = characterData.background || {};

  return (
    <div className={styles.stepContainer}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Background e Storia del Personaggio</h2>
        <p className={styles.stepDescription}>
          Sviluppa la storia e la personalità del tuo personaggio attraverso domande guidate.
          Alcuni campi sono obbligatori, altri opzionali ma consigliati per arricchire il personaggio.
        </p>
      </div>

      {/* SECTION 1: Descrizioni Base (Required) */}
      <div className={styles.formGrid}>
        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <h3 className={styles.sectionTitle}>Descrizioni Base</h3>
          <p className={styles.sectionDescription}>
            Questi campi definiscono come il tuo personaggio appare e viene percepito dagli altri.
          </p>
        </div>

        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label className={styles.label}>
            Descrizione Pubblica <span className={styles.required}>*</span>
          </label>
          <textarea
            value={characterData.publicDescription}
            onChange={(e) => handleInputChange('publicDescription', e.target.value)}
            className={styles.textarea}
            placeholder="Come appare il tuo personaggio agli altri? Aspetto, vestiario, portamento, prima impressione..."
            maxLength={4000}
            rows={4}
          />
          <small className={styles.helpText}>
            Minimo 50 caratteri, massimo 4000
            <span
              className={styles.infoIcon}
              data-tooltip="Come appare il tuo personaggio agli altri? Aspetto, vestiario, portamento, prima impressione..."
            />
          </small>
          {characterData.publicDescription && characterData.publicDescription.length < 50 && (
            <small className={styles.errorHint}>
              ⚠️ {characterData.publicDescription.length}/50 caratteri
            </small>
          )}
        </div>

        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label className={styles.label}>
            Descrizione Privata <span className={styles.required}>*</span>
          </label>
          <textarea
            value={characterData.privateDescription}
            onChange={(e) => handleInputChange('privateDescription', e.target.value)}
            className={styles.textarea}
            placeholder="Aspetti del personaggio che non sono immediatamente visibili: segreti, traumi, pensieri nascosti, doppia vita..."
            maxLength={4000}
            rows={4}
          />
          <small className={styles.helpText}>
            Minimo 50 caratteri, massimo 4000
            <span
              className={styles.infoIcon}
              data-tooltip="Aspetti del personaggio che non sono immediatamente visibili: segreti, traumi, pensieri nascosti, doppia vita..."
            />
          </small>
          {characterData.privateDescription && characterData.privateDescription.length < 50 && (
            <small className={styles.errorHint}>
              ⚠️ {characterData.privateDescription.length}/50 caratteri
            </small>
          )}
        </div>

        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label className={styles.label}>
            Descrizione Fisica
          </label>
          <textarea
            value={characterData.physicalDescription}
            onChange={(e) => handleInputChange('physicalDescription', e.target.value)}
            className={styles.textarea}
            placeholder="Dettagli fisici specifici: altezza, corporatura, colore occhi e capelli, cicatrici, segni distintivi..."
            maxLength={4000}
            rows={3}
          />
          <small className={styles.helpText}>
            Opzionale, massimo 4000 caratteri
            <span
              className={styles.infoIcon}
              data-tooltip="Dettagli fisici specifici: altezza, corporatura, colore occhi e capelli, cicatrici, segni distintivi..."
            />
          </small>
        </div>
      </div>

      {/* SECTION 2: Background Strutturato (NEW SYSTEM) */}
      <div className={styles.formGrid}>
        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <h3 className={styles.sectionTitle}>Background Strutturato</h3>
          <p className={styles.sectionDescription}>
            Rispondi a queste domande per sviluppare la storia completa del personaggio.
            I campi contrassegnati con * sono obbligatori.
          </p>
        </div>

        {/* 1. Storia in breve (REQUIRED) */}
        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label className={styles.label}>
            1. Storia in breve <span className={styles.required}>*</span>
          </label>
          <textarea
            value={background.briefHistory || ''}
            onChange={(e) => handleBackgroundChange('briefHistory', e.target.value)}
            className={styles.textarea}
            placeholder="Raccontare in modo sintetico origine, educazione, momenti di svolta, scelte di vita, eventi traumatici o formativi."
            maxLength={4000}
            rows={6}
          />
          <small className={styles.helpText}>
            Minimo 100 caratteri, massimo 4000
            <span
              className={styles.infoIcon}
              data-tooltip="Raccontare in modo sintetico origine, educazione, momenti di svolta, scelte di vita, eventi traumatici o formativi."
            />
          </small>
          {background.briefHistory && background.briefHistory.length < 100 && (
            <small className={styles.errorHint}>
              ⚠️ {background.briefHistory.length}/100 caratteri
            </small>
          )}
        </div>

        {/* 2. Fatti salienti */}
        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label className={styles.label}>
            2. Fatti salienti
          </label>
          <textarea
            value={background.significantEvents || ''}
            onChange={(e) => handleBackgroundChange('significantEvents', e.target.value)}
            className={styles.textarea}
            placeholder="Successi, fallimenti, lutti, incontri, cambi di città, carriere, scandali. Devono essere i momenti chiave che hanno segnato la vita del personaggio o il suo modo di pensare."
            maxLength={2500}
            rows={5}
          />
          <small className={styles.helpText}>
            Opzionale ma consigliato, massimo 2500 caratteri
            <span
              className={styles.infoIcon}
              data-tooltip="Successi, fallimenti, lutti, incontri, cambi di città, carriere, scandali. Devono essere i momenti chiave che hanno segnato la vita del personaggio o il suo modo di pensare."
            />
          </small>
        </div>

        {/* 3. Relazioni importanti */}
        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label className={styles.label}>
            3. Relazioni importanti
          </label>
          <textarea
            value={background.importantRelationships || ''}
            onChange={(e) => handleBackgroundChange('importantRelationships', e.target.value)}
            className={styles.textarea}
            placeholder="Famiglia, amori, amici, mentori, rivali, colleghi, nemici. Spiegare brevemente la natura del legame e che impatto ha avuto sul personaggio."
            maxLength={2500}
            rows={5}
          />
          <small className={styles.helpText}>
            Opzionale ma consigliato, massimo 2500 caratteri
            <span
              className={styles.infoIcon}
              data-tooltip="Famiglia, amori, amici, mentori, rivali, colleghi, nemici. Spiegare brevemente la natura del legame e che impatto ha avuto sul personaggio."
            />
          </small>
        </div>

        {/* 4. Personalità (REQUIRED) */}
        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label className={styles.label}>
            4. Personalità <span className={styles.required}>*</span>
          </label>
          <textarea
            value={background.personality || ''}
            onChange={(e) => handleBackgroundChange('personality', e.target.value)}
            className={styles.textarea}
            placeholder="Tratti dominanti, atteggiamento verso gli altri, abitudini, contraddizioni, ossessioni, modi di parlare o reagire."
            maxLength={2500}
            rows={5}
          />
          <small className={styles.helpText}>
            Minimo 50 caratteri, massimo 2500
            <span
              className={styles.infoIcon}
              data-tooltip="Tratti dominanti, atteggiamento verso gli altri, abitudini, contraddizioni, ossessioni, modi di parlare o reagire."
            />
          </small>
          {background.personality && background.personality.length < 50 && (
            <small className={styles.errorHint}>
              ⚠️ {background.personality.length}/50 caratteri
            </small>
          )}
        </div>

        {/* 5. Ideologia/Credo */}
        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label className={styles.label}>
            5. Ideologia/Credo
          </label>
          <textarea
            value={background.ideology || ''}
            onChange={(e) => handleBackgroundChange('ideology', e.target.value)}
            className={styles.textarea}
            placeholder="Valori morali, religione, filosofia, visione del mondo o mancanza di essa. Deve includere anche il rapporto con la scienza, la società e la fede."
            maxLength={2500}
            rows={4}
          />
          <small className={styles.helpText}>
            Opzionale ma consigliato, massimo 2500 caratteri
            <span
              className={styles.infoIcon}
              data-tooltip="Valori morali, religione, filosofia, visione del mondo o mancanza di essa. Deve includere anche il rapporto con la scienza, la società e la fede."
            />
          </small>
        </div>

        {/* 6. Luoghi significativi */}
        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label className={styles.label}>
            6. Luoghi significativi
          </label>
          <textarea
            value={background.significantPlaces || ''}
            onChange={(e) => handleBackgroundChange('significantPlaces', e.target.value)}
            className={styles.textarea}
            placeholder="I posti che il personaggio possiede o gestisce, oppure dove è possibile trovarlo quasi sempre. Possono essere un negozio, un laboratorio, un ufficio, un locale, un magazzino, eventuali proprietà ereditate o luoghi legati al suo nome, che non frequenta più, ma che fanno comunque parte della sua storia."
            maxLength={2500}
            rows={4}
          />
          <small className={styles.helpText}>
            Opzionale ma consigliato, massimo 2500 caratteri
            <span
              className={styles.infoIcon}
              data-tooltip="I posti che il personaggio possiede o gestisce, oppure dove è possibile trovarlo quasi sempre. Possono essere un negozio, un laboratorio, un ufficio, un locale, un magazzino, eventuali proprietà ereditate o luoghi legati al suo nome, che non frequenta più, ma che fanno comunque parte della sua storia."
            />
          </small>
        </div>

        {/* 7. Paure e fobie */}
        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label className={styles.label}>
            7. Paure e fobie
          </label>
          <textarea
            value={background.fearsAndPhobias || ''}
            onChange={(e) => handleBackgroundChange('fearsAndPhobias', e.target.value)}
            className={styles.textarea}
            placeholder="Ciò che il personaggio teme o lo mette profondamente a disagio. Possono essere paure razionali o irrazionali."
            maxLength={2500}
            rows={4}
          />
          <small className={styles.helpText}>
            Opzionale ma importante, massimo 2500 caratteri
            <span
              className={styles.infoIcon}
              data-tooltip="Ciò che il personaggio teme o lo mette profondamente a disagio. Possono essere paure razionali o irrazionali."
            />
          </small>
        </div>

        {/* 8. Segreti */}
        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label className={styles.label}>
            8. Segreti
          </label>
          <textarea
            value={background.secrets || ''}
            onChange={(e) => handleBackgroundChange('secrets', e.target.value)}
            className={styles.textarea}
            placeholder="Colpe, crimini, bugie, traumi, identità nascoste, patti, ossessioni, doppie vite. Devono essere coerenti con il background e potenzialmente rilevanti nel gioco."
            maxLength={2500}
            rows={5}
          />
          <small className={styles.helpText}>
            Opzionale ma consigliato, massimo 2500 caratteri
            <span
              className={styles.infoIcon}
              data-tooltip="Colpe, crimini, bugie, traumi, identità nascoste, patti, ossessioni, doppie vite. Devono essere coerenti con il background e potenzialmente rilevanti nel gioco."
            />
          </small>
        </div>

        {/* 9. Obiettivi e motivazioni (REQUIRED) */}
        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
          <label className={styles.label}>
            9. Obiettivi e motivazioni <span className={styles.required}>*</span>
          </label>
          <textarea
            value={background.goalsAndMotivations || ''}
            onChange={(e) => handleBackgroundChange('goalsAndMotivations', e.target.value)}
            className={styles.textarea}
            placeholder="Cosa spinge il personaggio nel presente, cosa sta cercando, cosa vuole ottenere o cambiare, e quali sono le sue priorità reali. Può trattarsi di un obiettivo concreto, di una necessità, o anche solo di qualcosa da cui sta cercando di fuggire."
            maxLength={2500}
            rows={5}
          />
          <small className={styles.helpText}>
            Minimo 50 caratteri, massimo 2500
            <span
              className={styles.infoIcon}
              data-tooltip="Cosa spinge il personaggio nel presente, cosa sta cercando, cosa vuole ottenere o cambiare, e quali sono le sue priorità reali. Può trattarsi di un obiettivo concreto, di una necessità, o anche solo di qualcosa da cui sta cercando di fuggire."
            />
          </small>
          {background.goalsAndMotivations && background.goalsAndMotivations.length < 50 && (
            <small className={styles.errorHint}>
              ⚠️ {background.goalsAndMotivations.length}/50 caratteri
            </small>
          )}
        </div>
      </div>

      {/* Validation message */}
      {!isStepValid() && (
        <div className={styles.validationInfo}>
          <p className={styles.validationWarning}>
            ⚠️ Completa tutti i campi obbligatori per procedere:
          </p>
          <ul className={styles.validationList}>
            {(!characterData.publicDescription || characterData.publicDescription.length < 50) && (
              <li>Descrizione Pubblica (min. 50 caratteri)</li>
            )}
            {(!characterData.privateDescription || characterData.privateDescription.length < 50) && (
              <li>Descrizione Privata (min. 50 caratteri)</li>
            )}
            {(!background.briefHistory || background.briefHistory.length < 100) && (
              <li>Storia in breve (min. 100 caratteri)</li>
            )}
            {(!background.personality || background.personality.length < 50) && (
              <li>Personalità (min. 50 caratteri)</li>
            )}
            {(!background.goalsAndMotivations || background.goalsAndMotivations.length < 50) && (
              <li>Obiettivi e motivazioni (min. 50 caratteri)</li>
            )}
          </ul>
        </div>
      )}

      <div className={styles.infoPanel}>
        <h4>💡 Suggerimenti per un Background Efficace</h4>
        <ul>
          <li><strong>Sii Specifico:</strong> Dettagli concreti rendono il personaggio realistico e memorabile</li>
          <li><strong>Collega alla Storia:</strong> Usa eventi della Londra vittoriana (1880s-1890s) per autenticità</li>
          <li><strong>Pensa alle Connessioni:</strong> Crea legami con altri personaggi potenziali</li>
          <li><strong>Considera la Classe Sociale:</strong> Come ha influenzato opportunità e prospettive?</li>
          <li><strong>Lascia Spazi Aperti:</strong> Permetti al master di aggiungere elementi alla storia</li>
          <li><strong>Bilancia Punti di Forza e Debolezza:</strong> Personaggi perfetti sono noiosi</li>
        </ul>
      </div>

      <div className={styles.stepNavigation}>
        <button onClick={onPrev} className={styles.prevButton}>
          ← Torna alle Abilità
        </button>

        <button
          onClick={onManualSave}
          className={`${styles.saveButton} manual-save-button`}
        >
          💾 SALVA
        </button>

        <button
          onClick={onNext}
          disabled={!isStepValid()}
          className={styles.nextButton}
        >
          Continua con la Revisione →
        </button>
      </div>
    </div>
  );
};
