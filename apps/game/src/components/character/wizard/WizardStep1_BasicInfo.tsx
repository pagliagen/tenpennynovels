import React, { useEffect } from 'react';
import { CharacterWizardData } from '@/pages/character/wizard';
import styles from './WizardSteps.module.scss';

interface WizardStep1Props {
  characterData: CharacterWizardData;
  updateCharacterData: (updates: Partial<CharacterWizardData>) => void;
  onNext: () => void;
  onPrev: () => void;
  goToStep: (step: number) => void;
  onSubmit: () => void;
  onManualSave: () => void;
  isLastStep: boolean;
  onValidationChange?: (isValid: boolean, errors: string[]) => void;
}

export const WizardStep1_BasicInfo: React.FC<WizardStep1Props> = ({
  characterData,
  updateCharacterData,
  onNext,
  onManualSave,
  onValidationChange
}) => {
  const handleInputChange = (field: keyof CharacterWizardData, value: any) => {
    updateCharacterData({ [field]: value });
  };

  // Calculate age from birthdate (rispetto al 1895 - ambientazione vittoriana)
  const calculateAge = (birthDateStr: string): number | null => {
    if (!birthDateStr || !/^\d{2}\/\d{2}\/\d{4}$/.test(birthDateStr)) return null;

    const [day, month, year] = birthDateStr.split('/').map(Number);

    // Validazione: anno deve essere < 1895
    if (year >= 1895) return null;

    const birthDate = new Date(year, month - 1, day);
    const referenceDate = new Date(1895, 0, 1); // 1 gennaio 1895
    let age = referenceDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = referenceDate.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  const handleBirthDateChange = (value: string) => {
    // Calculate age
    const age = calculateAge(value);

    // Prepare single update object with all changes
    const updates: Partial<CharacterWizardData> = {
      birthDate: value,
    };

    if (age !== null) {
      updates.age = age;
      // Auto-update apparentAge to match real age whenever birthdate changes
      updates.apparentAge = age;
    } else {
      updates.age = null;
      updates.apparentAge = null;
    }

    // Single update call with all changes batched together
    updateCharacterData(updates);
  };

  const getValidationResult = (): { isValid: boolean; errors: string[] } => {
    const age = characterData.age;
    const apparentAge = characterData.apparentAge;
    const errors: string[] = [];

    if (!characterData.firstName.trim()) errors.push('Nome richiesto');
    if (!characterData.lastName.trim()) errors.push('Cognome richiesto');
    if (!characterData.birthDate?.trim()) errors.push('Data di nascita richiesta');
    else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(characterData.birthDate)) errors.push('Formato data invalido (gg/mm/yyyy)');
    else if (parseInt(characterData.birthDate.split('/')[2]) >= 1895) errors.push('Anno di nascita deve essere inferiore al 1895');
    if (age === null) errors.push('Età richiesta');
    else if (age < 18) errors.push('Età minima: 18 anni');
    else if (age > 80) errors.push('Età massima: 80 anni');
    if (apparentAge === null) errors.push('Età apparente richiesta');
    else if (apparentAge < 18) errors.push('Età apparente minima: 18 anni');
    else if (apparentAge > 80) errors.push('Età apparente massima: 80 anni');
    if (!characterData.gender) errors.push('Genere richiesto');
    if (!characterData.height?.trim()) errors.push('Altezza richiesta');
    else {
      const heightNum = parseInt(characterData.height);
      if (isNaN(heightNum) || heightNum < 100 || heightNum > 250) errors.push('Altezza deve essere tra 100 e 250 cm');
    }
    if (!characterData.weight?.trim()) errors.push('Peso richiesto');
    else {
      const weightNum = parseInt(characterData.weight);
      if (isNaN(weightNum) || weightNum < 30 || weightNum > 200) errors.push('Peso deve essere tra 30 e 200 kg');
    }
    if (!characterData.eyeColor?.trim()) errors.push('Colore occhi richiesto');
    if (!characterData.hairColor?.trim()) errors.push('Colore capelli richiesto');
    if (!characterData.visibleMarks?.trim()) errors.push('Segni particolari visibili richiesti');
    if (!characterData.hiddenMarks?.trim()) errors.push('Segni particolari non visibili richiesti');
    if (!characterData.maritalStatus?.trim()) errors.push('Stato civile richiesto');
    if (!characterData.illnesses?.trim()) errors.push('Patologie richieste');
    if (!characterData.educationTitle?.trim()) errors.push('Titolo di studio richiesto');
    if (!characterData.criminalRecord?.trim()) errors.push('Fedina penale richiesta');
    if (!characterData.currentOccupation?.trim()) errors.push('Occupazione attuale richiesta');

    return { isValid: errors.length === 0, errors };
  };

  const isStepValid = () => {
    return getValidationResult().isValid;
  };

  // Notify parent when validation changes
  // Note: onValidationChange is now memoized with useCallback in parent, so it's safe to omit from deps
  useEffect(() => {
    const { isValid, errors } = getValidationResult();
    onValidationChange?.(isValid, errors);
  }, [characterData]); // Only re-run when characterData changes

  return (
    <div className={styles.stepContainer}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Informazioni Base</h2>
        <p className={styles.stepDescription}>
          Compila tutti i campi richiesti. Ricorda che ci troviamo nella Londra Vittoriana, quindi scegli nomi e dettagli appropriati all'epoca.
        </p>
        <div className={styles.privacyNote}>
          <small>ℹ️ I campi marcati con "(non visibile agli altri)" sono privati e visibili solo a te e allo staff.</small>
        </div>
      </div>

      <div className={styles.formGrid3Columns}>
        {/* Nome */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Nome <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>&nbsp;</small>
          </label>
          <input
            type="text"
            value={characterData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            className={styles.input}
            maxLength={50}
            required
          />
        </div>

        {/* Cognome */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Cognome <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>&nbsp;</small>
          </label>
          <input
            type="text"
            value={characterData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            className={styles.input}
            maxLength={50}
            required
          />
        </div>

        {/* Data di nascita */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Data di nascita (gg/mm/aaaa) <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>(non visibile agli altri)</small>
          </label>
          <input
            type="text"
            value={characterData.birthDate || ''}
            onChange={(e) => handleBirthDateChange(e.target.value)}
            className={`${styles.input} ${
              characterData.birthDate &&
              /^\d{2}\/\d{2}\/\d{4}$/.test(characterData.birthDate) &&
              parseInt(characterData.birthDate.split('/')[2]) >= 1895
                ? styles.inputError
                : ''
            }`}
            placeholder="es. 15/03/1870"
            required
          />
          {characterData.birthDate &&
           /^\d{2}\/\d{2}\/\d{4}$/.test(characterData.birthDate) &&
           parseInt(characterData.birthDate.split('/')[2]) >= 1895 ? (
            <small className={styles.errorText}>
              ⛔ ERRORE: L'anno di nascita deve essere inferiore al 1895 (ambientazione vittoriana del 1895)
            </small>
          ) : (
            <small className={styles.helpText}>
              Anno &lt; 1895. Età al 1895: {characterData.age ? `${characterData.age} anni` : '-'}. Età apparente: {characterData.apparentAge ? `${characterData.apparentAge} anni` : '-'}
            </small>
          )}
        </div>

        {/* Età apparente */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Età apparente <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>&nbsp;</small>
          </label>
          <input
            type="number"
            value={characterData.apparentAge || ''}
            onChange={(e) => handleInputChange('apparentAge', e.target.value ? parseInt(e.target.value) : null)}
            className={styles.input}
            min={18}
            max={80}
            required
          />
          <small className={styles.helpText}>
            Può differire dall'età reale (min 18, max 80)
          </small>
        </div>

        {/* Genere */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Genere <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>&nbsp;</small>
          </label>
          <select
            value={characterData.gender || ''}
            onChange={(e) => handleInputChange('gender', e.target.value as 'male' | 'female')}
            className={styles.input}
            required
          >
            <option value="">Seleziona...</option>
            <option value="male">Maschio</option>
            <option value="female">Femmina</option>
          </select>
        </div>

        {/* Altezza */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Altezza (cm) <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>&nbsp;</small>
          </label>
          <input
            type="number"
            value={characterData.height || ''}
            onChange={(e) => handleInputChange('height', e.target.value)}
            className={styles.input}
            min={100}
            max={250}
            placeholder="es. 175"
            required
          />
          <small className={styles.helpText}>
            Altezza in centimetri (100-250 cm)
          </small>
        </div>

        {/* Peso */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Peso (kg) <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>&nbsp;</small>
          </label>
          <input
            type="number"
            value={characterData.weight || ''}
            onChange={(e) => handleInputChange('weight', e.target.value)}
            className={styles.input}
            min={30}
            max={200}
            placeholder="es. 70"
            required
          />
          <small className={styles.helpText}>
            Peso in kilogrammi (30-200 kg)
          </small>
        </div>

        {/* Colore occhi */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Colore occhi <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>&nbsp;</small>
          </label>
          <input
            type="text"
            value={characterData.eyeColor || ''}
            onChange={(e) => handleInputChange('eyeColor', e.target.value)}
            className={styles.input}
            maxLength={50}
            required
          />
        </div>

        {/* Colore capelli */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Colore capelli <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>&nbsp;</small>
          </label>
          <input
            type="text"
            value={characterData.hairColor || ''}
            onChange={(e) => handleInputChange('hairColor', e.target.value)}
            className={styles.input}
            maxLength={50}
            required
          />
        </div>

        {/* Segni particolari visibili */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Segni particolari visibili <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>&nbsp;</small>
          </label>
          <input
            type="text"
            value={characterData.visibleMarks || ''}
            onChange={(e) => handleInputChange('visibleMarks', e.target.value)}
            className={styles.input}
            maxLength={200}
            required
          />
          <small className={styles.helpText}>
            Cicatrici, nei, tatuaggi visibili
          </small>
        </div>

        {/* Segni particolari non visibili */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Segni particolari non visibili <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>(non visibile agli altri)</small>
          </label>
          <input
            type="text"
            value={characterData.hiddenMarks || ''}
            onChange={(e) => handleInputChange('hiddenMarks', e.target.value)}
            className={styles.input}
            maxLength={200}
            required
          />
          <small className={styles.helpText}>
            Segni normalmente coperti dai vestiti
          </small>
        </div>

        {/* Stato civile */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Stato civile <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>(non visibile agli altri)</small>
          </label>
          <select
            value={characterData.maritalStatus || ''}
            onChange={(e) => handleInputChange('maritalStatus', e.target.value)}
            className={styles.input}
            required
          >
            <option value="">Seleziona...</option>
            <option value="single">Celibe/Nubile</option>
            <option value="married">Coniugato/a</option>
            <option value="widowed">Vedovo/a</option>
            <option value="separated">Separato/a</option>
            <option value="divorced">Divorziato/a</option>
          </select>
        </div>

        {/* Patologie */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Patologie <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>&nbsp;</small>
          </label>
          <input
            type="text"
            value={characterData.illnesses || ''}
            onChange={(e) => handleInputChange('illnesses', e.target.value)}
            className={styles.input}
            maxLength={200}
            required
          />
          <small className={styles.helpText}>
            Condizioni mediche croniche o problemi di salute
          </small>
        </div>

        {/* Titolo di studio */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Titolo di studio <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>(non visibile agli altri)</small>
          </label>
          <input
            type="text"
            value={characterData.educationTitle || ''}
            onChange={(e) => handleInputChange('educationTitle', e.target.value)}
            className={styles.input}
            maxLength={100}
            required
          />
        </div>

        {/* Fedina penale */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Fedina penale <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>&nbsp;</small>
          </label>
          <input
            type="text"
            value={characterData.criminalRecord || ''}
            onChange={(e) => handleInputChange('criminalRecord', e.target.value)}
            className={styles.input}
            maxLength={200}
            required
          />
          <small className={styles.helpText}>
            Eventuali precedenti penali
          </small>
        </div>

        {/* Occupazione attuale */}
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Occupazione attuale <span className={styles.required}>*</span>
            <small className={styles.privateLabel}>&nbsp;</small>
          </label>
          <input
            type="text"
            value={characterData.currentOccupation || ''}
            onChange={(e) => handleInputChange('currentOccupation', e.target.value)}
            className={styles.input}
            maxLength={100}
            required
          />
          <small className={styles.helpText}>
            La tua professione o occupazione principale
          </small>
        </div>

      </div>

      {/* Navigation */}
      <div className={styles.stepNavigation}>
        <div className={styles.validationInfo}>
          {!isStepValid() && (
            <p className={styles.validationWarning}>
              ⚠️ Completa tutti i campi obbligatori per procedere
            </p>
          )}
        </div>

        <div className={styles.navigationButtons}>
          <button
            onClick={onManualSave}
            className={`${styles.saveButton} manual-save-button`}
            type="button"
          >
            💾 SALVA
          </button>

          <button
            onClick={onNext}
            disabled={!isStepValid()}
            className={styles.nextButton}
          >
            Continua con le Esperienze Pregresse →
          </button>
        </div>
      </div>
    </div>
  );
};
